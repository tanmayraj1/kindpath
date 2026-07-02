import { withTenant } from "@/lib/tenant";
import { adminDb } from "@/lib/db";

export function listMembershipPlans(orgId: string) {
  return withTenant(orgId, async (tx) => {
    const plans = await tx.membershipPlan.findMany({
      orderBy: { amount: "asc" },
      include: { _count: { select: { plans: { where: { status: "active" } } } } },
    });
    return plans.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      amount: Number(p.amount),
      frequency: p.frequency,
      isActive: p.isActive,
      members: p._count.plans,
    }));
  });
}

export function listMembers(orgId: string) {
  return withTenant(orgId, async (tx) => {
    const plans = await tx.recurringPlan.findMany({
      where: { membershipPlanId: { not: null } },
      orderBy: { startedAt: "desc" },
      include: { donor: true, membershipPlan: true },
    });
    return plans.map((p) => ({
      id: p.id,
      member: `${p.donor.firstName} ${p.donor.lastName}`,
      email: p.donor.email,
      plan: p.membershipPlan?.name ?? "—",
      amount: Number(p.amount),
      frequency: p.frequency,
      status: p.status,
      since: p.startedAt,
      nextBillingDate: p.nextBillingDate,
    }));
  });
}

/** Public: active membership plans for an org's join page. */
export async function getPublicMembership(slug: string) {
  const org = await adminDb.organization.findUnique({
    where: { slug },
    include: { membershipPlans: { where: { isActive: true }, orderBy: { amount: "asc" } } },
  });
  if (!org || org.status !== "active") return null;
  return {
    org: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      charityStatus: org.charityStatus,
      primaryColor: org.primaryColor,
      logoUrl: org.logoUrl,
    },
    plans: org.membershipPlans.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      amount: Number(p.amount),
      frequency: p.frequency,
    })),
  };
}
