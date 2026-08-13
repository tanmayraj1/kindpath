import type { Prisma } from "@prisma/client";
import { withTenant } from "@/lib/tenant";
import { paged, type PageParams } from "@/lib/pagination";

export function listPledges(orgId: string, page?: PageParams) {
  return withTenant(orgId, async (tx) => {
    const q = page?.q ?? "";
    const where: Prisma.PledgeWhereInput = q
      ? {
          OR: [
            { donorName: { contains: q, mode: "insensitive" as const } },
            { donorEmail: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {};

    // The headline totals cover EVERY pledge, not just the page on screen — a
    // total that changed as you paged would be worse than no total at all.
    const [total, pledges, campaigns, sums] = await Promise.all([
      tx.pledge.count({ where }),
      tx.pledge.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: { campaign: true },
        ...(page ? { skip: page.skip, take: page.size } : {}),
      }),
      tx.campaign.findMany({ select: { id: true, title: true }, take: 200 }),
      tx.pledge.groupBy({ by: ["status"], _sum: { amount: true } }),
    ]);

    const byStatus = new Map(sums.map((s) => [s.status, Number(s._sum.amount ?? 0)]));
    const totals = { open: byStatus.get("open") ?? 0, fulfilled: byStatus.get("fulfilled") ?? 0 };

    const rows = pledges.map((p) => ({
        id: p.id,
        donorName: p.donorName,
        donorEmail: p.donorEmail,
        amount: Number(p.amount),
        status: p.status,
        campaign: p.campaign?.title ?? null,
        dueDate: p.dueDate,
      note: p.note,
    }));

    return {
      pledges: page
        ? paged(rows, total, page)
        : paged(rows, total, { page: 1, size: rows.length || 1, q: "", skip: 0 }),
      totals,
      campaigns: campaigns.map((c) => ({ id: c.id, title: c.title })),
    };
  });
}
