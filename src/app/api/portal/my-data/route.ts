import { getSession } from "@/lib/auth/session";
import { buildDonorExport } from "@/lib/privacy";
import { audit } from "@/lib/audit";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
}

/**
 * A donor's own data, exported by them (PIPEDA access; Law 25 portability).
 *
 * Scoped entirely to the authenticated donor's session — there is no id
 * parameter to tamper with, so this cannot be pointed at anyone else's record.
 * `?format=csv` gives the giving history in a spreadsheet-friendly form; the
 * default JSON is the complete record.
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session || session.kind !== "donor" || !session.orgId) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!(await rateLimit(`my-data:${session.sub}`, 5, 60_000)).ok) {
    return new Response("Too many requests. Please wait a minute.", {
      status: 429,
      headers: { "Retry-After": "60" },
    });
  }

  const data = await buildDonorExport(session.orgId, session.sub);
  if (!data) return new Response("Not found", { status: 404 });

  // Someone exercising a data right is exactly the event an audit should record.
  await audit({
    actor: { type: "donor", id: session.sub },
    orgId: session.orgId,
    action: "donor.data_exported",
    entityType: "donor",
    entityId: session.sub,
    ip: clientIp(),
  });

  const stamp = new Date().toISOString().slice(0, 10);

  if (new URL(req.url).searchParams.get("format") === "csv") {
    const csv = toCsv(
      ["Date", "Amount", "Eligible amount", "Advantage", "Currency", "Type", "Status", "Fund"],
      data.donations.map((d) => [
        String(d.date).slice(0, 10),
        d.amount,
        d.eligibleAmount,
        d.advantageValue,
        d.currency,
        d.type,
        d.status,
        d.fund ?? "",
      ])
    );
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="my-giving-${stamp}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="my-kindpath-data-${stamp}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
