import { getSession } from "@/lib/auth/session";
import { withTenant } from "@/lib/tenant";
import { getOrgAccess } from "@/lib/access";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  return [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
}

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

  let csv = "";
  if (type === "donors") {
    csv = await withTenant(orgId, async (tx) => {
      const donors = await tx.donor.findMany({
        orderBy: { createdAt: "desc" },
        include: { donations: { where: { status: "succeeded" }, select: { eligibleAmount: true } } },
      });
      return toCsv(
        ["Name", "Email", "Phone", "City", "Province", "CASL consent", "Total given (CAD)"],
        donors.map((d) => [
          `${d.firstName} ${d.lastName}`,
          d.email,
          d.phone ?? "",
          d.city ?? "",
          d.province ?? "",
          d.caslConsent,
          d.donations.reduce((s, x) => s + Number(x.eligibleAmount), 0).toFixed(2),
        ])
      );
    });
  } else if (type === "donations") {
    csv = await withTenant(orgId, async (tx) => {
      const rows = await tx.donation.findMany({
        orderBy: { receivedAt: "desc" },
        include: { donor: true, fund: true, receipt: true },
      });
      return toCsv(
        ["Date", "Donor", "Email", "Fund", "Type", "Amount", "Eligible", "Status", "Receipt #"],
        rows.map((d) => [
          new Date(d.receivedAt).toISOString().slice(0, 10),
          `${d.donor.firstName} ${d.donor.lastName}`,
          d.donor.email,
          d.fund?.name ?? "",
          d.type,
          Number(d.amount).toFixed(2),
          Number(d.eligibleAmount).toFixed(2),
          d.status,
          d.receipt?.serialNumber ?? "",
        ])
      );
    });
  } else if (type === "receipts") {
    csv = await withTenant(orgId, async (tx) => {
      const rows = await tx.receipt.findMany({ orderBy: { dateIssued: "desc" }, include: { donor: true } });
      return toCsv(
        ["Serial", "Donor", "Type", "Amount", "Eligible", "Status", "Issued", "Year"],
        rows.map((r) => [
          r.serialNumber,
          `${r.donor.firstName} ${r.donor.lastName}`,
          r.documentType,
          Number(r.amount).toFixed(2),
          Number(r.eligibleAmount).toFixed(2),
          r.status,
          new Date(r.dateIssued).toISOString().slice(0, 10),
          r.year,
        ])
      );
    });
  } else {
    return new Response("Unknown export type", { status: 404 });
  }

  // Exporting the donor roster is exactly the event a breach review asks about.
  await audit({
    actor: { type: "org_user", id: session.sub },
    orgId,
    action: `export.${type}`,
    entityType: "organization",
    entityId: orgId,
    ip: clientIp(),
  });

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="kindpath-${type}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
