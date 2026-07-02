import { adminDb } from "@/lib/db";
import { formatAddress } from "@/lib/receipts";
import { renderReceiptPdf, type ReceiptData } from "@/lib/pdf/receipt-document";
import { verifyReceiptToken } from "@/lib/receipt-links";
import { getSession } from "@/lib/auth/session";

export const runtime = "nodejs";

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const receipt = await adminDb.receipt.findUnique({
    where: { id: params.id },
    include: { org: true },
  });

  if (!receipt) {
    return new Response("Receipt not found", { status: 404 });
  }

  // Authorize: a valid signed token (email/public links) OR an entitled session.
  const token = new URL(req.url).searchParams.get("t");
  let allowed = verifyReceiptToken(receipt.id, token);
  if (!allowed) {
    const session = await getSession();
    if (session) {
      if (session.kind === "platform") allowed = true;
      else if (session.kind === "org" && session.orgId === receipt.orgId) allowed = true;
      else if (session.kind === "donor" && session.sub === receipt.donorId) allowed = true;
    }
  }
  if (!allowed) {
    return new Response("Not authorized", { status: 403 });
  }

  const data: ReceiptData = {
    serialNumber: receipt.serialNumber,
    documentType: receipt.documentType,
    donorName: receipt.donorNameSnapshot,
    donorAddress: receipt.donorAddressSnapshot,
    orgName: receipt.orgNameSnapshot,
    orgAddress: formatAddress({
      addressLine1: receipt.org.addressLine1,
      addressLine2: receipt.org.addressLine2,
      city: receipt.org.city,
      province: receipt.org.province,
      postalCode: receipt.org.postalCode,
      country: receipt.org.country,
    }),
    orgRegNumber: receipt.orgRegNumberSnapshot,
    amount: Number(receipt.amount),
    advantageValue: Number(receipt.advantageValue),
    eligibleAmount: Number(receipt.eligibleAmount),
    placeIssued: receipt.placeIssued,
    dateDonationReceived: fmtDate(receipt.dateDonationReceived),
    dateIssued: fmtDate(receipt.dateIssued),
    signatoryName: receipt.signatoryNameSnapshot,
    year: receipt.year,
    // white-label + customization (live from the org)
    brandColor: receipt.org.primaryColor,
    logoUrl: receipt.org.logoUrl,
    message: receipt.org.receiptMessage,
    footer: receipt.org.receiptFooter,
  };

  let buffer: Buffer;
  try {
    buffer = await renderReceiptPdf(data);
  } catch {
    // a bad logo URL can break image fetching — retry without the logo
    buffer = await renderReceiptPdf({ ...data, logoUrl: null });
  }

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="receipt-${receipt.serialNumber}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
