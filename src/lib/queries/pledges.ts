import { withTenant } from "@/lib/tenant";

export function listPledges(orgId: string) {
  return withTenant(orgId, async (tx) => {
    const [pledges, campaigns] = await Promise.all([
      tx.pledge.findMany({ orderBy: { createdAt: "desc" }, include: { campaign: true } }),
      tx.campaign.findMany({ select: { id: true, title: true } }),
    ]);
    const totals = { open: 0, fulfilled: 0 };
    for (const p of pledges) {
      if (p.status === "open") totals.open += Number(p.amount);
      if (p.status === "fulfilled") totals.fulfilled += Number(p.amount);
    }
    return {
      pledges: pledges.map((p) => ({
        id: p.id,
        donorName: p.donorName,
        donorEmail: p.donorEmail,
        amount: Number(p.amount),
        status: p.status,
        campaign: p.campaign?.title ?? null,
        dueDate: p.dueDate,
        note: p.note,
      })),
      totals,
      campaigns: campaigns.map((c) => ({ id: c.id, title: c.title })),
    };
  });
}
