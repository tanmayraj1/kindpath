import { withTenant } from "@/lib/tenant";

function startOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

const PLAN_LIMITS: Record<string, number> = {
  starter: 250,
  community: 1500,
  enterprise: 100000,
};

/** Donor-count usage vs the org's plan limit (for the sidebar meter). */
export async function getOrgPlanUsage(orgId: string) {
  return withTenant(orgId, async (tx) => {
    const [sub, donors] = await Promise.all([
      tx.subscription.findUnique({ where: { orgId } }),
      tx.donor.count(),
    ]);
    const plan = sub?.plan ?? "starter";
    const limit = PLAN_LIMITS[plan] ?? 250;
    return { plan, donors, limit, pct: Math.round((donors / limit) * 100) };
  });
}

export type OrgDashboard = Awaited<ReturnType<typeof getOrgDashboard>>;

/** Reporting data: 12-month giving trend, top donors, new vs returning. */
export async function getReportData(orgId: string) {
  return withTenant(orgId, async (tx) => {
    const now = new Date();
    const since = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const [donations, topSums, donors] = await Promise.all([
      tx.donation.findMany({
        where: { status: "succeeded", receivedAt: { gte: since } },
        select: { eligibleAmount: true, receivedAt: true, donorId: true },
      }),
      tx.donation.groupBy({
        by: ["donorId"],
        _sum: { eligibleAmount: true },
        where: { status: "succeeded" },
        orderBy: { _sum: { eligibleAmount: "desc" } },
        take: 5,
      }),
      tx.donor.findMany({ select: { id: true, firstName: true, lastName: true } }),
    ]);

    // bucket into the last 12 calendar months
    const months: { label: string; total: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ label: d.toLocaleDateString("en-CA", { month: "short" }), total: 0 });
    }
    const baseIdx = (d: Date) =>
      (d.getFullYear() - since.getFullYear()) * 12 + (d.getMonth() - since.getMonth());
    for (const dn of donations) {
      const idx = baseIdx(new Date(dn.receivedAt));
      if (idx >= 0 && idx < 12) months[idx].total += Number(dn.eligibleAmount);
    }

    const nameById = new Map(donors.map((d) => [d.id, `${d.firstName} ${d.lastName}`]));
    const topDonors = topSums.map((t) => ({
      name: nameById.get(t.donorId) ?? "Donor",
      total: Number(t._sum.eligibleAmount ?? 0),
    }));

    return { months, topDonors, totalDonors: donors.length };
  });
}

/** All metrics for the org overview, fetched under RLS tenant context. */
export async function getOrgDashboard(orgId: string) {
  return withTenant(orgId, async (tx) => {
    const monthStart = startOfMonth();

    const [org, totalDonors, activeRecurring, receiptsIssued, raisedAgg, recent, funds] =
      await Promise.all([
        tx.organization.findUnique({ where: { id: orgId } }),
        tx.donor.count(),
        tx.recurringPlan.count({ where: { status: "active" } }),
        tx.receipt.count({ where: { status: "issued" } }),
        tx.donation.aggregate({
          _sum: { amount: true },
          where: { status: "succeeded", receivedAt: { gte: monthStart } },
        }),
        tx.donation.findMany({
          where: {},
          orderBy: { receivedAt: "desc" },
          take: 6,
          include: { donor: true, fund: true },
        }),
        tx.donation.groupBy({
          by: ["fundId"],
          _sum: { amount: true },
          where: { status: "succeeded", receivedAt: { gte: monthStart } },
        }),
      ]);

    // resolve fund names for the breakdown
    const fundRows = await tx.fund.findMany();
    const fundName = new Map(fundRows.map((f) => [f.id, f.name]));
    const fundTotal = funds.reduce((s, f) => s + Number(f._sum.amount ?? 0), 0);

    return {
      org: {
        name: org?.name ?? "Your organization",
        charityStatus: org?.charityStatus,
        onboardedAt: org?.onboardedAt ?? null,
      },
      stats: {
        raisedThisMonth: Number(raisedAgg._sum.amount ?? 0),
        activeRecurring,
        totalDonors,
        receiptsIssued,
      },
      recent: recent.map((d) => ({
        donor: `${d.donor.firstName} ${d.donor.lastName}`,
        fund: d.fund?.name ?? "—",
        amount: Number(d.amount),
        type: d.type,
        status: d.status,
      })),
      funds: funds
        .map((f) => ({
          name: f.fundId ? fundName.get(f.fundId) ?? "Unassigned" : "Unassigned",
          amount: Number(f._sum.amount ?? 0),
          pct: fundTotal ? Math.round((Number(f._sum.amount ?? 0) / fundTotal) * 100) : 0,
        }))
        .sort((a, b) => b.amount - a.amount),
      fundTotal,
    };
  });
}
