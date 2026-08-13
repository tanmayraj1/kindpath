"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { audit } from "@/lib/audit";
import { auditConsentChange } from "@/lib/privacy";
import { z } from "zod";
import { requireDonor } from "@/lib/auth/guards";
import { withTenant } from "@/lib/tenant";
import { retryPlanForDonor } from "@/lib/billing";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { formErrors, type FieldErrors } from "@/lib/validation";

export type PortalState = { error?: string; ok?: boolean; fields?: FieldErrors };

// ---- retry a failing / suspended recurring plan (dunning recovery) ----
export type RetryState = { error?: string; ok?: boolean; message?: string };

export async function retryFailedPlan(planId: string): Promise<RetryState> {
  const session = await requireDonor();
  if (!(await rateLimit(`retry-plan:${clientIp()}`, 5, 60_000)).ok) {
    return { error: "Too many attempts. Please wait a minute and try again." };
  }

  const outcome = await retryPlanForDonor(planId, session.sub);
  revalidatePath("/portal/recurring");
  revalidatePath("/portal");

  switch (outcome) {
    case "charged":
      return { ok: true, message: "Payment successful — your recurring gift is active again." };
    case "failed":
    case "suspended":
      return { error: "That payment was declined again. Please update your card and try once more." };
    case "not_retryable":
      return { error: "This plan doesn't need a retry right now." };
    default:
      return { error: "We couldn't find that plan." };
  }
}

/**
 * Result of a donor-initiated change. These returned `Promise<void>` and did
 * nothing at all when the row wasn't theirs, so a donor cancelling a gift saw a
 * spinner finish and had no way to know whether it worked.
 */
export type PortalMutation = { ok?: boolean; error?: string };

const NOT_YOURS: PortalMutation = {
  error: "We couldn't find that on your account. Please refresh and try again.",
};

// ---- recurring plan controls (pause / resume / cancel) ----
export async function updatePlanStatus(
  planId: string,
  action: "pause" | "resume" | "cancel"
): Promise<PortalMutation> {
  const session = await requireDonor();
  const status = action === "pause" ? "paused" : action === "resume" ? "active" : "cancelled";

  const found = await withTenant(session.orgId, async (tx) => {
    // ownership enforced by RLS (org) + explicit donorId check
    const plan = await tx.recurringPlan.findFirst({
      where: { id: planId, donorId: session.sub },
    });
    if (!plan) return false;
    await tx.recurringPlan.update({
      where: { id: planId },
      data: {
        status,
        cancelledAt: action === "cancel" ? new Date() : null,
      },
    });
    return true;
  });
  if (!found) return NOT_YOURS;

  // A donor disputing "I cancelled and you charged me again" is answered by this.
  await audit({
    actor: { type: "donor", id: session.sub },
    orgId: session.orgId,
    action: `recurring_plan.${action}`,
    entityType: "recurring_plan",
    entityId: planId,
  });

  revalidatePath("/portal/recurring");
  revalidatePath("/portal");
  return { ok: true };
}

// ---- remove a payment method ----
export async function removePaymentMethod(methodId: string): Promise<PortalMutation> {
  const session = await requireDonor();

  const result = await withTenant(session.orgId, async (tx) => {
    const pm = await tx.donorPaymentMethod.findFirst({
      where: { id: methodId, donorId: session.sub },
    });
    if (!pm) return "missing" as const;

    // Removing the card an active recurring gift is billed against would stop
    // that gift silently at the next cycle. Say so instead.
    const inUse = await tx.recurringPlan.count({
      where: { paymentMethodId: methodId, donorId: session.sub, status: { in: ["active", "paused"] } },
    });
    if (inUse > 0) return "in_use" as const;

    await tx.donorPaymentMethod.update({
      where: { id: methodId },
      data: { status: "removed", isDefault: false },
    });
    return "removed" as const;
  });

  if (result === "missing") return NOT_YOURS;
  if (result === "in_use") {
    return {
      error:
        "This card is paying for a recurring gift. Add another card first, or cancel the gift, then remove it.",
    };
  }
  revalidatePath("/portal/payment-methods");
  return { ok: true };
}

// ---- update profile + CASL preferences ----
const profileSchema = z.object({
  // Editable, because this is the name printed on an official tax receipt and a
  // donor previously had no way to correct a misspelling of their own legal name.
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  phone: z.string().max(40).optional(),
  addressLine1: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  province: z.string().max(50).optional(),
  postalCode: z.string().max(12).optional(),
  emailMarketing: z.string().optional(),
  smsMarketing: z.string().optional(),
});

