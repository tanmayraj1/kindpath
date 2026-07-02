import type { Prisma } from "@prisma/client";

/** Atomically allocate the next gap-free receipt serial for an org+year. */
export async function nextReceiptSerial(
  tx: Prisma.TransactionClient,
  orgId: string,
  year: number,
  prefix?: string | null
): Promise<string> {
  const seq = await tx.receiptSequence.upsert({
    where: { orgId_year: { orgId, year } },
    create: { orgId, year, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
  });
  const p = (prefix ?? "").trim();
  return `${p}${year}-${String(seq.lastNumber).padStart(6, "0")}`;
}

/** One-line address string for receipt snapshots. */
export function formatAddress(parts: {
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  country?: string | null;
}): string {
  return [
    parts.addressLine1,
    parts.addressLine2,
    [parts.city, parts.province].filter(Boolean).join(", "),
    parts.postalCode,
    parts.country && parts.country !== "CA" ? parts.country : null,
  ]
    .filter(Boolean)
    .join(", ");
}
