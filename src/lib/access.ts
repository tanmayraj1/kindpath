import { redirect } from "next/navigation";
import { withTenant } from "@/lib/tenant";
import { getEffectiveFeatures, type FeatureKey } from "@/lib/features";

export type OrgAccess = {
  active: boolean;
  status: string;
  subscriptionStatus: string | null;
  plan: string;
  features: Record<FeatureKey, boolean>;
};

/** Effective access + feature state for an org (used to gate the org app). */
export async function getOrgAccess(orgId: string): Promise<OrgAccess> {
  return withTenant(orgId, async (tx) => {
    const org = await tx.organization.findUnique({
      where: { id: orgId },
      include: { subscription: true },
    });
    const plan = org?.subscription?.plan ?? "starter";
    return {
      active: org?.status === "active" && org?.subscription?.status !== "cancelled",
      status: org?.status ?? "active",
      subscriptionStatus: org?.subscription?.status ?? null,
      plan,
      features: getEffectiveFeatures(plan, org?.featureOverrides),
    };
  });
}

/** Page guard: redirect to the upgrade notice if a feature is disabled for the org. */
export async function assertFeature(orgId: string, key: FeatureKey) {
  const { features } = await getOrgAccess(orgId);
  if (!features[key]) redirect(`/dashboard/upgrade?feature=${key}`);
}
