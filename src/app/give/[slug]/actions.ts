"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { adminDb } from "@/lib/db";
import { withTenant } from "@/lib/tenant";
import { getPaymentProvider } from "@/lib/payments";
import { nextReceiptSerial, formatAddress } from "@/lib/receipts";
import { sendReceiptEmail } from "@/lib/notifications";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { signChargeToken, verifyChargeToken } from "@/lib/charge-token";
import { signReceiptToken } from "@/lib/receipt-links";

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

  const provider = getPaymentProvider();
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

// ---------- step 2: capture details + issue receipt ----------
export type CompleteState = { error?: string };

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

export async function completeDonation(
  _prev: CompleteState,
  formData: FormData
): Promise<CompleteState> {
  const parsed = completeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check your details." };
  }
  const d = parsed.data;

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

  const receiptId = await withTenant(org.id, async (tx) => {
    // de-dupe: same charge already recorded?
    const existing = await tx.donation.findFirst({
      where: { providerChargeRef: chargeRef },
      include: { receipt: true },
    });
    if (existing?.receipt) return existing.receipt.id;

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
          providerToken: `tok_${chargeRef}`,
          brand: "Visa",
          last4: "4242",
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
        receivedAt: new Date(),
      },
    });

    const serial = await nextReceiptSerial(tx, org.id, year, org.receiptPrefix);
    const receipt = await tx.receipt.create({
      data: {
        orgId: org.id,
        donationId: donation.id,
        donorId: donor.id,
        serialNumber: serial,
        documentType: registered ? "official" : "confirmation",
        donorNameSnapshot: [d.firstName, d.middleInitial, d.lastName].filter(Boolean).join(" "),
        donorAddressSnapshot: formatAddress({
          addressLine1: d.addressLine1,
          city: d.city,
          province: d.province,
          postalCode: d.postalCode,
          country: "CA",
        }),
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

    await sendReceiptEmail(tx, {
      orgId: org.id,
      donorId: donor.id,
      donorEmail: d.email,
      donorName: `${d.firstName} ${d.lastName}`,
      orgName: org.name,
      receiptId: receipt.id,
      serialNumber: receipt.serialNumber,
      eligibleAmount: Number(receipt.eligibleAmount),
      official: registered,
      brandColor: org.primaryColor,
      logoUrl: org.logoUrl,
    });

    return receipt.id;
  });

  // signed link so the public receipt page only shows PII to the actual donor
  redirect(`/r/${receiptId}?t=${signReceiptToken(receiptId)}`);
}
