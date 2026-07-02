"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireDonor } from "@/lib/auth/guards";
import { withTenant } from "@/lib/tenant";
import { retryPlanForDonor } from "@/lib/billing";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export type PortalState = { error?: string; ok?: boolean };

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
  phone: z.string().optional(),
  addressLine1: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  postalCode: z.string().optional(),
  emailMarketing: z.string().optional(),
  smsMarketing: z.string().optional(),
});

export async function updateDonorProfile(
  _prev: PortalState,
  formData: FormData
): Promise<PortalState> {
  const session = await requireDonor();
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Please check your details." };
  const d = parsed.data;
  const emailOptIn = d.emailMarketing === "on";
  const smsOptIn = d.smsMarketing === "on";

  await withTenant(session.orgId, async (tx) => {
    const donor = await tx.donor.findFirst({ where: { id: session.sub } });
    if (!donor) return;
    const addressComplete = !!(d.addressLine1 && d.city && d.province && d.postalCode);
    await tx.donor.update({
      where: { id: session.sub },
      data: {
        phone: d.phone || null,
        addressLine1: d.addressLine1 || donor.addressLine1,
        city: d.city || donor.city,
        province: d.province || donor.province,
        postalCode: d.postalCode || donor.postalCode,
        addressStatus: addressComplete ? "complete" : donor.addressStatus,
        emailMarketingOptIn: emailOptIn,
        smsMarketingOptIn: smsOptIn,
        // consent reflects their current marketing choice
        caslConsent: emailOptIn || smsOptIn ? "express" : "none",
        caslConsentAt: emailOptIn || smsOptIn ? new Date() : donor.caslConsentAt,
        caslConsentSource: "portal",
      },
    });
  });
  revalidatePath("/portal/profile");
  return { ok: true };
}
