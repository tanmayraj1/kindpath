"use server";

import { revalidatePath } from "next/cache";
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

// ---- recurring plan controls (pause / resume / cancel) ----
export async function updatePlanStatus(planId: string, action: "pause" | "resume" | "cancel") {
  const session = await requireDonor();
  const status = action === "pause" ? "paused" : action === "resume" ? "active" : "cancelled";

  await withTenant(session.orgId, async (tx) => {
    // ownership enforced by RLS (org) + explicit donorId check
    const plan = await tx.recurringPlan.findFirst({
      where: { id: planId, donorId: session.sub },
    });
    if (!plan) return;
    await tx.recurringPlan.update({
      where: { id: planId },
      data: {
        status,
        cancelledAt: action === "cancel" ? new Date() : null,
      },
    });
  });
  revalidatePath("/portal/recurring");
  revalidatePath("/portal");
}

// ---- remove a payment method ----
export async function removePaymentMethod(methodId: string) {
  const session = await requireDonor();
  await withTenant(session.orgId, async (tx) => {
    const pm = await tx.donorPaymentMethod.findFirst({
      where: { id: methodId, donorId: session.sub },
    });
    if (!pm) return;
    await tx.donorPaymentMethod.update({
      where: { id: methodId },
      data: { status: "removed", isDefault: false },
    });
  });
  revalidatePath("/portal/payment-methods");
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
