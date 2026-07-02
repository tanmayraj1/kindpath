import { adminDb } from "@/lib/db";
import { getPaymentProvider } from "@/lib/payments";
import { nextReceiptSerial, formatAddress } from "@/lib/receipts";
import { sendReceiptEmail, sendBillingFailureEmail } from "@/lib/notifications";

const RETRY_DAYS = [3, 5, 7]; // backoff schedule; suspend after the last
const MAX_RETRIES = RETRY_DAYS.length;

const FREQ_DAYS: Record<string, number> = {
  weekly: 7,
  monthly: 30,
  quarterly: 90,
  annual: 365,
};

function addDays(d: Date, n: number) {
  return new Date(d.getTime() + n * 86400 * 1000);
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
  const provider = getPaymentProvider();
  const summary: BillingSummary = { due: 0, charged: 0, failed: 0, suspended: 0, receiptsIssued: 0 };

  const duePlans = await adminDb.recurringPlan.findMany({
    where: { status: "active", nextBillingDate: { lte: now } },
    include: { donor: true, org: true, paymentMethod: true, fund: true },
  });
  summary.due = duePlans.length;

  for (const plan of duePlans) {
    const amount = Number(plan.amount);
    const token = plan.paymentMethod?.providerToken ?? plan.providerRecurringRef ?? "tok_recurring";

    const charge = await provider.charge({
      orgId: plan.orgId,
      providerToken: token,
      money: { amount, currency: plan.currency },
      idempotencyKey: `${plan.id}:${plan.nextBillingDate?.toISOString() ?? ""}`,
    });

    await adminDb.$transaction(async (tx) => {
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
        summary.receiptsIssued += 1;

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
            nextBillingDate: addDays(now, FREQ_DAYS[plan.frequency] ?? 30),
          },
        });
        summary.charged += 1;
      } else {
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
        summary.failed += 1;
        if (suspend) summary.suspended += 1;
      }
    });
  }

  return summary;
}
