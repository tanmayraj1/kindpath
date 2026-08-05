import { adminDb } from "@/lib/db";
import { getPaymentProviderForOrg } from "@/lib/payments";
import { nextReceiptSerial, formatAddress } from "@/lib/receipts";
import { queueReceiptEmail, queueBillingFailureEmail, flushEmails, type QueuedEmail } from "@/lib/notifications";
import { captureError, log } from "@/lib/observability";

const RETRY_DAYS = [3, 5, 7]; // backoff schedule; suspend after the last
export const MAX_RETRIES = RETRY_DAYS.length;

const FREQ_DAYS: Record<string, number> = {
  weekly: 7,
  monthly: 30,
  quarterly: 90,
  annual: 365,
};

function addDays(d: Date, n: number) {
  return new Date(d.getTime() + n * 86400 * 1000);
}

// A due plan with the relations settleDuePlan needs (donor, org, paymentMethod).
type DuePlan = Awaited<ReturnType<typeof loadDuePlans>>[number];

function loadDuePlans(where: object, page: { skip?: number; take?: number } = {}) {
  return adminDb.recurringPlan.findMany({
    where,
    include: { donor: true, org: true, paymentMethod: true, fund: true },
    orderBy: { id: "asc" },
    ...page,
  });
}

export type SettleOutcome = "charged" | "failed" | "suspended";

/**
 * Charge a single recurring plan once and record the result (donation + receipt +
 * email on success; retry/suspend bookkeeping + failure email on decline).
 * Shared by the billing cron and the donor "retry now" action.
 *
 * `idempotencyKey` defaults to a value derived from the plan's due date so a cron
 * re-run never double-charges; the donor-triggered retry passes a unique key so it
 * genuinely re-attempts the card rather than replaying the last decline.
 */
export async function settleDuePlan(
  plan: DuePlan,
  now = new Date(),
  opts: { idempotencyKey?: string } = {}
): Promise<SettleOutcome> {
  const provider = await getPaymentProviderForOrg(plan.orgId);
  const amount = Number(plan.amount);
  const token = plan.paymentMethod?.providerToken ?? plan.providerRecurringRef ?? "tok_recurring";

  const charge = await provider.charge({
    orgId: plan.orgId,
    providerToken: token,
    money: { amount, currency: plan.currency },
    idempotencyKey: opts.idempotencyKey ?? `${plan.id}:${plan.nextBillingDate?.toISOString() ?? ""}`,
  });

  const { outcome, mail } = await adminDb.$transaction(async (tx) => {
    if (charge.success) {
      const registered = plan.org.charityStatus === "registered";
      const year = now.getFullYear();
      const donation = await tx.donation.create({
        data: {
          orgId: plan.orgId,
          donorId: plan.donorId,
          fundId: plan.fundId,
          recurringPlanId: plan.id,
          type: "recurring",
          amount,
          advantageValue: 0,
          eligibleAmount: amount,
          currency: plan.currency,
          status: "succeeded",
          paymentMethodId: plan.paymentMethodId,
          providerChargeRef: charge.providerChargeRef,
          chargeKey: charge.providerChargeRef || null,
          receivedAt: now,
        },
      });

      const serial = await nextReceiptSerial(tx, plan.orgId, year, plan.org.receiptPrefix);
      const receipt = await tx.receipt.create({
        data: {
          orgId: plan.orgId,
          donationId: donation.id,
          donorId: plan.donorId,
          serialNumber: serial,
          documentType: registered ? "official" : "confirmation",
          donorNameSnapshot: `${plan.donor.firstName} ${plan.donor.lastName}`,
          donorAddressSnapshot: formatAddress(plan.donor),
          orgNameSnapshot: plan.org.name,
          orgRegNumberSnapshot: plan.org.craRegistrationNumber,
          amount,
          advantageValue: 0,
          eligibleAmount: amount,
          placeIssued: plan.org.receiptLocality,
          dateDonationReceived: now,
          signatoryNameSnapshot: registered ? plan.org.authorizedSignatory : null,
          year,
        },
      });

      const mail = await queueReceiptEmail(tx, {
        orgId: plan.orgId,
        donorId: plan.donorId,
        donorEmail: plan.donor.email,
        donorName: `${plan.donor.firstName} ${plan.donor.lastName}`,
        orgName: plan.org.name,
        receiptId: receipt.id,
        serialNumber: receipt.serialNumber,
        eligibleAmount: amount,
        official: registered,
        brandColor: plan.org.primaryColor,
        logoUrl: plan.org.logoUrl,
      });

      await tx.recurringPlan.update({
        where: { id: plan.id },
        data: {
          retryCount: 0,
          status: "active",
          nextBillingDate: addDays(now, FREQ_DAYS[plan.frequency] ?? 30),
        },
      });
      return { outcome: "charged" as const, mail };
    }

    const attempt = plan.retryCount + 1;
    const suspend = attempt >= MAX_RETRIES;
    await tx.recurringPlan.update({
      where: { id: plan.id },
      data: {
        retryCount: attempt,
        status: suspend ? "suspended" : "active",
        nextBillingDate: suspend
          ? plan.nextBillingDate
          : addDays(now, RETRY_DAYS[Math.min(attempt - 1, RETRY_DAYS.length - 1)]),
      },
    });
    const mail = await queueBillingFailureEmail(tx, {
      orgId: plan.orgId,
      donorId: plan.donorId,
      donorEmail: plan.donor.email,
      donorName: `${plan.donor.firstName} ${plan.donor.lastName}`,
      orgName: plan.org.name,
      amount,
      attempt,
      suspended: suspend,
      brandColor: plan.org.primaryColor,
      logoUrl: plan.org.logoUrl,
    });
    // record the failed attempt as a donation row for reporting
    await tx.donation.create({
      data: {
        orgId: plan.orgId,
        donorId: plan.donorId,
        fundId: plan.fundId,
        recurringPlanId: plan.id,
        type: "recurring",
        amount,
        advantageValue: 0,
        eligibleAmount: amount,
        currency: plan.currency,
        status: "failed",
        providerChargeRef: charge.providerChargeRef,
        receivedAt: now,
      },
    });
    return { outcome: (suspend ? "suspended" : "failed") as SettleOutcome, mail };
  });

  // Sent only after the transaction commits — a mail outage must never roll back
  // a charge that already succeeded at the processor.
  await flushEmails([mail]);
  return outcome;
}

