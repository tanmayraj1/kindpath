import { adminDb } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { renderInvoicePdf, type InvoiceData } from "@/lib/pdf/invoice-document";
import { formatAddress } from "@/lib/receipts";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { taxFor } from "@/lib/tax";

export const runtime = "nodejs";

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  if (!(await rateLimit(`invoice-pdf:${clientIp()}`, 30, 60_000)).ok) {
    return new Response("Too many requests", { status: 429, headers: { "Retry-After": "60" } });
  }

  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const invoice = await adminDb.subscriptionInvoice.findUnique({
    where: { id: params.id },
    include: { org: { include: { subscription: true } } },
  });
  if (!invoice) return new Response("Invoice not found", { status: 404 });

  // A platform admin sees any invoice; an org user sees only their own.
  const allowed =
    session.kind === "platform" || (session.kind === "org" && session.orgId === invoice.orgId);
  if (!allowed) return new Response("Not authorized", { status: 403 });

  const org = invoice.org;
  const cycle = org.subscription?.cycle ?? "monthly";
  const plan = org.subscription?.plan ?? "starter";
  const tax = taxFor(invoice.province);

  const periodEnd = new Date(invoice.issuedAt);
  periodEnd.setDate(periodEnd.getDate() + (cycle === "annual" ? 365 : 30));

  const data: InvoiceData = {
    invoiceNumber: invoice.invoiceNumber,
    issuedAt: fmtDate(invoice.issuedAt),
    status: invoice.status,
    billTo: {
      name: org.name,
      address:
        formatAddress({
          addressLine1: org.addressLine1,
          addressLine2: org.addressLine2,
          city: org.city,
          province: org.province,
          postalCode: org.postalCode,
          country: org.country,
        }) || "—",
    },
    planLabel: `KindPath ${plan.charAt(0).toUpperCase() + plan.slice(1)} plan — ${
      cycle === "annual" ? "annual" : "monthly"
    } subscription`,
    periodLabel: `${fmtDate(invoice.issuedAt)} – ${fmtDate(periodEnd)}`,
    subtotal: Number(invoice.subtotal),
    taxLabel: tax.label,
    taxRate: Number(invoice.taxRate),
    taxAmount: Number(invoice.taxAmount),
    total: Number(invoice.total),
    supplierTaxNumber: process.env.KINDPATH_GST_NUMBER ?? null,
  };

  const buffer = await renderInvoicePdf(data);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="kindpath-invoice-${invoice.invoiceNumber}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
