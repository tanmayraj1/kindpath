import { Prisma } from "@prisma/client";

export type SegmentKey = "all" | "recurring" | "high_value" | "lapsed";

export const SEGMENTS: { key: SegmentKey; label: string; description: string }[] = [
  { key: "all", label: "All consented donors", description: "Everyone who opted in to email." },
  { key: "recurring", label: "Recurring donors", description: "Donors with an active recurring plan." },
  { key: "high_value", label: "High-value donors", description: "Lifetime giving of $500 or more." },
  { key: "lapsed", label: "Lapsed donors", description: "No gift in the last 6 months." },
];

const HIGH_VALUE = 500;
const LAPSED_DAYS = 182; // ~6 months

export type SegmentRecipient = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

/**
 * Segment membership, computed in Postgres.
 *
 * This used to load every consented donor WITH every one of their donations and
 * reduce in JavaScript. It backed both the communications page and the campaign
 * sender, so an organization with a few thousand donors and real giving history
 * didn't render slowly — `withTenant` runs on one interactive transaction with a
 * 5s timeout, so the page threw P2028 and the feature was simply gone.
 *
 * Everything below is a single aggregate over indexed columns. RLS still applies:
 * these run inside `withTenant`, which sets app.current_org_id for the transaction,
 * and the policies are enforced by Postgres regardless of how the SQL was written.
 */

/**
 * Per-donor rollup shared by the count and the recipient queries, so the two can
 * never disagree about who is in a segment.
 */
function baseCte() {
  return Prisma.sql`
    WITH base AS (
      SELECT
        d.id,
        d.first_name,
        d.last_name,
        d.email,
        COALESCE(SUM(dn.eligible_amount) FILTER (WHERE dn.status = 'succeeded'), 0) AS lifetime,
        MAX(dn.received_at) FILTER (WHERE dn.status = 'succeeded') AS last_gift_at,
        EXISTS (
          SELECT 1 FROM recurring_plans rp
          WHERE rp.donor_id = d.id AND rp.status = 'active'
        ) AS recurring_active
      FROM donors d
      LEFT JOIN donations dn ON dn.donor_id = d.id
      WHERE d.casl_consent_status <> 'none'
        AND d.email_marketing_opt_in = true
        AND d.anonymized_at IS NULL
      GROUP BY d.id, d.first_name, d.last_name, d.email
    )`;
}

/** SQL predicate for one segment, against the `base` CTE above. */
function segmentPredicate(segment: SegmentKey): Prisma.Sql {
  switch (segment) {
    case "recurring":
      return Prisma.sql`recurring_active`;
    case "high_value":
      return Prisma.sql`lifetime >= ${HIGH_VALUE}`;
    case "lapsed":
      // A donor who has never given is lapsed by definition — they are exactly
      // the group a re-engagement campaign is aimed at.
      return Prisma.sql`(last_gift_at IS NULL OR last_gift_at < NOW() - ${`${LAPSED_DAYS} days`}::interval)`;
    case "all":
    default:
      return Prisma.sql`TRUE`;
  }
}

/** Recipient counts for every segment, in one round trip. */
export async function countSegments(
  tx: Prisma.TransactionClient
): Promise<{ counts: Record<SegmentKey, number>; totalConsented: number }> {
  const rows = await tx.$queryRaw<
    { all: bigint; recurring: bigint; high_value: bigint; lapsed: bigint }[]
  >(Prisma.sql`
    ${baseCte()}
    SELECT
      COUNT(*)                                                   AS all,
      COUNT(*) FILTER (WHERE ${segmentPredicate("recurring")})   AS recurring,
      COUNT(*) FILTER (WHERE ${segmentPredicate("high_value")})  AS high_value,
      COUNT(*) FILTER (WHERE ${segmentPredicate("lapsed")})      AS lapsed
    FROM base
  `);

  // COUNT() always returns a row, but an empty result must not crash the page.
  const r = rows[0];
  const counts: Record<SegmentKey, number> = {
    all: Number(r?.all ?? 0),
    recurring: Number(r?.recurring ?? 0),
    high_value: Number(r?.high_value ?? 0),
    lapsed: Number(r?.lapsed ?? 0),
  };
  return { counts, totalConsented: counts.all };
}

/** How many donors a send to this segment would reach. */
export async function countSegment(
  tx: Prisma.TransactionClient,
  segment: SegmentKey
): Promise<number> {
  const rows = await tx.$queryRaw<{ n: bigint }[]>(Prisma.sql`
    ${baseCte()}
    SELECT COUNT(*) AS n FROM base WHERE ${segmentPredicate(segment)}
  `);
  return Number(rows[0]?.n ?? 0);
}

/**
 * One page of recipients, ordered by id so paging is stable across calls.
 *
 * `afterId` is a keyset cursor rather than an OFFSET: the campaign sender walks
 * the whole segment across many cron ticks, and OFFSET would re-scan everything
 * it had already sent on each pass.
 */
export async function loadSegmentRecipients(
  tx: Prisma.TransactionClient,
  segment: SegmentKey,
  opts: { take: number; afterId?: string | null }
): Promise<SegmentRecipient[]> {
  const cursor = opts.afterId ? Prisma.sql`AND id > ${opts.afterId}` : Prisma.empty;
  return tx.$queryRaw<SegmentRecipient[]>(Prisma.sql`
    ${baseCte()}
    SELECT id, first_name AS "firstName", last_name AS "lastName", email
    FROM base
    WHERE ${segmentPredicate(segment)} ${cursor}
    ORDER BY id
    LIMIT ${opts.take}
  `);
}
