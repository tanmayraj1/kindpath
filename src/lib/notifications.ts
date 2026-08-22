import type { Prisma } from "@prisma/client";
import { adminDb } from "@/lib/db";
import { sendEmailWithRetry, emailLayout, escapeHtml, brandHex } from "@/lib/email";
import { signedReceiptUrl } from "@/lib/receipt-links";
import { captureError, log } from "@/lib/observability";
import { formatCAD } from "@/lib/utils";

/**
 * Transactional email dispatch, built as an OUTBOX.
 *
 * Why: sending inside the Prisma transaction meant an HTTPS round-trip to Resend
 * ran while the transaction held a lock on `receipt_sequences`, under a 5s default
 * timeout. A slow mail provider rolled back a donation that had already been
 * charged. So:
 *
 *   1. `queue*Email(tx, …)` writes a `notifications` row with status=queued
 *      inside the transaction and returns the rendered message. No network I/O.
 *   2. The caller commits.
 *   3. `flushEmails([...])` sends AFTER the commit and updates each row to
 *      sent/failed. A delivery failure can no longer undo a recorded gift.
 *
 * Failures are recorded (status=failed) *and* reported to observability, so a
 * receipt that never reached a donor is visible rather than silent.
 */

type Tx = Prisma.TransactionClient;

export type QueuedEmail = {
  notificationId: string;
  orgId: string;
  to: string;
  subject: string;
  html: string;
};

async function queue(
  tx: Tx,
  args: {
    orgId: string;
    donorId?: string | null;
    category: string;
    to: string;
    subject: string;
    html: string;
  }
): Promise<QueuedEmail> {
  const n = await tx.notification.create({
    data: {
      orgId: args.orgId,
      donorId: args.donorId ?? undefined,
      channel: "email",
      category: args.category,
      status: "queued",
      caslChecked: true, // transactional: CASL consent is not required
      payload: { subject: args.subject },
    },
  });
  return { notificationId: n.id, orgId: args.orgId, to: args.to, subject: args.subject, html: args.html };
}

export async function queueReceiptEmail(
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
): Promise<QueuedEmail> {
  const url = signedReceiptUrl(args.receiptId);
  const subject = args.official
    ? `Your tax receipt ${args.serialNumber} from ${args.orgName}`
    : `Your payment confirmation from ${args.orgName}`;
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const html = emailLayout({
    heading: `Thank you for your gift, ${escapeHtml(args.donorName.split(" ")[0] ?? "")}!`,
    body:
      `Your ${args.official ? "official donation receipt" : "payment confirmation"} for
      <strong>${formatCAD(args.eligibleAmount)}</strong> is ready.
      Receipt number <strong>${escapeHtml(args.serialNumber)}</strong>.` +
      // How a donor discovers the portal exists. Deliberately a plain link and
      // NOT an embedded password-set token: mailing a live credential to every
      // donor who has ever given would leave thousands of unsolicited
      // account-takeover links sitting in inboxes. One extra click, no credential.
      `<p style="margin-top:16px;font-size:13px;color:#64748b">
        Want to see past receipts, manage a recurring gift or update your card?
        <a href="${base}/claim" style="color:${brandHex(args.brandColor)}">Set up portal access</a>.
      </p>`,
    cta: { label: "Download receipt (PDF)", url },
    brand: { orgName: args.orgName, brandColor: args.brandColor, logoUrl: args.logoUrl },
  });

  return queue(tx, {
    orgId: args.orgId,
    donorId: args.donorId,
    category: args.official ? "receipt" : "confirmation",
    to: args.donorEmail,
    subject,
    html,
  });
}

export async function queueBillingFailureEmail(
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
): Promise<QueuedEmail> {
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
      // Via /login rather than straight at /portal: a donor who has never set a
      // password would otherwise be bounced by middleware into a login page with
      // no way forward — which is precisely what made this email a dead end.
      // `next` carries them to the right page once they are in.
      label: "Manage payment method",
      url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/login?next=%2Fportal%2Frecurring`,
    },
    brand: { orgName: args.orgName, brandColor: args.brandColor, logoUrl: args.logoUrl },
  });

  return queue(tx, {
    orgId: args.orgId,
    donorId: args.donorId,
    category: "billing_failure",
    to: args.donorEmail,
    subject,
    html,
  });
}

/**
 * Deliver queued messages. Call AFTER the transaction commits. Never throws —
 * a mail outage must not surface as an error to someone who was just charged;
 * it surfaces as a `failed` notification the org can see and re-send.
 */
export async function flushEmails(queued: QueuedEmail[]): Promise<void> {
  for (const q of queued) {
    try {
      const result = await sendEmailWithRetry({ to: q.to, subject: q.subject, html: q.html });
      if (result.ok) {
        await adminDb.notification.update({
          where: { id: q.notificationId },
          data: {
            status: "sent",
            providerRef: result.id,
            sentAt: new Date(),
            payload: { subject: q.subject, simulated: result.simulated ?? false },
          },
        });
      } else {
        await adminDb.notification.update({
          where: { id: q.notificationId },
          data: { status: "failed", payload: { subject: q.subject, error: result.error } },
        });
        captureError(new Error(`email delivery failed: ${result.error}`), {
          source: "notifications.flush",
          notificationId: q.notificationId,
          orgId: q.orgId,
          subject: q.subject,
        });
      }
    } catch (e) {
      // The send or the status write blew up. The row stays `queued`, which the
      // dashboard surfaces as undelivered — better than a false "sent".
      captureError(e, { source: "notifications.flush", notificationId: q.notificationId, orgId: q.orgId });
    }
  }
  log("info", "notifications flushed", { count: queued.length });
}

/**
 * Re-send a notification that previously failed. Returns false when the row
 * isn't in a re-sendable state or the message body is no longer reconstructable.
 */
export async function resendNotification(notificationId: string, html: string, to: string): Promise<boolean> {
  const n = await adminDb.notification.findUnique({ where: { id: notificationId } });
  if (!n || n.status === "sent") return false;
  const subject = (n.payload as { subject?: string } | null)?.subject ?? "Message from KindPath";
  await flushEmails([{ notificationId, orgId: n.orgId, to, subject, html }]);
  const after = await adminDb.notification.findUnique({ where: { id: notificationId } });
  return after?.status === "sent";
}
