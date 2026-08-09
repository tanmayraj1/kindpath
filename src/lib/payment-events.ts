import { adminDb } from "@/lib/db";
import { withTenant } from "@/lib/tenant";
import { audit } from "@/lib/audit";
import { captureError, log } from "@/lib/observability";
import type { PaymentEvent } from "@/lib/payments";

/**
 * Apply a normalized payment webhook event.
 *
 * Tenant scoping matters here more than almost anywhere else in the app. This
 * runs from an inbound HTTP endpoint, and `refund.succeeded` VOIDS an official
 * tax receipt. The previous version looked the donation up with bare `adminDb`
 * and no org filter, so a single forged or misrouted event could reach into ANY
 * organization's records. Every lookup is now bound to the event's own org.
 *
 * Idempotency is handled by the caller via `webhook_events`.
 */
export async function handlePaymentEvent(event: PaymentEvent): Promise<void> {
  switch (event.type) {
    case "refund.succeeded": {
      if (!event.providerChargeRef) return;

      // Resolve the owning org from the charge reference itself, then do all
      // real work inside that tenant's context. The provider may or may not tell
      // us the org; either way we never act outside the one that owns the charge.
      //
      // `findMany` rather than `findFirst` on purpose. A charge reference should
      // be unique per provider, but if it ever isn't, picking arbitrarily means
      // voiding SOME charity's official tax receipt — possibly not the one whose
      // donor was actually refunded. When it's ambiguous we refuse and escalate.
      const matches = await adminDb.donation.findMany({
        where: {
          providerChargeRef: event.providerChargeRef,
          ...(event.orgId ? { orgId: event.orgId } : {}),
        },
        select: { id: true, orgId: true },
        take: 2,
      });

      if (matches.length === 0) {
        log("warn", "refund webhook for unknown charge", {
          source: "payment-events",
          providerChargeRef: event.providerChargeRef,
          claimedOrgId: event.orgId ?? null,
        });
        return;
      }

      if (matches.length > 1) {
        captureError(new Error("refund webhook matched more than one donation"), {
          source: "payment-events",
          providerChargeRef: event.providerChargeRef,
          claimedOrgId: event.orgId ?? null,
          orgIds: matches.map((m) => m.orgId),
        });
        return;
      }

      const owner = matches[0];
      const orgId = owner.orgId;
      const voided = await withTenant(orgId, async (tx) => {
        const donation = await tx.donation.findFirst({
          where: { id: owner.id },
          include: { receipt: true },
        });
        if (!donation) return null;

        await tx.donation.update({ where: { id: donation.id }, data: { status: "refunded" } });

        // A refunded gift's receipt must be VOIDED and RETAINED for CRA — never
        // deleted. Already-voided receipts are left alone (idempotent).
        if (donation.receipt && donation.receipt.status === "issued") {
          await tx.receipt.update({
            where: { id: donation.receipt.id },
            data: { status: "voided", voidReason: "Donation refunded" },
          });
          return donation.receipt.serialNumber;
        }
        return "";
      });

      if (voided === null) return;
      await audit({
        actor: { type: "system" },
        orgId,
        action: "refund.receipt_voided",
        entityType: "donation",
        entityId: owner.id,
        after: { serialNumber: voided || null, providerChargeRef: event.providerChargeRef },
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
