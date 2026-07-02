import { withTenant } from "@/lib/tenant";
import { loadConsentedDonors, filterSegment, SEGMENTS, type SegmentKey } from "@/lib/segments";

/** Recipient counts per segment (CASL-consented only) + recent campaign sends. */
export async function getCommsData(orgId: string) {
  return withTenant(orgId, async (tx) => {
    const donors = await loadConsentedDonors(tx);
    const counts = Object.fromEntries(
      SEGMENTS.map((s) => [s.key, filterSegment(donors, s.key).length])
    ) as Record<SegmentKey, number>;

    const recent = await tx.notification.findMany({
      where: { category: "marketing" },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { sentAt: true, createdAt: true, payload: true, status: true },
    });

    return { counts, totalConsented: donors.length, recent };
  });
}
