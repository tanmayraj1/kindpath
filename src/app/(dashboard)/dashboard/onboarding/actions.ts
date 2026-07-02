"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withTenant } from "@/lib/tenant";
import { requireOrgAdmin } from "@/lib/auth/guards";
import { planPrice, isPlanKey } from "@/lib/plans";

export type OnboardingState = { error?: string };

// ---------------- step 1: organization profile ----------------
const profileSchema = z.object({
  charityStatus: z.enum(["registered", "non_registered"]),
  craRegistrationNumber: z.string().max(20).optional(),
  authorizedSignatory: z.string().max(120).optional(),
  addressLine1: z.string().min(2, "Street address is required").max(200),
  city: z.string().min(1, "City is required").max(100),
  province: z.string().min(2, "Province is required").max(50),
  postalCode: z.string().min(3, "Postal code is required").max(10),
});

export async function saveOrgProfile(
  _prev: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  const session = await requireOrgAdmin();
  const parsed = profileSchema.safeParse({
    charityStatus: formData.get("charityStatus"),
    craRegistrationNumber: formData.get("craRegistrationNumber") || undefined,
    authorizedSignatory: formData.get("authorizedSignatory") || undefined,
    addressLine1: formData.get("addressLine1"),
    city: formData.get("city"),
    province: formData.get("province"),
    postalCode: formData.get("postalCode"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const d = parsed.data;
  if (d.charityStatus === "registered") {
    const bn = (d.craRegistrationNumber ?? "").replace(/\s/g, "").toUpperCase();
    if (!/^\d{9}RR\d{4}$/.test(bn)) {
      return { error: "Enter a valid CRA registration number, e.g. 123456789 RR 0001." };
    }
  }

  await withTenant(session.orgId, (tx) =>
    tx.organization.update({
      where: { id: session.orgId },
      data: {
        charityStatus: d.charityStatus,
        craRegistrationNumber: d.charityStatus === "registered" ? d.craRegistrationNumber : null,
        authorizedSignatory: d.authorizedSignatory || null,
        addressLine1: d.addressLine1,
        city: d.city,
        province: d.province,
        postalCode: d.postalCode,
        receiptLocality: `${d.city}, ${d.province}`,
      },
    })
  );
  redirect("/dashboard/onboarding?step=2");
}

// ---------------- step 2: branding (optional) ----------------
const brandingSchema = z.object({
  primaryColor: z
    .string()
    .regex(/^#?[0-9a-fA-F]{6}$/, "Brand color must be a 6-digit hex value")
    .optional(),
  logoUrl: z
    .string()
    .url("Logo must be a full https:// URL")
    .startsWith("https://", "Logo must be a full https:// URL")
    .max(500)
    .optional(),
  receiptMessage: z.string().max(300).optional(),
});

export async function saveBranding(
  _prev: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  const session = await requireOrgAdmin();
  const parsed = brandingSchema.safeParse({
    primaryColor: formData.get("primaryColor") || undefined,
    logoUrl: formData.get("logoUrl") || undefined,
    receiptMessage: formData.get("receiptMessage") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const color = parsed.data.primaryColor
    ? parsed.data.primaryColor.startsWith("#")
      ? parsed.data.primaryColor
      : `#${parsed.data.primaryColor}`
    : null;

  await withTenant(session.orgId, (tx) =>
    tx.organization.update({
      where: { id: session.orgId },
      data: {
        primaryColor: color,
        logoUrl: parsed.data.logoUrl || null,
        receiptMessage: parsed.data.receiptMessage || null,
      },
    })
  );
  redirect("/dashboard/onboarding?step=3");
}

// ---------------- step 3: plan selection → finish ----------------
export async function choosePlan(
  _prev: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  const session = await requireOrgAdmin();
  const plan = formData.get("plan");
  const cycle = formData.get("cycle") === "annual" ? "annual" : "monthly";
  if (!isPlanKey(plan)) return { error: "Choose a plan to continue." };

  await withTenant(session.orgId, async (tx) => {
    await tx.subscription.update({
      where: { orgId: session.orgId },
      data: { plan, cycle, priceCad: planPrice(plan, cycle) },
    });
    await tx.organization.update({
      where: { id: session.orgId },
      data: { onboardedAt: new Date() },
    });
  });
  revalidatePath("/dashboard");
  redirect("/dashboard");
}
