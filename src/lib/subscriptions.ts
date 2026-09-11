import { adminDb } from "@/lib/db";
import { computeInvoice, provinceCode } from "@/lib/tax";
import { sendEmailWithRetry, emailLayout, escapeHtml } from "@/lib/email";
import { captureError, log } from "@/lib/observability";
import { audit } from "@/lib/audit";
import { formatCAD } from "@/lib/utils";
import { appUrl as deploymentUrl } from "@/lib/app-url";

/**
 * KindPath's OWN revenue: charging organizations for the platform.
 *
 * This is the other half of the money model and it did not exist. `trialEndsAt`
 * was written at signup and never read; `past_due` was treated as active; and
 * `SubscriptionInvoice` was modelled but never written. A signup therefore got a
 * permanent free account and there was no record of what any customer owed.
 *
 * Deliberately NOT auto-charging: the launch decision is manual invoicing for
 * pilot orgs. This module produces correct, numbered, tax-bearing invoices and
 * moves subscriptions through their lifecycle. Collection is a human step.
 */

/** Days past due before an org's access is actually restricted. */
export const GRACE_DAYS = 14;

const DAY_MS = 86_400_000;

export type SubscriptionRunSummary = {
  trialsExpired: number;
  invoicesIssued: number;
  markedPastDue: number;
  suspended: number;
  errored: number;
};

/**
 * Invoice numbers are sequential per calendar year and must never repeat —
 * they're a business record. Derived from the highest existing number for the
 * year rather than a count, so a deleted draft can't cause a collision.
 */
