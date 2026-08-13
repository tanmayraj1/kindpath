import type { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { withTenant } from "@/lib/tenant";
import { getOrgAccess } from "@/lib/access";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { captureError } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function csvLine(cells: (string | number | null)[]): string {
  return cells.map(csvCell).join(",") + "\r\n";
}

/**
 * Rows per database round trip.
 *
 * The export used to build the entire file in memory — every donation with three
 * joins, or every donor with every one of their donations — inside a single
 * `withTenant` transaction bounded to 5s. A charity large enough to want an
 * export was exactly the one that couldn't get one. Each page below is its own
 * short transaction, and the response streams as they arrive, so the work is
 * bounded no matter how much history there is.
 */
const PAGE = 500;

type Page<T> = { rows: T[]; nextCursor: string | null };

/** Keyset page over a table, ordered by id so the cursor is stable. */
async function pageBy<T extends { id: string }>(
  orgId: string,
  cursor: string | null,
  fetch: (tx: Prisma.TransactionClient, cursor: string | null) => Promise<T[]>
): Promise<Page<T>> {
  const rows = await withTenant(orgId, (tx) => fetch(tx, cursor));
  return { rows, nextCursor: rows.length === PAGE ? rows[rows.length - 1].id : null };
}

type Exporter = {
  headers: string[];
  page: (orgId: string, cursor: string | null) => Promise<Page<{ id: string }>>;
  line: (row: never) => (string | number | null)[];
};

const EXPORTERS: Record<string, Exporter> = {
  donors: {
    headers: ["Name", "Email", "Phone", "City", "Province", "CASL consent", "Total given (CAD)"],
    page: (orgId, cursor) =>
      pageBy(orgId, cursor, async (tx, c) => {
        const donors = await tx.donor.findMany({
          orderBy: { id: "asc" },
          take: PAGE,
          ...(c ? { cursor: { id: c }, skip: 1 } : {}),
        });
        if (donors.length === 0) return [];
        // Lifetime totals for this page only, summed by Postgres. Including every
        // donation per donor is what made this unbounded in the first place.
        const sums = await tx.donation.groupBy({
          by: ["donorId"],
          _sum: { eligibleAmount: true },
          where: { status: "succeeded", donorId: { in: donors.map((d) => d.id) } },
        });
        const byDonor = new Map(sums.map((s) => [s.donorId, Number(s._sum.eligibleAmount ?? 0)]));
        return donors.map((d) => ({ ...d, lifetime: byDonor.get(d.id) ?? 0 }));
      }),
    line: (d: { firstName: string; lastName: string; email: string; phone: string | null; city: string | null; province: string | null; caslConsent: string; lifetime: number }) => [
      `${d.firstName} ${d.lastName}`,
      d.email,
      d.phone ?? "",
      d.city ?? "",
      d.province ?? "",
      d.caslConsent,
      d.lifetime.toFixed(2),
    ],
  },

  donations: {
    headers: ["Date", "Donor", "Email", "Fund", "Type", "Amount", "Eligible", "Status", "Receipt #"],
    page: (orgId, cursor) =>
      pageBy(orgId, cursor, (tx, c) =>
        tx.donation.findMany({
          orderBy: { id: "asc" },
          take: PAGE,
          ...(c ? { cursor: { id: c }, skip: 1 } : {}),
          select: {
            id: true,
            receivedAt: true,
            type: true,
            amount: true,
            eligibleAmount: true,
            status: true,
            donor: { select: { firstName: true, lastName: true, email: true } },
            fund: { select: { name: true } },
            receipt: { select: { serialNumber: true } },
          },
        })
      ),
    line: (d: {
      receivedAt: Date;
      type: string;
      amount: unknown;
      eligibleAmount: unknown;
      status: string;
      donor: { firstName: string; lastName: string; email: string };
      fund: { name: string } | null;
      receipt: { serialNumber: string } | null;
    }) => [
      new Date(d.receivedAt).toISOString().slice(0, 10),
      `${d.donor.firstName} ${d.donor.lastName}`,
      d.donor.email,
      d.fund?.name ?? "",
      d.type,
      Number(d.amount).toFixed(2),
      Number(d.eligibleAmount).toFixed(2),
      d.status,
      d.receipt?.serialNumber ?? "",
    ],
  },

  receipts: {
    headers: ["Serial", "Donor", "Type", "Amount", "Eligible", "Status", "Issued", "Year"],
    page: (orgId, cursor) =>
      pageBy(orgId, cursor, (tx, c) =>
        tx.receipt.findMany({
          orderBy: { id: "asc" },
          take: PAGE,
          ...(c ? { cursor: { id: c }, skip: 1 } : {}),
          select: {
            id: true,
            serialNumber: true,
            documentType: true,
            amount: true,
            eligibleAmount: true,
            status: true,
            dateIssued: true,
            year: true,
            donorNameSnapshot: true,
          },
        })
      ),
    line: (r: {
      serialNumber: string;
      documentType: string;
      amount: unknown;
      eligibleAmount: unknown;
      status: string;
      dateIssued: Date;
      year: number;
      donorNameSnapshot: string;
    }) => [
      r.serialNumber,
      // The snapshot, not the live donor row: a receipt must always show the name
      // it was issued to, including after that donor exercises their right to
      // erasure. Joining the donor here would blank the column retroactively.
      r.donorNameSnapshot,
      r.documentType,
      Number(r.amount).toFixed(2),
      Number(r.eligibleAmount).toFixed(2),
      r.status,
      new Date(r.dateIssued).toISOString().slice(0, 10),
      r.year,
    ],
  },
};

export async function GET(_req: Request, { params }: { params: { type: string } }) {
  const session = await getSession();
  if (!session || session.kind !== "org" || !session.orgId) {
    return new Response("Unauthorized", { status: 401 });
  }
  const orgId = session.orgId;
  const type = params.type;

  // A suspended or cancelled org could still export every donor's PII: the page
  // guards check access, but this route was reachable directly.
  const access = await getOrgAccess(orgId);
  if (!access.active) {
    return new Response("This organization's access is not active.", { status: 403 });
  }

  // Bulk PII extraction deserves a tighter budget than a page view.
  if (!(await rateLimit(`export:${orgId}`, 10, 60_000)).ok) {
    return new Response("Too many exports. Please wait a minute.", {
      status: 429,
      headers: { "Retry-After": "60" },
    });
  }

  const exporter = EXPORTERS[type];
  if (!exporter) return new Response("Unknown export type", { status: 404 });

  // Exporting the donor roster is exactly the event a breach review asks about.
  // Recorded before the first byte, so an export that dies mid-stream is still
  // on the record as having been requested.
  await audit({
    actor: { type: "org_user", id: session.sub },
    orgId,
    action: `export.${type}`,
    entityType: "organization",
    entityId: orgId,
    ip: clientIp(),
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(csvLine(exporter.headers)));
        let cursor: string | null = null;
        do {
          const { rows, nextCursor } = await exporter.page(orgId, cursor);
          for (const row of rows) {
            controller.enqueue(encoder.encode(csvLine(exporter.line(row as never))));
          }
          cursor = nextCursor;
        } while (cursor);
        controller.close();
      } catch (e) {
        // The response has already started, so the status can't change. Report it
        // and end the file with a marker rather than a silent truncation that
        // reads like a complete export.
        captureError(e, { source: "export.stream", orgId, type });
        controller.enqueue(encoder.encode("\r\n# EXPORT INCOMPLETE — an error occurred. Please retry.\r\n"));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="kindpath-${type}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