export async function updateDonorProfile(
  _prev: PortalState,
  formData: FormData
): Promise<PortalState> {
  const session = await requireDonor();
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const { fields, message } = formErrors(parsed.error);
    return { error: message, fields };
  }
  const d = parsed.data;
  const emailOptIn = d.emailMarketing === "on";
  const smsOptIn = d.smsMarketing === "on";

  const result = await withTenant(session.orgId, async (tx) => {
    const donor = await tx.donor.findFirst({ where: { id: session.sub } });
    if (!donor) return null;
    if (donor.anonymizedAt) return { anonymized: true, before: null, after: null };

    const addressComplete = !!(d.addressLine1 && d.city && d.province && d.postalCode);
    const before = {
      caslConsent: donor.caslConsent as string,
      emailMarketingOptIn: donor.emailMarketingOptIn,
      smsMarketingOptIn: donor.smsMarketingOptIn,
    };
    const after = {
      caslConsent: emailOptIn || smsOptIn ? "express" : "none",
      emailMarketingOptIn: emailOptIn,
      smsMarketingOptIn: smsOptIn,
    };

    await tx.donor.update({
      where: { id: session.sub },
      data: {
        firstName: d.firstName || donor.firstName,
        lastName: d.lastName || donor.lastName,
        phone: d.phone || null,
        addressLine1: d.addressLine1 || donor.addressLine1,
        city: d.city || donor.city,
        province: d.province || donor.province,
        postalCode: d.postalCode || donor.postalCode,
        addressStatus: addressComplete ? "complete" : donor.addressStatus,
        emailMarketingOptIn: emailOptIn,
        smsMarketingOptIn: smsOptIn,
        // consent reflects their current marketing choice
        caslConsent: after.caslConsent as "express" | "none",
        caslConsentAt: emailOptIn || smsOptIn ? new Date() : donor.caslConsentAt,
        caslConsentSource: "portal",
      },
    });
    return { anonymized: false, before, after };
  });

  // Silence here previously reported success on a record that no longer existed.
  if (!result) return { error: "We couldn't find your record. Please sign in again." };
  if (result.anonymized) {
    return { error: "This record has been removed at your request and can no longer be edited." };
  }

  // The prior consent value is what proves consent state at send time under CASL.
  if (result.before && result.after) {
    await auditConsentChange({
      orgId: session.orgId,
      donorId: session.sub,
      actor: { type: "donor", id: session.sub },
      before: result.before,
      after: result.after,
      ip: clientIp(),
    });
  }

  revalidatePath("/portal/profile");
  return { ok: true };
}

// ---------------- data rights (PIPEDA / Quebec Law 25) ----------------

/**
 * Erase this donor's record at their own request.
 *
 * Scrubs the living record and retains the receipts, because the Income Tax Act
 * requires the charity to keep them — the donor is told exactly that, up front,
 * rather than discovering it afterwards.
 */
export async function requestMyErasure(): Promise<PortalState & { receiptsRetained?: number }> {
  const session = await requireDonor();
  if (!(await rateLimit(`erasure:${session.sub}`, 3, 60 * 60_000)).ok) {
    return { error: "Too many requests. Please try again later." };
  }

  const { anonymizeDonor } = await import("@/lib/privacy");
  const result = await anonymizeDonor({
    orgId: session.orgId,
    donorId: session.sub,
    requestedBy: { type: "donor", id: session.sub },
    ip: clientIp(),
  });
  if ("error" in result) return { error: result.error };

  revalidatePath("/portal");
  return { ok: true, receiptsRetained: result.receiptsRetained };
}

// ---------------- replace the card on a recurring gift ----------------

export type CardUpdateStart = { ok: true; redirectTo: string } | { ok: false; message: string };

/**
 * Start replacing the card behind a recurring gift.
 *
 * The dunning email and the portal banner both said "Update payment method →"
 * and landed the donor on a page that could only REMOVE cards. A donor whose
 * card had expired — the entire population that banner exists for — had no
 * self-service route at all, which defeated the retry flow we built for them.
 *
 * This charges the gift's amount on the new card rather than merely storing it.
 * That is deliberate and it is what both gateways actually support: WeVend's
 * reusable token IS a completed sale's transactionId, and it also collects the
 * payment that failed, so the donor's giving doesn't silently skip a month.
 */
