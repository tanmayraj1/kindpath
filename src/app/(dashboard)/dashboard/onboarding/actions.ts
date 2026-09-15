"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withTenant } from "@/lib/tenant";
import { requireOrgAdmin } from "@/lib/auth/guards";
import { planPrice, isPlanKey } from "@/lib/plans";
import { PROVINCES } from "@/lib/tax";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/rate-limit";
import type { FieldErrors } from "@/lib/validation";
import { profileComplete } from "@/lib/onboarding";

export type OnboardingState = { error?: string; fields?: FieldErrors };

/** First zod issue → banner message + the field it belongs to, so `Field` can mark it. */
function firstIssue(err: z.ZodError): OnboardingState {
  const issue = err.issues[0];
  const message = issue?.message ?? "Invalid input";
  const path = issue?.path[0];
  return { error: message, fields: path ? { [String(path)]: message } : undefined };
}

// ---------------- step 1: organization profile ----------------
const PROVINCE_CODES = PROVINCES.map((p) => p.code) as [string, ...string[]];

const profileSchema = z.object({
  charityStatus: z.enum(["registered", "non_registered"]),
  craRegistrationNumber: z.string().max(20).optional(),
  authorizedSignatory: z.string().max(120).optional(),
  addressLine1: z.string().min(2, "Street address is required").max(200),
  city: z.string().min(1, "City is required").max(100),
  province: z.enum(PROVINCE_CODES, { message: "Choose a province or territory" }),
  postalCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z]\d[A-Za-z] ?\d[A-Za-z]\d$/, "Enter a valid postal code, e.g. M5V 2T6")
    .max(10),
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
  if (!parsed.success) return firstIssue(parsed.error);

  const d = parsed.data;
  // Normalized once here and stored normalized — the regex used to validate the
  // stripped form while the raw "123456789 RR 0001" was what got written, so the
  // same charity could exist in two spellings across receipts.
  let bn: string | null = null;
  if (d.charityStatus === "registered") {
    bn = (d.craRegistrationNumber ?? "").replace(/\s/g, "").toUpperCase();
    if (!/^\d{9}RR\d{4}$/.test(bn)) {
      const message = "Enter a valid CRA registration number, e.g. 123456789 RR 0001.";
      return { error: message, fields: { craRegistrationNumber: message } };
    }
  }
  const postalCode = d.postalCode.toUpperCase().replace(/^(\w{3}) ?(\w{3})$/, "$1 $2");

  await withTenant(session.orgId, (tx) =>
    tx.organization.update({
      where: { id: session.orgId },
      data: {
        charityStatus: d.charityStatus,
        craRegistrationNumber: bn,
        authorizedSignatory: d.authorizedSignatory || null,
        addressLine1: d.addressLine1,
        city: d.city,
        province: d.province,
        postalCode,
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
  if (!parsed.success) return firstIssue(parsed.error);

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

// ---------------- step 3: plan selection ----------------
export async function choosePlan(
  _prev: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  const session = await requireOrgAdmin();
  const plan = formData.get("plan");
  const cycle = formData.get("cycle") === "annual" ? "annual" : "monthly";
  if (!isPlanKey(plan)) return { error: "Choose a plan to continue." };

  await withTenant(session.orgId, (tx) =>
    tx.subscription.update({
      where: { orgId: session.orgId },
      data: { plan, cycle, priceCad: planPrice(plan, cycle) },
    })
  );
  // Used to set onboardedAt here. An org is not "set up" until it can receive
  // money, and nothing in steps 1–3 touches the gateway — see step 4.
  redirect("/dashboard/onboarding?step=4");
}

// ---------------- step 4: gateway → finish ----------------
/**
 * Mark onboarding complete.
 *
 * Requires the profile (step 1) — that check is the guarantee; the page-level
 * redirect to step 1 is only the UX. Requires a readable gateway unless the org
 * explicitly skipped; the skip is recorded in the audit log because "why didn't
 * our donations arrive" is the support question this answers.
 */
async function completeOnboarding(opts: { skipGateway: boolean }): Promise<OnboardingState> {
  const session = await requireOrgAdmin();
  const { describeOrgGatewayCredentials } = await import("@/lib/payments/org-credentials");

  const [org, gateway] = await Promise.all([
    withTenant(session.orgId, (tx) =>
      tx.organization.findUnique({
        where: { id: session.orgId },
        select: {
          onboardedAt: true,
          name: true,
          slug: true,
          addressLine1: true,
          city: true,
          province: true,
          postalCode: true,
        },
      })
    ),
    describeOrgGatewayCredentials(session.orgId),
  ]);

  if (!org) return { error: "Organization not found." };
  if (!profileComplete(org)) {
    return { error: "Add your organization's address first — it has to appear on every receipt." };
  }

  const connected = gateway.configured && !gateway.error;
  if (!connected && !opts.skipGateway) {
    return {
      error: gateway.error
        ? "Your stored gateway credentials can't be read. Reconnect above, or skip for now."
        : "Connect your WeVend merchant account above, or choose to skip for now.",
    };
  }

  if (!org.onboardedAt) {
    await withTenant(session.orgId, (tx) =>
      tx.organization.update({ where: { id: session.orgId }, data: { onboardedAt: new Date() } })
    );
    await audit({
      actor: { type: "org_user", id: session.sub },
      orgId: session.orgId,
      action: "org.onboarding.completed",
      entityType: "organization",
      entityId: session.orgId,
      after: { gatewayConnected: connected, gatewayProvider: connected ? gateway.provider : null },
      ip: clientIp(),
    });

    // Inside the first-completion branch so a double submit can't send it twice.
    const admin = await withTenant(session.orgId, (tx) =>
      tx.orgUser.findUnique({ where: { id: session.sub }, select: { email: true, name: true } })
    );
    if (admin) {
      const { sendOnboardingCompleteEmail } = await import("@/lib/onboarding-email");
      await sendOnboardingCompleteEmail({
        to: admin.email,
        name: admin.name,
        orgName: org.name,
        slug: org.slug,
        gatewayConnected: connected,
        orgId: session.orgId,
      });
    }
  }

  revalidatePath("/dashboard");
  return {};
}

export async function finishOnboarding(
  _prev: OnboardingState,
  _formData: FormData
): Promise<OnboardingState> {
  const result = await completeOnboarding({ skipGateway: false });
  if (result.error) return result;
  redirect("/dashboard/onboarding/done");
}

/**
 * The explicit skip. Returns rather than redirects: it runs from an ActionButton
 * behind a confirm dialog, and that component treats a thrown redirect as a
 * failure — the caller navigates on `ok`.
 */
export async function skipGatewayAndFinish(): Promise<{ ok?: boolean; error?: string }> {
  const result = await completeOnboarding({ skipGateway: true });
  if (result.error) return { error: result.error };
  return { ok: true };
}
