import type { NotificationStatus } from "@prisma/client";
import { withTenant } from "@/lib/tenant";
import { countSegments } from "@/lib/segments";

/** Recipient counts per segment (CASL-consented only) + recent campaign sends. */
export async function getCommsData(orgId: string) {
  return withTenant(orgId, async (tx) => {
    const { counts, totalConsented } = await countSegments(tx);

    const recent = await tx.notification.findMany({
      where: { category: "marketing" },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { sentAt: true, createdAt: true, payload: true, status: true },
    });

    return { counts, totalConsented, recent };
  });
}

/**
 * Transactional messages that did NOT reach the donor.
 *
 * These rows were written and never read anywhere — a receipt email that failed
 * was recorded as failed and then silently forgotten, so a donor could be left
 * without the tax receipt they're legally owed and nobody would know. This is
 * the query that makes them visible.
 */
export async function getDeliveryFailures(orgId: string, limit = 25) {
  return withTenant(orgId, async (tx) => {
    // Undelivered = failed outright, or still queued (the flush never completed).
    const where = {
      status: { in: ["failed", "queued"] as NotificationStatus[] },
      category: { not: "marketing" },
    };
    const [rows, total] = await Promise.all([
      tx.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          category: true,
          status: true,
          createdAt: true,
          payload: true,
          donorId: true,
        },
      }),
      tx.notification.count({ where }),
    ]);

    const donorIds = rows.map((r) => r.donorId).filter((d): d is string => !!d);
    const donors = donorIds.length
      ? await tx.donor.findMany({
          where: { id: { in: donorIds } },
          select: { id: true, firstName: true, lastName: true, email: true },
        })
      : [];
    const byId = new Map(donors.map((d) => [d.id, d]));

    return {
      total,
      rows: rows.map((r) => {
        const donor = r.donorId ? byId.get(r.donorId) : undefined;
        const payload = (r.payload ?? {}) as { subject?: string; error?: string };
        return {
          id: r.id,
          category: r.category,
          status: r.status,
          createdAt: r.createdAt,
          subject: payload.subject ?? "(no subject)",
          error: payload.error ?? null,
          donorName: donor ? `${donor.firstName} ${donor.lastName}` : "—",
          donorEmail: donor?.email ?? null,
        };
      }),
    };
  });
}

/** Count only — cheap enough for the dashboard overview. */
export async function countDeliveryFailures(orgId: string): Promise<number> {
  return withTenant(orgId, (tx) =>
    tx.notification.count({
      where: {
        status: { in: ["failed", "queued"] as NotificationStatus[] },
        category: { not: "marketing" },
      },
    })
  );
}
