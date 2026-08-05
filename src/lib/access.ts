import { redirect } from "next/navigation";
import { withTenant } from "@/lib/tenant";
import { getEffectiveFeatures, type FeatureKey } from "@/lib/features";
import { GRACE_DAYS } from "@/lib/subscriptions";

export type BillingState = "trialing" | "active" | "grace" | "locked" | "none";

export type OrgAccess = {
  /** May the org use the product at all? */
  active: boolean;
  status: string;
  subscriptionStatus: string | null;
  plan: string;
  features: Record<FeatureKey, boolean>;
  /** Billing lifecycle, for the banner the org sees. */
  billing: BillingState;
  /** Days left in a trial or the past-due grace window; null when not counting down. */
  daysLeft: number | null;
};

const DAY_MS = 86_400_000;

function daysBetween(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / DAY_MS);
}

/**
 * Effective access + feature state for an org.
 *
 * Billing is enforced here, but deliberately gently. `past_due` no longer counts
 * as fully active — it previously did, which is why a signup got a permanent
 * free account — yet an unpaid invoice does NOT immediately cut a charity off:
 * they get a visible countdown for GRACE_DAYS first. Only a cancelled
 * subscription or a suspended organization actually locks the product, and even
 * then the data is retained, not deleted.
 */
export async function getOrgAccess(orgId: string, now = new Date()): Promise<OrgAccess> {
  return withTenant(orgId, async (tx) => {
    const org = await tx.organization.findUnique({
      where: { id: orgId },
      include: { subscription: true },
    });

    const plan = org?.subscription?.plan ?? "starter";
    const subStatus = org?.subscription?.status ?? null;
    const features = getEffectiveFeatures(plan, org?.featureOverrides);
    const orgActive = org?.status === "active";

    let billing: BillingState = "none";
    let daysLeft: number | null = null;

    if (subStatus === "trialing") {
      billing = "trialing";
      daysLeft = org?.subscription?.trialEndsAt
        ? Math.max(0, daysBetween(now, org.subscription.trialEndsAt))
        : null;
    } else if (subStatus === "active") {
      billing = "active";
    } else if (subStatus === "past_due") {
      const since = org?.subscription?.currentPeriodStart ?? org?.subscription?.updatedAt ?? now;
      const remaining = GRACE_DAYS - daysBetween(since, now);
      billing = remaining > 0 ? "grace" : "locked";
      daysLeft = Math.max(0, remaining);
    } else if (subStatus === "cancelled") {
      billing = "locked";
    }

    return {
      active: orgActive && billing !== "locked",
      status: org?.status ?? "active",
      subscriptionStatus: subStatus,
      plan,
      features,
      billing,
      daysLeft,
    };
  });
}

/** Page guard: redirect to the upgrade notice if a feature is disabled for the org. */
export async function assertFeature(orgId: string, key: FeatureKey) {
  const access = await getOrgAccess(orgId);
  // A locked org lands on the dashboard shell, which renders the lock screen
  // (with the outstanding invoice) instead of the app.
  if (access.billing === "locked") redirect("/dashboard");
  if (!access.features[key]) redirect(`/dashboard/upgrade?feature=${key}`);
}

/**
 * Guard for anything that takes money or issues a tax receipt.
 *
 * Kept separate from assertFeature on purpose: even when a subscription lapses,
 * the org must still be able to read its records and export its data. What stops
 * is creating NEW obligations.
 */
export async function assertBillingActive(orgId: string) {
  const access = await getOrgAccess(orgId);
  if (access.billing === "locked") redirect("/dashboard");
}
