"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";
import { adminDb } from "@/lib/db";
import { withTenant } from "@/lib/tenant";
import { getPaymentProviderForOrg, supportsHostedSale } from "@/lib/payments";
import { nextReceiptSerial, formatAddress } from "@/lib/receipts";
import { queueReceiptEmail, queueReceiptDetailsEmail, flushEmails } from "@/lib/notifications";
import { captureError } from "@/lib/observability";
import { isDuplicateChargeError, findReceiptForCharge } from "@/lib/donations";
import { formErrors, type FieldErrors } from "@/lib/validation";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { signChargeToken, verifyChargeToken } from "@/lib/charge-token";
import { signReceiptToken } from "@/lib/receipt-links";
import { signHostedState, HOSTED_STATE_COOKIE, type HostedKind } from "@/lib/hosted-state";

// ---------- step 1: authorize a charge (payment happens first) ----------
export type ChargeState =
  | { ok: true; chargeRef: string }
  | { ok: false; message: string };

export async function authorizeCharge(
  slug: string,
  amount: number,
  currency = "CAD"
): Promise<ChargeState> {
  if (!Number.isFinite(amount) || amount < 1 || amount > 1_000_000) {
    return { ok: false, message: "Enter a valid amount." };
  }
  if (!(await rateLimit(`charge:${clientIp()}`, 10, 60_000)).ok) {
    return { ok: false, message: "Too many attempts. Please wait a minute and try again." };
  }
  const org = await adminDb.organization.findUnique({ where: { slug } });
  if (!org) return { ok: false, message: "Organization not found." };

  const provider = await getPaymentProviderForOrg(org.id);
  const result = await provider.charge({
    orgId: org.id,
    providerToken: "tok_public_oneoff",
    money: { amount, currency },
    idempotencyKey: `${slug}-${amount}-${Date.now()}`,
  });

  if (!result.success) {
    return { ok: false, message: result.failureMessage ?? "Payment was declined." };
  }
  // Bind the authoritative amount/org into a signed token — the client cannot alter it.
  const token = signChargeToken({
    ref: result.providerChargeRef,
    orgId: org.id,
    amount,
    currency,
  });
  return { ok: true, chargeRef: token };
}

// ---------- step 1b: hosted gateways (WeVend iframe, Stripe Checkout) ----------
export type HostedStart =
  | { ok: true; redirectTo: string }
  | { ok: false; message: string };

type HostedInput = {
  slug: string;
  amount: number;
  currency?: string;
  frequency?: "one_time" | "monthly";
  fundId?: string;
  campaignId?: string;
  // ticket purchases
  eventId?: string;
  ticketTypeId?: string;
  quantity?: number;
  // membership joins
  planId?: string;
  description?: string;
};

/**
 * Start a hosted payment: create the order at the gateway, stash signed state in
 * a short-lived httpOnly cookie (it survives the off-site hop and can't be
 * tampered with), and hand back the URL to send the payer to. They complete
 * payment on the gateway's own page and return to /give/[slug]/response.
 *
 * Shared by donations, ticket purchases and membership joins. The last two used
 * to bypass this entirely and post a mock placeholder token, so with a real
 * gateway configured they ran a demo code path and could never take money.
 */
