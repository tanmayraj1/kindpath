import { adminDb } from "@/lib/db";
import type { PaymentEvent } from "@/lib/payments";

/**
 * Apply a normalized payment webhook event. Idempotent at the caller via
 * webhook_events. Runs as the system (adminDb) since webhooks are pre-tenant.
 */
export async function handlePaymentEvent(event: PaymentEvent): Promise<void> {
  switch (event.type) {
    case "refund.succeeded": {
      if (!event.providerChargeRef) return;
      const donation = await adminDb.donation.findFirst({
        where: { providerChargeRef: event.providerChargeRef },
        include: { receipt: true },
      });
      if (!donation) return;

      await adminDb.$transaction(async (tx) => {
        await tx.donation.update({
          where: { id: donation.id },
          data: { status: "refunded" },
        });
        // A refunded gift's receipt must be voided (and retained) for CRA.
        if (donation.receipt && donation.receipt.status === "issued") {
          await tx.receipt.update({
            where: { id: donation.receipt.id },
            data: { status: "voided", voidReason: "Donation refunded" },
          });
        }
        await tx.auditLog.create({
          data: {
            orgId: donation.orgId,
            actorType: "system",
            action: "refund.receipt_voided",
            entityType: "donation",
            entityId: donation.id,
          },
        });
      });
      return;
    }

    case "payment.failed": {
      // Recurring failures are handled in the billing engine; nothing to do here.
      return;
    }

    case "method.expiring":
    case "payment.succeeded":
    default:
      return;
  }
}
