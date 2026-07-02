import type { Prisma } from "@prisma/client";

export type SegmentKey = "all" | "recurring" | "high_value" | "lapsed";

export const SEGMENTS: { key: SegmentKey; label: string; description: string }[] = [
  { key: "all", label: "All consented donors", description: "Everyone who opted in to email." },
  { key: "recurring", label: "Recurring donors", description: "Donors with an active recurring plan." },
  { key: "high_value", label: "High-value donors", description: "Lifetime giving of $500 or more." },
  { key: "lapsed", label: "Lapsed donors", description: "No gift in the last 6 months." },
];

const HIGH_VALUE = 500;
const LAPSED_MS = 1000 * 60 * 60 * 24 * 182; // ~6 months

type LoadedDonor = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  lifetime: number;
  lastGiftAt: Date | null;
  recurringActive: boolean;
};

/**
 * Load donors who have given CASL consent AND opted in to email — the only
 * people we may send marketing/announcements to.
 */
export async function loadConsentedDonors(tx: Prisma.TransactionClient): Promise<LoadedDonor[]> {
  const donors = await tx.donor.findMany({
    where: { caslConsent: { not: "none" }, emailMarketingOptIn: true },
    include: {
      donations: { where: { status: "succeeded" }, select: { eligibleAmount: true, receivedAt: true } },
      recurringPlans: { where: { status: "active" }, select: { id: true } },
    },
  });
  return donors.map((d) => ({
    id: d.id,
    firstName: d.firstName,
    lastName: d.lastName,
    email: d.email,
    lifetime: d.donations.reduce((s, x) => s + Number(x.eligibleAmount), 0),
    lastGiftAt: d.donations.reduce<Date | null>(
      (latest, x) => (!latest || x.receivedAt > latest ? x.receivedAt : latest),
      null
    ),
    recurringActive: d.recurringPlans.length > 0,
  }));
}

export function filterSegment(donors: LoadedDonor[], segment: SegmentKey): LoadedDonor[] {
  const now = Date.now();
  switch (segment) {
    case "recurring":
      return donors.filter((d) => d.recurringActive);
    case "high_value":
      return donors.filter((d) => d.lifetime >= HIGH_VALUE);
    case "lapsed":
      return donors.filter((d) => !d.lastGiftAt || now - d.lastGiftAt.getTime() > LAPSED_MS);
    case "all":
    default:
      return donors;
  }
}