async function beginHosted(kind: HostedKind, input: HostedInput): Promise<HostedStart> {
  const { slug, amount } = input;
  const currency = input.currency ?? "CAD";
  const frequency = input.frequency ?? "one_time";

  if (!Number.isFinite(amount) || amount < 1 || amount > 1_000_000) {
    return { ok: false, message: "Enter a valid amount." };
  }
  if (!(await rateLimit(`charge:${clientIp()}`, 10, 60_000)).ok) {
    return { ok: false, message: "Too many attempts. Please wait a minute and try again." };
  }
  const org = await adminDb.organization.findUnique({ where: { slug } });
  if (!org) return { ok: false, message: "Organization not found." };

  const provider = await getPaymentProviderForOrg(org.id);
  if (!supportsHostedSale(provider)) {
    return { ok: false, message: "Hosted payments are not enabled." };
  }

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  let init;
  try {
    init = await provider.beginHostedSale({
      orgId: org.id,
      money: { amount, currency },
      // WeVend requires the redirect URL to end in /response.
      redirectUrl: `${base}/give/${slug}/response`,
      // Recurring gifts need the method retained for off-session charges later.
      savePaymentMethod: frequency === "monthly",
      description: input.description ?? `${org.name} — ${kind === "donation" ? "Donation" : kind === "ticket" ? "Event tickets" : "Membership"}`,
    });
  } catch (e) {
    captureError(e, { source: "give.beginHosted", kind, slug, amount });
    return { ok: false, message: "The payment service is unavailable. Please try again shortly." };
  }

  cookies().set(
    HOSTED_STATE_COOKIE,
    signHostedState({
      kind,
      orgId: org.id,
      slug,
      amount,
      currency,
      fundId: input.fundId,
      campaignId: input.campaignId,
      frequency,
      eventId: input.eventId,
      ticketTypeId: input.ticketTypeId,
      quantity: input.quantity,
      planId: input.planId,
      paymentOrderId: init.paymentOrderId,
    }),
    { httpOnly: true, sameSite: "lax", path: "/", maxAge: 30 * 60, secure: process.env.NODE_ENV === "production" }
  );
  return { ok: true, redirectTo: init.redirectTo };
}

export async function beginHostedDonation(input: {
  slug: string;
  amount: number;
  fundId?: string;
  campaignId?: string;
  frequency: "one_time" | "monthly";
  currency?: string;
}): Promise<HostedStart> {
  return beginHosted("donation", input);
}

export async function beginHostedTicketPurchase(input: {
  slug: string;
  amount: number;
  eventId: string;
  ticketTypeId: string;
  quantity: number;
  description?: string;
}): Promise<HostedStart> {
  return beginHosted("ticket", input);
}

export async function beginHostedMembership(input: {
  slug: string;
  amount: number;
  planId: string;
  frequency?: "one_time" | "monthly";
  description?: string;
}): Promise<HostedStart> {
  return beginHosted("membership", input);
}

// ---------- step 2: capture details + issue receipt ----------
export type CompleteState = { error?: string; fields?: FieldErrors };

const completeSchema = z.object({
  slug: z.string().min(1),
  chargeRef: z.string().min(1),
  amount: z.coerce.number().min(1),
  fundId: z.string().optional(),
  campaignId: z.string().optional(),
  frequency: z.enum(["one_time", "monthly"]).default("one_time"),
  firstName: z.string().min(1, "First name is required").max(100),
  middleInitial: z.string().max(2).optional(),
  lastName: z.string().min(1, "Last name is required").max(100),
  email: z.string().email("Enter a valid email").max(254),
  addressLine1: z.string().min(2, "Address is required").max(200),
  city: z.string().min(1, "City is required").max(100),
  province: z.string().min(1, "Province is required").max(50),
  postalCode: z.string().min(3, "Postal code is required").max(12),
});

type CompleteInput = z.infer<typeof completeSchema>;

type IssuableOrg = {
  id: string;
  name: string;
  charityStatus: string;
  craRegistrationNumber: string | null;
  receiptLocality: string | null;
  receiptPrefix: string | null;
  authorizedSignatory: string | null;
  primaryColor: string | null;
  logoUrl: string | null;
};

/**
 * Create the receipt for an already-recorded donation and queue the donor's copy.
 *
 * The single place a receipt is issued. Two flows reach it — the donor who filled
 * everything in at the giving page, and the donor who gave an email at a terminal
 * and completed the details days later from their inbox — and a second copy of
 * this logic is how the two would quietly drift apart on the one document that has
 * to be right.
 *
 * The donor row is the source of truth for the name and address, not the form: by
 * the time this runs the details are saved, and the receipt snapshots what the
 * donor record actually says.
 */
