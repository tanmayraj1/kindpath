import { withTenant } from "@/lib/tenant";
import { adminDb } from "@/lib/db";

function raisedMap(rows: { campaignId: string | null; _sum: { amount: unknown } }[]) {
  const m = new Map<string, number>();
  for (const r of rows) if (r.campaignId) m.set(r.campaignId, Number(r._sum.amount ?? 0));
  return m;
}

export function listFundsForOrg(orgId: string) {
  return withTenant(orgId, async (tx) => {
    const funds = await tx.fund.findMany({ where: { isActive: true }, orderBy: { createdAt: "asc" } });
    return funds.map((f) => ({ id: f.id, name: f.name }));
  });
}

export function listCampaigns(orgId: string) {
  return withTenant(orgId, async (tx) => {
    const [campaigns, sums] = await Promise.all([
      tx.campaign.findMany({ orderBy: { createdAt: "desc" }, include: { fund: true } }),
      tx.donation.groupBy({
        by: ["campaignId"],
        _sum: { amount: true },
        where: { status: "succeeded", campaignId: { not: null } },
      }),
    ]);
    const raised = raisedMap(sums);
    return campaigns.map((c) => ({
      id: c.id,
      title: c.title,
      slug: c.slug,
      fund: c.fund?.name ?? null,
      goal: Number(c.goalAmount),
      raised: raised.get(c.id) ?? 0,
      status: c.status,
      deadline: c.deadline,
      accent: c.accent,
      // Needed to prefill the editor; a form that silently dropped the fund or
      // description on save would be worse than no editor at all.
      fundId: c.fundId,
      description: c.description,
    }));
  });
}

export function getCampaign(orgId: string, id: string) {
  return withTenant(orgId, async (tx) => {
    const c = await tx.campaign.findFirst({ where: { id }, include: { fund: true } });
    if (!c) return null;
    const [agg, donations, donorCount] = await Promise.all([
      tx.donation.aggregate({ _sum: { amount: true }, where: { campaignId: id, status: "succeeded" } }),
      tx.donation.findMany({
        where: { campaignId: id, status: "succeeded" },
        orderBy: { receivedAt: "desc" },
        take: 10,
        include: { donor: true },
      }),
      // One integer, counted in Postgres. `findMany({ distinct })` materialized a
      // row per contributing donor purely to read its length.
      tx.$queryRaw<{ n: bigint }[]>`
        SELECT COUNT(DISTINCT donor_id) AS n
        FROM donations
        WHERE campaign_id = ${id} AND status = 'succeeded'
      `,
    ]);
    return {
      id: c.id,
      title: c.title,
      slug: c.slug,
      description: c.description,
      fund: c.fund?.name ?? null,
      goal: Number(c.goalAmount),
      raised: Number(agg._sum.amount ?? 0),
      status: c.status,
      deadline: c.deadline,
      accent: c.accent,
      donorCount: Number(donorCount[0]?.n ?? 0),
      recent: donations.map((d) => ({
        donor: `${d.donor.firstName} ${d.donor.lastName}`,
        amount: Number(d.amount),
        date: d.receivedAt,
      })),
    };
  });
}

/** Public campaign by org slug + campaign slug (no session). */
export async function getPublicCampaign(orgSlug: string, campaignSlug: string) {
  const org = await adminDb.organization.findUnique({
    where: { slug: orgSlug },
    include: {
      funds: { where: { isActive: true } },
      campaigns: { where: { slug: campaignSlug } },
    },
  });
  if (!org || org.status !== "active") return null;
  const campaign = org.campaigns[0];
  if (!campaign || campaign.status !== "active") return null;

  const agg = await adminDb.donation.aggregate({
    _sum: { amount: true },
    where: { campaignId: campaign.id, status: "succeeded" },
  });

  return {
    org: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      charityStatus: org.charityStatus,
      primaryColor: org.primaryColor,
      logoUrl: org.logoUrl,
      funds: org.funds.map((f) => ({ id: f.id, name: f.name })),
    },
    campaign: {
      id: campaign.id,
      title: campaign.title,
      slug: campaign.slug,
      description: campaign.description,
      goal: Number(campaign.goalAmount),
      raised: Number(agg._sum.amount ?? 0),
      deadline: campaign.deadline,
      accent: campaign.accent,
      fundId: campaign.fundId,
    },
  };
}
