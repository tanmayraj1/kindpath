import { Prisma } from "@prisma/client";
import { withTenant } from "@/lib/tenant";

/**
 * Helpers for the donation write path's idempotency guarantee.
 *
 * `provider_charge_ref` carries a PARTIAL UNIQUE index in Postgres (successful
 * donations only — see prisma/migrations/*_donation_charge_ref_unique). That index
 * is the real defence against a double-submit producing two gifts, and worse, two
 * official tax receipts, for a single charge. The in-transaction "does it already
 * exist?" read is only a fast path; under concurrency both readers miss and the
 * index is what actually stops the second write.
 *
 * So every donation writer must be able to answer: "my insert lost the race —
 * where is the receipt the winner created?"
 */

/** True when an error is the unique-violation on donations.provider_charge_ref. */
export function isDuplicateChargeError(e: unknown): boolean {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== "P2002") return false;
  const target = e.meta?.target;
  const text = Array.isArray(target) ? target.join(",") : String(target ?? "");
  return text.includes("charge_key") || text.includes("chargeKey");
}

/** Find the receipt created by whichever request won the race for this charge. */
export async function findReceiptForCharge(orgId: string, chargeRef: string): Promise<string | null> {
  return withTenant(orgId, async (tx) => {
    const donation = await tx.donation.findFirst({
      where: { chargeKey: chargeRef },
      include: { receipt: true },
    });
    return donation?.receipt?.id ?? null;
  });
}
