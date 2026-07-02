import { adminDb } from "@/lib/db";

function monthlyEquivalent(priceCad: number, cycle: string) {
  return cycle === "annual" ? priceCad / 12 : priceCad;
}

export async function getPlatformStats() {
  const [activeOrgs, totalOrgs, totalDonors, valueAgg, receipts, subs] = await Promise.all([
    adminDb.organization.count({ where: { status: "active" } }),
    adminDb.organization.count(),
    adminDb.donor.count(),
    adminDb.donation.aggregate({ _sum: { amount: true }, where: { status: "succeeded" } }),
    adminDb.receipt.count(),
    adminDb.subscription.findMany({ where: { status: { in: ["active", "trialing"] } } }),
  ]);

  const mrr = subs
    .filter((s) => s.status === "active")
    .reduce((sum, s) => sum + monthlyEquivalent(Number(s.priceCad), s.cycle), 0);

  return {
    activeOrgs,
    totalOrgs,
    totalDonors,
    totalValue: Number(valueAgg._sum.amount ?? 0),
    receipts,
    mrr,
    trialing: subs.filter((s) => s.status === "trialing").length,
  };
}

export async function listOrganizations() {
  const [orgs, sums] = await Promise.all([
    adminDb.organization.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { donors: true } }, subscription: true },
    }),
    adminDb.donation.groupBy({
      by: ["orgId"],
      _sum: { amount: true },
      where: { status: "succeeded" },
    }),
  ]);
  const raised = new Map(sums.map((s) => [s.orgId, Number(s._sum.amount ?? 0)]));

  return orgs.map((o) => ({
    id: o.id,
    name: o.name,
    slug: o.slug,
    charityStatus: o.charityStatus,
    status: o.status,
    donors: o._count.donors,
    raised: raised.get(o.id) ?? 0,
    plan: o.subscription?.plan ?? "—",
    subStatus: o.subscription?.status ?? "none",
    priceCad: o.subscription ? Number(o.subscription.priceCad) : 0,
    cycle: o.subscription?.cycle ?? "monthly",
  }));
}

/** Full management snapshot of one institution (platform view, bypasses RLS). */
export async function getOrgManage(orgId: string) {
  const org = await adminDb.organization.findUnique({
    where: { id: orgId },
    include: {
      subscription: true,
      _count: { select: { donors: true, donations: true, receipts: true, funds: true, users: true } },
    },
  });
  if (!org) return null;
  const raisedAgg = await adminDb.donation.aggregate({
    _sum: { amount: true },
    where: { orgId, status: "succeeded" },
  });
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    charityStatus: org.charityStatus,
    craRegistrationNumber: org.craRegistrationNumber,
    authorizedSignatory: org.authorizedSignatory,
    receiptLocality: org.receiptLocality,
    status: org.status,
    featureOverrides: org.featureOverrides,
    plan: org.subscription?.plan ?? "starter",
    subscription: org.subscription
      ? {
          plan: org.subscription.plan,
          cycle: org.subscription.cycle,
          price: Number(org.subscription.priceCad),
          status: org.subscription.status,
          trialEndsAt: org.subscription.trialEndsAt,
          nextBillingDate: org.subscription.nextBillingDate,
          currentPeriodEnd: org.subscription.currentPeriodEnd,
        }
      : null,
    counts: org._count,
    raised: Number(raisedAgg._sum.amount ?? 0),
  };
}

export type OrgManage = NonNullable<Awaited<ReturnType<typeof getOrgManage>>>;

export async function listOrgUsers(orgId: string) {
  const users = await adminDb.orgUser.findMany({
    where: { orgId },
    orderBy: { createdAt: "asc" },
  });
  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    lastLoginAt: u.lastLoginAt,
  }));
}

export async function listSubscriptions() {
  const subs = await adminDb.subscription.findMany({
    orderBy: { createdAt: "desc" },
    include: { org: true },
  });
  return subs.map((s) => ({
    id: s.id,
    org: s.org.name,
    plan: s.plan,
    cycle: s.cycle,
    price: Number(s.priceCad),
    status: s.status,
    nextBillingDate: s.nextBillingDate,
    trialEndsAt: s.trialEndsAt,
  }));
}