export async function beginCardUpdate(planId: string): Promise<CardUpdateStart> {
  const session = await requireDonor();

  if (!(await rateLimit(`cardupdate:${session.sub}`, 5, 60_000)).ok) {
    return { ok: false, message: "Too many attempts. Please wait a minute and try again." };
  }

  const ctx = await withTenant(session.orgId, async (tx) => {
    const plan = await tx.recurringPlan.findFirst({
      where: { id: planId, donorId: session.sub, status: { not: "cancelled" } },
    });
    if (!plan) return null;
    const org = await tx.organization.findUnique({ where: { id: session.orgId } });
    return { plan, org };
  });
  if (!ctx?.org) {
    return { ok: false, message: "We couldn't find that gift on your account." };
  }

  const { getPaymentProviderForOrg, supportsHostedSale } = await import("@/lib/payments");
  const provider = await getPaymentProviderForOrg(session.orgId);
  if (!supportsHostedSale(provider)) {
    return {
      ok: false,
      message:
        "This organization can't accept card updates online yet. Please contact them directly and they can update it for you.",
    };
  }

  const amount = Number(ctx.plan.amount);
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  let init;
  try {
    init = await provider.beginHostedSale({
      orgId: session.orgId,
      money: { amount, currency: ctx.plan.currency },
      // WeVend requires the return URL to end in /response.
      redirectUrl: `${base}/portal/recurring/response`,
      savePaymentMethod: true,
      donorEmail: session.email,
      description: `${ctx.org.name} — recurring gift`,
    });
  } catch (e) {
    const { captureError } = await import("@/lib/observability");
    captureError(e, { source: "portal.beginCardUpdate", orgId: session.orgId, planId });
    return { ok: false, message: "The payment service is unavailable. Please try again shortly." };
  }

  const { signHostedState, HOSTED_STATE_COOKIE } = await import("@/lib/hosted-state");
  cookies().set(
    HOSTED_STATE_COOKIE,
    signHostedState({
      kind: "plan_card",
      orgId: session.orgId,
      slug: "",
      amount,
      currency: ctx.plan.currency,
      fundId: ctx.plan.fundId ?? undefined,
      frequency: "monthly",
      recurringPlanId: planId,
      donorId: session.sub,
      paymentOrderId: init.paymentOrderId,
    }),
    { httpOnly: true, sameSite: "lax", path: "/", maxAge: 30 * 60, secure: process.env.NODE_ENV === "production" }
  );

  return { ok: true, redirectTo: init.redirectTo };
}

// ---- change the amount of a recurring gift ----
const planAmountSchema = z.object({
  planId: z.string().min(1),
  amount: z.coerce.number().min(1, "Enter an amount of at least $1").max(1_000_000),
});

/**
 * Let a donor change what they give each period.
 *
 * The marketing FAQ has always promised donors can "change the amount or
 * frequency" from their portal. The amount is the half that matters and the half
 * that is safe: the billing cron reads `amount` at charge time, so the next
 * scheduled gift simply uses the new figure. Frequency is deliberately not
 * changed here — it would move the billing date under a donor who is mid-cycle,
 * and the honest version of that is cancel-and-restart.
 *
 * Increases and decreases are both allowed; this is the donor's own money and
 * their own decision.
 */
export async function updatePlanAmount(
  _prev: PortalState,
  formData: FormData
): Promise<PortalState> {
  const session = await requireDonor();
  const parsed = planAmountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const e = formErrors(parsed.error);
    return { error: e.message, fields: e.fields };
  }
  const { planId, amount } = parsed.data;

  const before = await withTenant(session.orgId, async (tx) => {
    const plan = await tx.recurringPlan.findFirst({
      where: { id: planId, donorId: session.sub, status: { not: "cancelled" } },
    });
    if (!plan) return null;
    await tx.recurringPlan.update({ where: { id: planId }, data: { amount } });
    return Number(plan.amount);
  });
  if (before === null) return { error: NOT_YOURS.error };

  // A donor querying "why did my gift change?" is answered by this.
  await audit({
    actor: { type: "donor", id: session.sub },
    orgId: session.orgId,
    action: "recurring_plan.amount_changed",
    entityType: "recurring_plan",
    entityId: planId,
    before: { amount: before },
    after: { amount },
  });

  revalidatePath("/portal/recurring");
  revalidatePath("/portal");
  return { ok: true };
}