async function issueReceipt(
  tx: Parameters<Parameters<typeof withTenant>[1]>[0],
  args: {
    org: IssuableOrg;
    donation: { id: string; receivedAt: Date; eligibleAmount: unknown; amount: unknown };
    donor: {
      id: string;
      email: string;
      firstName: string;
      middleInitial: string | null;
      lastName: string;
      addressLine1: string | null;
      city: string | null;
      province: string | null;
      postalCode: string | null;
    };
  }
): Promise<{ receiptId: string; mail: Awaited<ReturnType<typeof queueReceiptEmail>> }> {
  const { org, donation, donor } = args;
  const registered = org.charityStatus === "registered";
  const year = new Date().getFullYear();
  const amount = Number(donation.eligibleAmount ?? donation.amount);

  const serial = await nextReceiptSerial(tx, org.id, year, org.receiptPrefix);
  const receipt = await tx.receipt.create({
    data: {
      orgId: org.id,
      donationId: donation.id,
      donorId: donor.id,
      serialNumber: serial,
      documentType: registered ? "official" : "confirmation",
      donorNameSnapshot: [donor.firstName, donor.middleInitial, donor.lastName]
        .filter(Boolean)
        .join(" "),
      // A payment confirmation carries no address because it is not a tax
      // document and the CRA fields do not apply — so a non-registered org is
      // never made to collect one. Empty here means "not required", not "missing".
      donorAddressSnapshot: donor.addressLine1
        ? formatAddress({
            addressLine1: donor.addressLine1,
            city: donor.city ?? "",
            province: donor.province ?? "",
            postalCode: donor.postalCode ?? "",
            country: "CA",
          })
        : "",
      orgNameSnapshot: org.name,
      orgRegNumberSnapshot: org.craRegistrationNumber,
      amount,
      advantageValue: 0,
      eligibleAmount: amount,
      placeIssued: org.receiptLocality,
      dateDonationReceived: donation.receivedAt,
      signatoryNameSnapshot: registered ? org.authorizedSignatory : null,
      year,
    },
  });

  // Queued inside the transaction, sent after it commits — see lib/notifications.
  const mail = await queueReceiptEmail(tx, {
    orgId: org.id,
    donorId: donor.id,
    donorEmail: donor.email,
    donorName: [donor.firstName, donor.lastName].filter(Boolean).join(" ") || donor.email,
    orgName: org.name,
    receiptId: receipt.id,
    serialNumber: receipt.serialNumber,
    eligibleAmount: Number(receipt.eligibleAmount),
    official: registered,
    brandColor: org.primaryColor,
    logoUrl: org.logoUrl,
  });

  return { receiptId: receipt.id, mail };
}

/**
 * Record a completed donation + issue the receipt. Shared by the redirecting
 * donor flow (completeDonation) and the in-page kiosk flow (completeKioskDonation).
 * Returns the receipt id, or an error message — never redirects.
 */
