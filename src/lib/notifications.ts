import type { Prisma } from "@prisma/client";
import { sendEmail, emailLayout, escapeHtml } from "@/lib/email";
import { signedReceiptUrl } from "@/lib/receipt-links";
import { formatCAD } from "@/lib/utils";

/**
 * Notification dispatch. Records every send to the notifications table and sends
 * the actual email. Transactional messages (receipts, billing alerts) always send;
 * marketing must be CASL-gated by the caller.
 */

type Tx = Prisma.TransactionClient;

export async function sendReceiptEmail(
  tx: Tx,
  args: {
    orgId: string;
    donorId: string;
    donorEmail: string;
    donorName: string;
    orgName: string;
    receiptId: string;
    serialNumber: string;
    eligibleAmount: number;
    official: boolean;
    brandColor?: string | null;
    logoUrl?: string | null;
  }
) {
  const url = signedReceiptUrl(args.receiptId);
  const subject = args.official
    ? `Your tax receipt ${args.serialNumber} from ${args.orgName}`
    : `Your payment confirmation from ${args.orgName}`;
  const html = emailLayout({
    heading: `Thank you for your gift, ${escapeHtml(args.donorName.split(" ")[0] ?? "")}!`,
    body: `Your ${args.official ? "official donation receipt" : "payment confirmation"} for
      <strong>${formatCAD(args.eligibleAmount)}</strong> is ready.
      Receipt number <strong>${escapeHtml(args.serialNumber)}</strong>.`,
    cta: { label: "Download receipt (PDF)", url },
    brand: { orgName: args.orgName, brandColor: args.brandColor, logoUrl: args.logoUrl },
  });

  const result = await sendEmail({ to: args.donorEmail, subject, html });
  await tx.notification.create({
    data: {
      orgId: args.orgId,
      donorId: args.donorId,
      channel: "email",
      category: args.official ? "receipt" : "confirmation",
      status: result.ok ? "sent" : "failed",
      caslChecked: true,
      providerRef: result.ok ? result.id : undefined,
      sentAt: result.ok ? new Date() : undefined,
      payload: { subject },
    },
  });
  return result;
}

export async function sendBillingFailureEmail(
  tx: Tx,
  args: {
    orgId: string;
    donorId: string;
    donorEmail: string;
    donorName: string;
    orgName: string;
    amount: number;
    attempt: number;
    suspended: boolean;
    brandColor?: string | null;
    logoUrl?: string | null;
  }
) {
  const subject = args.suspended
    ? `Action needed: recurring gift to ${args.orgName} paused`
    : `We couldn't process your recurring gift to ${args.orgName}`;
  const html = emailLayout({
    heading: `Payment ${args.suspended ? "paused" : "failed"}`,
    body: args.suspended
      ? `We tried several times to process your recurring gift of <strong>${formatCAD(args.amount)}</strong>
         but it didn't go through, so we've paused the plan. Please update your payment method to resume.`
      : `We couldn't process your recurring gift of <strong>${formatCAD(args.amount)}</strong>
         (attempt ${args.attempt}). We'll try again automatically. You can also update your payment method.`,
    cta: {
      label: "Manage payment method",
      url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/portal/payment-methods`,
    },
    brand: { orgName: args.orgName, brandColor: args.brandColor, logoUrl: args.logoUrl },
  });
  const result = await sendEmail({ to: args.donorEmail, subject, html });
  await tx.notification.create({
    data: {
      orgId: args.orgId,
      donorId: args.donorId,
      channel: "email",
      category: "billing_failure",
      status: result.ok ? "sent" : "failed",
      caslChecked: true,
      providerRef: result.ok ? result.id : undefined,
      sentAt: result.ok ? new Date() : undefined,
      payload: { subject },
    },
  });
  return result;
}
