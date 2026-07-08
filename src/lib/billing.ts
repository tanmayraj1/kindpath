import { adminDb } from "@/lib/db";
import { getPaymentProviderForOrg } from "@/lib/payments";
import { nextReceiptSerial, formatAddress } from "@/lib/receipts";
import { sendReceiptEmail, sendBillingFailureEmail } from "@/lib/notifications";

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

function loadDuePlans(where: object) {
  return adminDb.recurringPlan.findMany({
    where,
    include: { donor: true, org: true, paymentMethod: true, fund: true },
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

  return adminDb.$transaction(async (tx) => {
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

      await sendReceiptEmail(tx, {
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
      return "charged";
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
    await sendBillingFailureEmail(tx, {
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
    return suspend ? "suspended" : "failed";
  });
}

export type BillingSummary = {
  due: number;
  charged: number;
  failed: number;
  suspended: number;
  receiptsIssued: number;
};

/**
 * Process all recurring plans due for billing. Idempotent across runs because a
 * successful charge advances nextBillingDate past `now`. Safe to call from a cron.
 */
export async function runBilling(now = new Date()): Promise<BillingSummary> {
  const summary: BillingSummary = { due: 0, charged: 0, failed: 0, suspended: 0, receiptsIssued: 0 };

  const duePlans = await loadDuePlans({ status: "active", nextBillingDate: { lte: now } });
  summary.due = duePlans.length;

  for (const plan of duePlans) {
    const outcome = await settleDuePlan(plan, now);
    if (outcome === "charged") {
      summary.charged += 1;
      summary.receiptsIssued += 1;
    } else {
      summary.failed += 1;
      if (outcome === "suspended") summary.suspended += 1;
    }
  }

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