async function recordDonation(d: CompleteInput): Promise<{ receiptId: string } | { error: string }> {
  const org = await adminDb.organization.findUnique({ where: { slug: d.slug } });
  if (!org) return { error: "Organization not found." };

  // Trust the signed charge token, NOT the client's posted amount.
  const charge = verifyChargeToken(d.chargeRef);
  if (!charge || charge.orgId !== org.id) {
    return { error: "Your payment session expired. Please start the donation again." };
  }
  const amount = charge.amount;
  const currency = charge.currency;
  const chargeRef = charge.ref;

  const registered = org.charityStatus === "registered";
  const year = new Date().getFullYear();
  const reqFundId = d.fundId && d.fundId !== "none" ? d.fundId : null;
  const reqCampaignId = d.campaignId && d.campaignId !== "none" ? d.campaignId : null;

  const write = () => withTenant(org.id, async (tx) => {
    // de-dupe: same charge already recorded?
    const existing = await tx.donation.findFirst({
      where: { chargeKey: chargeRef },
      include: { receipt: true },
    });
    if (existing?.receipt) return { receiptId: existing.receipt.id, mail: null };

    // validate fund/campaign actually belong to this org (no cross-tenant refs)
    const fundId =
      reqFundId && (await tx.fund.findFirst({ where: { id: reqFundId } })) ? reqFundId : null;
    const campaignId =
      reqCampaignId && (await tx.campaign.findFirst({ where: { id: reqCampaignId } }))
        ? reqCampaignId
        : null;

    const donor = await tx.donor.upsert({
      where: { orgId_email: { orgId: org.id, email: d.email } },
      create: {
        orgId: org.id,
        firstName: d.firstName,
        middleInitial: d.middleInitial,
        lastName: d.lastName,
        email: d.email,
        addressLine1: d.addressLine1,
        city: d.city,
        province: d.province,
        postalCode: d.postalCode,
        addressStatus: "complete",
        caslConsent: "implied",
        caslConsentAt: new Date(),
        caslConsentSource: "donation",
      },
      update: {
        firstName: d.firstName,
        middleInitial: d.middleInitial,
        lastName: d.lastName,
        addressLine1: d.addressLine1,
        city: d.city,
        province: d.province,
        postalCode: d.postalCode,
        addressStatus: "complete",
      },
    });

    let recurringPlanId: string | null = null;
    if (d.frequency === "monthly") {
      const pm = await tx.donorPaymentMethod.create({
        data: {
          orgId: org.id,
          donorId: donor.id,
          // The gateway's own reusable token when it gave us one; otherwise the
          // transaction id, which is what WeVend's sale-with-token expects.
          providerToken: charge.token || `tok_${chargeRef}`,
          // Only what the gateway actually told us. Null renders as
          // "Card •••• ····" in the portal, which is honest; a hardcoded
          // "Visa •••• 4242" is not.
          brand: charge.brand ?? null,
          last4: charge.last4 ?? null,
          isDefault: true,
        },
      });
      const plan = await tx.recurringPlan.create({
        data: {
          orgId: org.id,
          donorId: donor.id,
          fundId,
          paymentMethodId: pm.id,
          amount,
          currency,
          frequency: "monthly",
          status: "active",
          nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
      recurringPlanId = plan.id;
    }

    const donation = await tx.donation.create({
      data: {
        orgId: org.id,
        donorId: donor.id,
        fundId,
        campaignId,
        recurringPlanId,
        type: d.frequency === "monthly" ? "recurring" : "one_time",
        amount,
        advantageValue: 0,
        eligibleAmount: amount,
        currency,
        status: "succeeded",
        providerChargeRef: chargeRef,
        chargeKey: chargeRef, // unique — the double-submit guard
        receivedAt: new Date(),
      },
    });

    const { receiptId, mail } = await issueReceipt(tx, { org, donation, donor });
    return { receiptId, mail };
  });

  let receiptId: string;
  let mail: Awaited<ReturnType<typeof queueReceiptEmail>> | null;
  try {
    ({ receiptId, mail } = await write());
  } catch (e) {
    // A concurrent submit won the race for this charge. Not an error for the
    // donor — hand them the receipt the winning request already created.
    if (!isDuplicateChargeError(e)) throw e;
    const winner = await findReceiptForCharge(org.id, chargeRef);
    if (!winner) throw e;
    return { receiptId: winner };
  }

  if (mail) await flushEmails([mail]);
  return { receiptId };
}

/**
 * The donor's card has ALREADY been charged by the time we get here. If recording
 * the gift throws, we must not show a generic error page — that reads as "your
 * payment failed" to someone whose money is gone. Report loudly, reassure honestly.
 */
async function recordDonationSafely(
  d: CompleteInput
): Promise<{ receiptId: string } | { error: string }> {
  try {
    return await recordDonation(d);
  } catch (e) {
    captureError(e, {
      source: "give.recordDonation",
      slug: d.slug,
      amount: d.amount,
      email: d.email,
      severity: "charged_not_recorded",
    });
    return {
      error:
        "Your payment went through, but we hit a problem issuing your receipt. " +
        "You have not been charged twice — please do not retry. " +
        "The organization has been alerted and will email your receipt shortly.",
    };
  }
}

export async function completeDonation(
  _prev: CompleteState,
  formData: FormData
): Promise<CompleteState> {
  const parsed = completeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    // Every invalid field at once. The donor's card is already charged by this
    // point — making them discover problems one at a time is not acceptable.
    const { fields, message } = formErrors(parsed.error);
    return { error: message, fields };
  }
  const result = await recordDonationSafely(parsed.data);
  if ("error" in result) return { error: result.error };

  // signed link so the public receipt page only shows PII to the actual donor
  redirect(`/r/${result.receiptId}?t=${signReceiptToken(result.receiptId)}`);
}

// ---------- kiosk: complete WITHOUT redirecting (shared tablet, no PII on screen) ----------
export type KioskCompleteState = { ok?: boolean; error?: string; fields?: FieldErrors };

export async function completeKioskDonation(
  _prev: KioskCompleteState,
  formData: FormData
): Promise<KioskCompleteState> {
  const parsed = completeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const { fields, message } = formErrors(parsed.error);
    return { error: message, fields };
  }
  const result = await recordDonationSafely(parsed.data);
  if ("error" in result) return { error: result.error };
  // No redirect, no receipt link on screen — the donor gets their receipt by email.
  return { ok: true };
}

// ---------- email-only completion: pay now, finish the receipt later ----------

/**
 * What the donor should be told after an email-only completion.
 *  - "receipted": nothing further is needed; the receipt is already on its way.
 *  - "details_needed": an official receipt is possible but needs a name and
 *    address, and we have emailed a link to collect them.
 */
export type EmailOnlyState = {
  ok?: boolean;
  status?: "receipted" | "details_needed";
  donationId?: string;
  error?: string;
  fields?: FieldErrors;
};

const emailOnlySchema = z.object({
  slug: z.string().min(1),
  chargeRef: z.string().min(1),
  fundId: z.string().optional(),
  campaignId: z.string().optional(),
  frequency: z.enum(["one_time", "monthly"]).default("one_time"),
  email: z.string().trim().email("Enter a valid email").max(254),
});

/**
 * Record the gift against an email address alone.
 *
 * The point of the whole flow: a donor at a POS terminal or scanning a QR in a pew
 * types one field and leaves. The details a CRA receipt needs are collected later
 * from their inbox (src/lib/receipt-details-link.ts).
 *
 * Three outcomes, and the difference matters to the donor:
 *  - a non-registered organization issues a payment confirmation, which needs no
 *    address at all, so it goes out immediately and nothing more is asked;
 *  - a returning donor whose address is already on file gets the official receipt
 *    immediately — asking someone for an address we already hold is just friction;
 *  - otherwise the gift is recorded and a "finish your receipt" email is sent.
 */
async function recordEmailOnly(
  d: z.infer<typeof emailOnlySchema>
): Promise<{ status: "receipted" | "details_needed"; donationId: string } | { error: string }> {
  const org = await adminDb.organization.findUnique({ where: { slug: d.slug } });
  if (!org) return { error: "Organization not found." };

  const charge = verifyChargeToken(d.chargeRef);
  if (!charge || charge.orgId !== org.id) {
    return { error: "Your payment session expired. Please start the donation again." };
  }
  const amount = charge.amount;
  const registered = org.charityStatus === "registered";
  const email = d.email.toLowerCase();
  const reqFundId = d.fundId && d.fundId !== "none" ? d.fundId : null;
  const reqCampaignId = d.campaignId && d.campaignId !== "none" ? d.campaignId : null;

  const write = () =>
    withTenant(org.id, async (tx) => {
      const existing = await tx.donation.findFirst({
        where: { chargeKey: charge.ref },
        include: { receipt: true },
      });
      if (existing) {
        const status: "receipted" | "details_needed" = existing.receipt
          ? "receipted"
          : "details_needed";
        return { status, donationId: existing.id, mail: null };
      }

      const fundId =
        reqFundId && (await tx.fund.findFirst({ where: { id: reqFundId } })) ? reqFundId : null;
      const campaignId =
        reqCampaignId && (await tx.campaign.findFirst({ where: { id: reqCampaignId } }))
          ? reqCampaignId
          : null;

      // Names stay empty until the donor supplies them. The schema's
      // addressStatus already models exactly this state, and a placeholder name
      // would surface in the org's donor list as though it were real.
      const donor = await tx.donor.upsert({
        where: { orgId_email: { orgId: org.id, email } },
        create: {
          orgId: org.id,
          firstName: "",
          lastName: "",
          email,
          addressStatus: "pending",
          caslConsent: "implied",
          caslConsentAt: new Date(),
          caslConsentSource: "donation",
        },
        update: {},
      });

      let recurringPlanId: string | null = null;
      if (d.frequency === "monthly") {
        const pm = await tx.donorPaymentMethod.create({
          data: {
            orgId: org.id,
            donorId: donor.id,
            providerToken: charge.token || `tok_${charge.ref}`,
            brand: charge.brand ?? null,
            last4: charge.last4 ?? null,
            isDefault: true,
          },
        });
        const plan = await tx.recurringPlan.create({
          data: {
            orgId: org.id,
            donorId: donor.id,
            fundId,
            paymentMethodId: pm.id,
            amount,
            currency: charge.currency,
            frequency: "monthly",
            status: "active",
            nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        });
        recurringPlanId = plan.id;
      }

      const donation = await tx.donation.create({
        data: {
          orgId: org.id,
          donorId: donor.id,
          fundId,
          campaignId,
          recurringPlanId,
          type: d.frequency === "monthly" ? "recurring" : "one_time",
          amount,
          advantageValue: 0,
          eligibleAmount: amount,
          currency: charge.currency,
          status: "succeeded",
          providerChargeRef: charge.ref,
          chargeKey: charge.ref,
          receivedAt: new Date(),
        },
      });

      // A confirmation needs no address; a returning donor's is already on file.
      const canIssueNow = !registered || donor.addressStatus === "complete";
      if (canIssueNow) {
        const { mail } = await issueReceipt(tx, { org, donation, donor });
        return { status: "receipted" as const, donationId: donation.id, mail };
      }

      const mail = await queueReceiptDetailsEmail(tx, {
        orgId: org.id,
        donorId: donor.id,
        donorEmail: email,
        orgName: org.name,
        donationId: donation.id,
        amount,
        brandColor: org.primaryColor,
        logoUrl: org.logoUrl,
      });
      return { status: "details_needed" as const, donationId: donation.id, mail };
    });

  let result: Awaited<ReturnType<typeof write>>;
  try {
    result = await write();
  } catch (e) {
    if (!isDuplicateChargeError(e)) throw e;
    // A concurrent submit won the race for this charge; the gift is recorded.
    const winner = await withTenant(org.id, (tx) =>
      tx.donation.findFirst({ where: { chargeKey: charge.ref }, include: { receipt: true } })
    );
    if (!winner) throw e;
    return {
      status: winner.receipt ? "receipted" : "details_needed",
      donationId: winner.id,
    };
  }

  if (result.mail) await flushEmails([result.mail]);
  return { status: result.status, donationId: result.donationId };
}

export async function completeDonationEmailOnly(
  _prev: EmailOnlyState,
  formData: FormData
): Promise<EmailOnlyState> {
  const parsed = emailOnlySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const { fields, message } = formErrors(parsed.error);
    return { error: message, fields };
  }

  let result: Awaited<ReturnType<typeof recordEmailOnly>>;
  try {
    result = await recordEmailOnly(parsed.data);
  } catch (e) {
    // The card is already charged by this point — never render this as a payment
    // failure. Same posture as recordDonationSafely.
    captureError(e, {
      source: "give.recordEmailOnly",
      slug: parsed.data.slug,
      severity: "charged_not_recorded",
    });
    return {
      error:
        "Your payment went through, but we hit a problem recording it. " +
        "You have not been charged twice — please do not retry. " +
        "The organization has been alerted and will email your receipt shortly.",
    };
  }
  if ("error" in result) return { error: result.error };
  return { ok: true, status: result.status, donationId: result.donationId };
}

// ---------- finishing the receipt from the emailed link ----------

export type DetailsState = { error?: string; fields?: FieldErrors };

const detailsSchema = z.object({
  donationId: z.string().uuid(),
  token: z.string().min(1),
  firstName: z.string().trim().min(1, "First name is required").max(100),
  middleInitial: z.string().trim().max(2).optional(),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  addressLine1: z.string().trim().min(2, "Address is required").max(200),
  city: z.string().trim().min(1, "City is required").max(100),
  province: z.string().trim().min(1, "Province is required").max(50),
  postalCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z]\d[A-Za-z] ?\d[A-Za-z]\d$/, "Enter a valid postal code, e.g. M5V 2T6"),
  // The CRA requires a name and address on an official receipt; it does not
  // require a phone number. Collected because organizations want a way to reach
  // a donor, but never allowed to block a receipt.
  phone: z.string().trim().max(30).optional(),
});