export async function nextInvoiceNumber(year: number): Promise<string> {
  const prefix = `KP-${year}-`;
  const latest = await adminDb.subscriptionInvoice.findFirst({
    where: { invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  });
  const lastSeq = latest ? Number(latest.invoiceNumber.slice(prefix.length)) : 0;
  return `${prefix}${String((Number.isFinite(lastSeq) ? lastSeq : 0) + 1).padStart(5, "0")}`;
}

/**
 * Issue one invoice for an organization's current subscription period.
 * Idempotent per period: re-running on the same day won't duplicate.
 */
export async function issueInvoiceForOrg(
  orgId: string,
  now = new Date()
): Promise<{ invoiceNumber: string } | { skipped: string }> {
  const org = await adminDb.organization.findUnique({
    where: { id: orgId },
    include: { subscription: true },
  });
  if (!org?.subscription) return { skipped: "no subscription" };

  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const existing = await adminDb.subscriptionInvoice.findFirst({
    where: { orgId, issuedAt: { gte: periodStart } },
  });
  if (existing) return { skipped: `already invoiced ${existing.invoiceNumber}` };

  const subtotal = Number(org.subscription.priceCad);
  const province = provinceCode(org.province);
  const amounts = computeInvoice(subtotal, province);
  const invoiceNumber = await nextInvoiceNumber(now.getFullYear());

  await adminDb.subscriptionInvoice.create({
    data: {
      orgId,
      invoiceNumber,
      subtotal: amounts.subtotal,
      taxRate: amounts.taxRate,
      taxAmount: amounts.taxAmount,
      total: amounts.total,
      province,
      status: "issued",
      issuedAt: now,
    },
  });

  await audit({
    actor: { type: "system" },
    orgId,
    action: "subscription.invoice_issued",
    entityType: "subscription_invoice",
    entityId: invoiceNumber,
    after: { subtotal: amounts.subtotal, tax: amounts.taxAmount, total: amounts.total, province },
  });

  return { invoiceNumber };
}

/** Notify an org's admins that their trial has ended or payment is overdue. */
async function notifyOrgAdmins(
  orgId: string,
  subject: string,
  heading: string,
  body: string
): Promise<void> {
  try {
    const admins = await adminDb.orgUser.findMany({
      where: { orgId, role: "org_admin", status: "active" },
      select: { email: true },
    });
    const org = await adminDb.organization.findUnique({
      where: { id: orgId },
      select: { name: true, primaryColor: true, logoUrl: true },
    });
    for (const admin of admins) {
      await sendEmailWithRetry({
        to: admin.email,
        subject,
        html: emailLayout({
          heading,
          body,
          cta: {
            label: "Open your dashboard",
            url: `${deploymentUrl()}/dashboard`,
          },
          brand: { orgName: org?.name, brandColor: org?.primaryColor, logoUrl: org?.logoUrl },
        }),
      });
    }
  } catch (e) {
    captureError(e, { source: "subscriptions.notifyOrgAdmins", orgId });
  }
}

/**
 * Advance every subscription's lifecycle. Safe to run daily from a cron;
 * every step is idempotent.
 *
 *   trialing, trial ended        → past_due  + first invoice + email
 *   active, next billing date up → invoice   + email
 *   past_due beyond GRACE_DAYS   → cancelled (access restricted)
 */
/**
 * Subscriptions handled per run.
 *
 * Each stage below sends email per row, so an unbounded fetch makes one cron
 * invocation grow with the platform until it exceeds the function timeout and is
 * killed partway — redoing the completed work on the next run. Every stage
 * *changes the status it selected on*, so a bounded batch is self-advancing:
 * whatever is left simply no longer matches, and the next run picks it up.
 */
const CYCLE_BATCH_SIZE = 100;

export async function runSubscriptionCycle(now = new Date()): Promise<SubscriptionRunSummary> {
  const summary: SubscriptionRunSummary = {
    trialsExpired: 0,
    invoicesIssued: 0,
    markedPastDue: 0,
    suspended: 0,
    errored: 0,
  };

  // 1. Trials that have run out.
  const expiredTrials = await adminDb.subscription.findMany({
    where: { status: "trialing", trialEndsAt: { lte: now } },
    include: { org: { select: { id: true, name: true } } },
    orderBy: { id: "asc" },
    take: CYCLE_BATCH_SIZE,
  });
  for (const sub of expiredTrials) {
    try {
      await adminDb.subscription.update({
        where: { id: sub.id },
        data: { status: "past_due", currentPeriodStart: now },
      });
      summary.trialsExpired += 1;
      summary.markedPastDue += 1;

      const result = await issueInvoiceForOrg(sub.orgId, now);
      if ("invoiceNumber" in result) summary.invoicesIssued += 1;

      await notifyOrgAdmins(
        sub.orgId,
        `Your KindPath trial has ended`,
        "Your trial has ended",
        `Thanks for trying KindPath. Your first invoice for
         <strong>${escapeHtml(formatCAD(Number(sub.priceCad)))}</strong> plus tax is ready.
         Your account stays fully available for ${GRACE_DAYS} days while payment is arranged —
         donations already received and every receipt you've issued remain untouched.`
      );
    } catch (e) {
      summary.errored += 1;
      captureError(e, { source: "subscriptions.trialExpiry", orgId: sub.orgId });
    }
  }

  // 2. Active subscriptions due for their next invoice.
  const due = await adminDb.subscription.findMany({
    where: { status: "active", nextBillingDate: { lte: now } },
    orderBy: { id: "asc" },
    take: CYCLE_BATCH_SIZE,
  });
  for (const sub of due) {
    try {
      const result = await issueInvoiceForOrg(sub.orgId, now);
      if ("invoiceNumber" in result) summary.invoicesIssued += 1;
      await adminDb.subscription.update({
        where: { id: sub.id },
        data: {
          currentPeriodStart: now,
          nextBillingDate: new Date(now.getTime() + (sub.cycle === "annual" ? 365 : 30) * DAY_MS),
        },
      });
    } catch (e) {
      summary.errored += 1;
      captureError(e, { source: "subscriptions.invoice", orgId: sub.orgId });
    }
  }

  // 3. Past-due beyond the grace window.
  const graceCutoff = new Date(now.getTime() - GRACE_DAYS * DAY_MS);
  const overdue = await adminDb.subscription.findMany({
    where: { status: "past_due", currentPeriodStart: { lte: graceCutoff } },
    orderBy: { id: "asc" },
    take: CYCLE_BATCH_SIZE,
  });
  for (const sub of overdue) {
    try {
      await adminDb.subscription.update({ where: { id: sub.id }, data: { status: "cancelled" } });
      summary.suspended += 1;
      await audit({
        actor: { type: "system" },
        orgId: sub.orgId,
        action: "subscription.cancelled_unpaid",
        entityType: "subscription",
        entityId: sub.id,
      });
      await notifyOrgAdmins(
        sub.orgId,
        "Your KindPath subscription has been paused",
        "Subscription paused",
        `We haven't received payment, so your subscription is paused. Your data is safe and
         nothing has been deleted — donation records, donors and issued receipts are all
         retained. Settle the outstanding invoice and we'll restore access right away.`
      );
    } catch (e) {
      summary.errored += 1;
      captureError(e, { source: "subscriptions.suspend", orgId: sub.orgId });
    }
  }

  log("info", "subscription cycle complete", { ...summary });
  return summary;
}

/** Mark an invoice paid (God Mode, after manual collection). */
export async function markInvoicePaid(
  invoiceId: string,
  actorId: string
): Promise<{ ok: true } | { error: string }> {
  const invoice = await adminDb.subscriptionInvoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) return { error: "That invoice no longer exists." };
  if (invoice.status === "paid") return { error: "That invoice is already marked paid." };

  await adminDb.subscriptionInvoice.update({ where: { id: invoiceId }, data: { status: "paid" } });

  // Paying clears past_due and starts the next period.
  const sub = await adminDb.subscription.findUnique({ where: { orgId: invoice.orgId } });
  if (sub && sub.status !== "cancelled") {
    await adminDb.subscription.update({
      where: { id: sub.id },
      data: {
        status: "active",
        currentPeriodStart: new Date(),
        nextBillingDate: new Date(Date.now() + (sub.cycle === "annual" ? 365 : 30) * DAY_MS),
      },
    });
  }

  await audit({
    actor: { type: "platform_admin", id: actorId },
    orgId: invoice.orgId,
    action: "subscription.invoice_paid",
    entityType: "subscription_invoice",
    entityId: invoice.invoiceNumber,
  });
  return { ok: true };
}
