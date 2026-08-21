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

    // Bucket in Postgres, not in JS. This used to load EVERY donation of the last
    // twelve months and EVERY donor row just to produce twelve numbers, five names
    // and a count — inside `withTenant`'s single 5s transaction, so a charity with
    // real history didn't get a slow report, it got P2028 and no report at all.
    const [monthRows, topSums, totalDonors] = await Promise.all([
      tx.$queryRaw<{ month: Date; total: number }[]>`
        SELECT date_trunc('month', received_at) AS month,
               SUM(eligible_amount)::float8      AS total
        FROM donations
        WHERE status = 'succeeded' AND received_at >= ${since}
        GROUP BY 1
      `,
      tx.donation.groupBy({
        by: ["donorId"],
        _sum: { eligibleAmount: true },
        where: { status: "succeeded" },
        orderBy: { _sum: { eligibleAmount: "desc" } },
        take: 5,
      }),
      tx.donor.count(),
    ]);

    const totalByMonth = new Map(
      monthRows.map((r) => {
        const d = new Date(r.month);
        return [`${d.getFullYear()}-${d.getMonth()}`, Number(r.total)];
      })
    );
    const months: { label: string; total: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        label: d.toLocaleDateString("en-CA", { month: "short" }),
        total: totalByMonth.get(`${d.getFullYear()}-${d.getMonth()}`) ?? 0,
      });
    }

    // Only the five donors actually shown need names, rather than the whole table.
    const topIds = topSums.map((t) => t.donorId);
    const topNames = topIds.length
      ? await tx.donor.findMany({
          where: { id: { in: topIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
    const nameById = new Map(topNames.map((d) => [d.id, `${d.firstName} ${d.lastName}`]));
    const topDonors = topSums.map((t) => ({
      name: nameById.get(t.donorId) ?? "Donor",
      total: Number(t._sum.eligibleAmount ?? 0),
    }));

    return { months, topDonors, totalDonors };
  });
}

/** All metrics for the org overview, fetched under RLS tenant context. */
export async function getOrgDashboard(orgId: string) {
  return withTenant(orgId, async (tx) => {
    const monthStart = startOfMonth();
    // The honest comparison is same-period: the first N days of last month
    // against the first N days of this one. Comparing a full last month against
    // a partial current month would show every org "down" for three weeks out
    // of four.
    const now = new Date();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthSamePoint = new Date(
      lastMonthStart.getTime() + (now.getTime() - monthStart.getTime())
    );

    // Twelve weekly buckets for the overview sparkline. One indexed aggregate
    // that returns at most twelve rows — deliberately not the twelve-month
    // report query, which this page doesn't need, and deliberately not "load the
    // donations and bucket them in JS", which is what this file's report query
    // had to be rewritten to stop doing (see getReportData). Everything in here
    // shares withTenant's single 5s transaction, so an unbounded read is not a
    // slow dashboard, it's a P2028 and no dashboard.
    const trendSince = new Date(now.getTime() - 12 * 7 * 24 * 60 * 60 * 1000);

    const [org, totalDonors, activeRecurring, receiptsIssued, raisedAgg, lastMonthAgg, recent, funds, trendRows] =
      await Promise.all([
        tx.organization.findUnique({ where: { id: orgId } }),
        tx.donor.count(),
        tx.recurringPlan.count({ where: { status: "active" } }),
        tx.receipt.count({ where: { status: "issued" } }),
        tx.donation.aggregate({
          _sum: { amount: true },
          where: { status: "succeeded", receivedAt: { gte: monthStart } },
        }),
        tx.donation.aggregate({
          _sum: { amount: true },
          where: {
            status: "succeeded",
            receivedAt: { gte: lastMonthStart, lt: lastMonthSamePoint },
          },
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
        tx.$queryRaw<{ week: Date; total: number }[]>`
          SELECT date_trunc('week', received_at) AS week,
                 SUM(amount)::float8            AS total
          FROM donations
          WHERE status = 'succeeded' AND received_at >= ${trendSince}
          GROUP BY 1
          ORDER BY 1
        `,
      ]);

    // Fill the gaps: a week with no gifts must read as zero, not be missing —
    // otherwise the sparkline silently compresses a quiet month out of view and
    // a flat quarter looks like a busy one.
    const byWeek = new Map(
      trendRows.map((r) => {
        const d = new Date(r.week);
        return [`${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`, Number(r.total)];
      })
    );
    const trend: number[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const monday = new Date(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
      );
      trend.push(
        byWeek.get(`${monday.getUTCFullYear()}-${monday.getUTCMonth()}-${monday.getUTCDate()}`) ?? 0
      );
    }

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
      trend,
      stats: {
        raisedThisMonth: Number(raisedAgg._sum.amount ?? 0),
        raisedLastMonthSamePoint: Number(lastMonthAgg._sum.amount ?? 0),
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