/**
 * Fill in the donor's details and issue the receipt for an already-paid gift.
 *
 * The signed token is the authorization: it was emailed to the address the donor
 * gave at the terminal, and it is bound to this one donation. Everything is
 * re-derived server-side from the donation — the amount, the fund, the
 * organization — so the form carries no money and cannot change what was given.
 */
export async function submitReceiptDetails(
  _prev: DetailsState,
  formData: FormData
): Promise<DetailsState> {
  const parsed = detailsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const { fields, message } = formErrors(parsed.error);
    return { error: message, fields };
  }
  const d = parsed.data;

  const { checkDetailsToken } = await import("@/lib/receipt-details-link");
  const tokenState = checkDetailsToken(d.donationId, d.token);
  if (tokenState !== "ok") {
    return {
      error:
        tokenState === "expired"
          ? "This link has expired. Your gift is still recorded — contact the organization and they can issue your receipt."
          : "This link isn't valid. Please use the button in the email we sent you.",
    };
  }

  const donation = await adminDb.donation.findUnique({
    where: { id: d.donationId },
    include: { receipt: true, org: true },
  });
  if (!donation) return { error: "We couldn't find that donation." };

  // Already done — someone clicked twice, or finished on another device. Not an
  // error: hand them the receipt rather than a warning about a gift they made.
  if (donation.receipt) {
    redirect(`/r/${donation.receipt.id}?t=${signReceiptToken(donation.receipt.id)}`);
  }

  const org = donation.org;
  const postalCode = d.postalCode.toUpperCase().replace(/^(\w{3}) ?(\w{3})$/, "$1 $2");

  const result = await withTenant(org.id, async (tx) => {
    const donor = await tx.donor.update({
      where: { id: donation.donorId },
      data: {
        firstName: d.firstName,
        middleInitial: d.middleInitial || null,
        lastName: d.lastName,
        phone: d.phone || null,
        addressLine1: d.addressLine1,
        city: d.city,
        province: d.province,
        postalCode,
        addressStatus: "complete",
      },
    });
    return issueReceipt(tx, { org, donation, donor });
  });

  if (result.mail) await flushEmails([result.mail]);
  redirect(`/r/${result.receiptId}?t=${signReceiptToken(result.receiptId)}`);
}