export type BillingSummary = {
  due: number;
  charged: number;
  failed: number;
  suspended: number;
  receiptsIssued: number;
  /** Plans that threw (gateway down, bad data). Reported, not swallowed. */
  errored: number;
};

/** Plans handled per batch. Bounds memory and keeps each cron slice short. */
const BILLING_BATCH_SIZE = 50;

/**
 * Process all recurring plans due for billing. Idempotent across runs because a
 * successful charge advances nextBillingDate past `now`. Safe to call from a cron.
 *
 * Every plan is isolated: one plan throwing (gateway timeout, corrupt payment
 * method) used to abort the whole run and silently leave every later org unbilled.
 * Now it is counted, reported, and the run continues. Plans are loaded in batches
 * so a large tenant doesn't pull thousands of rows with relations into memory.
 */
export async function runBilling(now = new Date()): Promise<BillingSummary> {
  const summary: BillingSummary = {
    due: 0,
    charged: 0,
    failed: 0,
    suspended: 0,
    receiptsIssued: 0,
    errored: 0,
  };

  const where = { status: "active" as const, nextBillingDate: { lte: now } };
  summary.due = await adminDb.recurringPlan.count({ where });

  // Settling a plan removes it from `where` (nextBillingDate advances, or the
  // plan suspends), so offset pagination would skip rows as the set shrinks.
  // Instead always take the head of the set and track ids we've already handled —
  // that also stops a plan that *threw* (and so stayed due) from looping forever.
  const handled = new Set<string>();
  for (;;) {
    const batch = await loadDuePlans(where, { take: BILLING_BATCH_SIZE });
    const pending = batch.filter((p) => !handled.has(p.id));
    if (pending.length === 0) break;

    for (const plan of pending) {
      handled.add(plan.id);
      try {
        const outcome = await settleDuePlan(plan, now);
        if (outcome === "charged") {
          summary.charged += 1;
          summary.receiptsIssued += 1;
        } else {
          summary.failed += 1;
          if (outcome === "suspended") summary.suspended += 1;
        }
      } catch (e) {
        summary.errored += 1;
        captureError(e, { source: "billing.runBilling", planId: plan.id, orgId: plan.orgId });
      }
    }
  }

  log("info", "billing run complete", { ...summary });
  return summary;
}

/**
 * Donor-initiated retry of a failing/suspended recurring plan. Verifies the plan
 * belongs to the donor, then re-attempts the charge with a fresh idempotency key.
 * Returns the outcome so the portal can message the donor.
 */
export async function retryPlanForDonor(
  planId: string,
  donorId: string,
  now = new Date()
): Promise<SettleOutcome | "not_found" | "not_retryable"> {
  const [plan] = await loadDuePlans({ id: planId, donorId });
  if (!plan) return "not_found";
  // Only plans that have actually failed (past-due retries pending) or been
  // suspended are retryable; active/paused/cancelled plans are not.
  if (plan.status === "cancelled" || plan.status === "paused") return "not_retryable";
  if (plan.status === "active" && plan.retryCount === 0) return "not_retryable";

  return settleDuePlan(plan, now, {
    idempotencyKey: `${plan.id}:manual:${now.getTime()}`,
  });
}
