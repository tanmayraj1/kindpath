import { orderBinding } from "@/lib/payments/order-binding";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireDonor } from "@/lib/auth/guards";
import { withTenant } from "@/lib/tenant";
import { getPaymentProviderForOrg, supportsHostedSale } from "@/lib/payments";
import { verifyHostedState, HOSTED_STATE_COOKIE } from "@/lib/hosted-state";
import { nextReceiptSerial, formatAddress } from "@/lib/receipts";
import { queueReceiptEmail, flushEmails } from "@/lib/notifications";
import { isDuplicateChargeError } from "@/lib/donations";
import { captureError } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Return point after a donor pays their recurring gift with a new card.
 *
 * Everything here is server-verified. The gateway's `success=1` is ignored, the
 * transaction is confirmed against the provider, the charged amount is compared
 * to the amount we signed into the state cookie, and the plan being updated
 * comes from that signed state rather than the query string — so a returning
 * browser cannot point a payment at somebody else's gift.
 *
 * The whole update is one transaction: record the donation, issue the receipt,
 * save the new method and attach it to the plan. A partial apply here would mean
 * a donor charged with either no receipt or a gift still bound to the dead card.
 *
 * A route handler rather than a page: it has to clear the one-shot state cookie,
 * which a Server Component is not allowed to do.
 */
export async function GET(req: Request) {
  const session = await requireDonor();
  const url = new URL(req.url);
  const searchParams = {
    transactionId: url.searchParams.get("transactionId") ?? undefined,
    paymentOrderId: url.searchParams.get("paymentOrderId") ?? undefined,
    cancelled: url.searchParams.get("cancelled") ?? undefined,
  };

  const state = verifyHostedState(cookies().get(HOSTED_STATE_COOKIE)?.value);

  const done = (reason: string) => {
    const res = NextResponse.redirect(new URL(`/portal/recurring?update=${reason}`, req.url));
    // One-shot: cleared on every path so a refresh can't replay the confirmation.
    res.cookies.delete(HOSTED_STATE_COOKIE);
    return res;
  };

  if (searchParams.cancelled) return done("cancelled");

  const { transactionId, paymentOrderId } = searchParams;
  if (
    !state ||
    state.kind !== "plan_card" ||
    !state.recurringPlanId ||
    state.orgId !== session.orgId ||
    state.donorId !== session.sub ||
    !transactionId ||
    !paymentOrderId ||
    state.paymentOrderId !== paymentOrderId
  ) {
    return done("expired");
  }
  const st = state;
  const planId = st.recurringPlanId!;

  const provider = await getPaymentProviderForOrg(session.orgId);
  if (!supportsHostedSale(provider)) return done("unavailable");

  const confirmed = await provider.confirmTransaction(transactionId!);
  if (!confirmed.success) return done("declined");

  // Bound to the order we opened for this charity's merchant — see order-binding.ts.
  const binding = orderBinding(provider.name, confirmed.paymentOrderId, st.paymentOrderId);
  if (binding !== "ok") {
    captureError(new Error(`card update order binding ${binding}`), {
      source: "portal.cardUpdate",
      orgId: session.orgId,
      transactionId,
    });
  }
  if (binding === "mismatch") return done("mismatch");

  // The gateway must have charged what we asked for.
  if (confirmed.amount != null && Math.abs(confirmed.amount - st.amount) > 0.01) {
    captureError(new Error("card update amount mismatch"), {
      source: "portal.cardUpdate",
      expected: st.amount,
      charged: confirmed.amount,
      transactionId,
    });
    return done("mismatch");
  }

  const chargeRef = confirmed.providerChargeRef;

  let emails: Awaited<ReturnType<typeof queueReceiptEmail>>[] = [];
  try {
    emails = await withTenant(session.orgId, async (tx) => {
      const plan = await tx.recurringPlan.findFirst({
        where: { id: planId, donorId: session.sub },
      });
      const donor = await tx.donor.findFirst({ where: { id: session.sub } });
      const org = await tx.organization.findUnique({ where: { id: session.orgId } });
      if (!plan || !donor || !org) throw new Error("plan, donor or org missing");

      const method = await tx.donorPaymentMethod.create({
        data: {
          orgId: session.orgId,
          donorId: donor.id,
          // The gateway's reusable token when it gave us one, else the
          // transaction id — which is what WeVend's sale-with-token expects.
          providerToken: confirmed.providerToken || `tok_${chargeRef}`,
          brand: confirmed.cardBrand ?? null,
          last4: confirmed.last4 ?? null,
          isDefault: true,
        },
      });

      // Any previous default is no longer the card we'd bill.
      await tx.donorPaymentMethod.updateMany({
        where: { donorId: donor.id, id: { not: method.id } },
        data: { isDefault: false },
      });

      const donation = await tx.donation.create({
        data: {
          orgId: session.orgId,
          donorId: donor.id,
          fundId: plan.fundId,
          recurringPlanId: plan.id,
          type: "recurring",
          amount: st.amount,
          advantageValue: 0,
          eligibleAmount: st.amount,
          currency: st.currency,
          status: "succeeded",
          providerChargeRef: chargeRef,
          chargeKey: chargeRef, // unique — the double-submit guard
          receivedAt: new Date(),
        },
      });

      const year = new Date().getFullYear();
      const registered = org.charityStatus === "registered";
      const serial = await nextReceiptSerial(tx, org.id, year, org.receiptPrefix);
      const receipt = await tx.receipt.create({
        data: {
          orgId: org.id,
          donationId: donation.id,
          donorId: donor.id,
          serialNumber: serial,
          documentType: registered ? "official" : "confirmation",
          donorNameSnapshot: [donor.firstName, donor.middleInitial, donor.lastName]
            .filter(Boolean)
            .join(" "),
          donorAddressSnapshot: formatAddress({
            addressLine1: donor.addressLine1,
            city: donor.city,
            province: donor.province,
            postalCode: donor.postalCode,
            country: "CA",
          }),
          orgNameSnapshot: org.name,
          orgRegNumberSnapshot: org.craRegistrationNumber,
          amount: st.amount,
          advantageValue: 0,
          eligibleAmount: st.amount,
          placeIssued: org.receiptLocality,
          dateDonationReceived: donation.receivedAt,
          signatoryNameSnapshot: registered ? org.authorizedSignatory : null,
          year,
        },
      });

      // The gift resumes on the new card, and the failure counter resets so the
      // dunning sequence doesn't suspend a plan that has just been paid.
      await tx.recurringPlan.update({
        where: { id: plan.id },
        data: {
          paymentMethodId: method.id,
          status: "active",
          retryCount: 0,
          nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      return [
        await queueReceiptEmail(tx, {
          orgId: org.id,
          donorId: donor.id,
          donorEmail: donor.email,
          donorName: `${donor.firstName} ${donor.lastName}`,
          orgName: org.name,
          receiptId: receipt.id,
          serialNumber: serial,
          eligibleAmount: st.amount,
          official: registered,
          brandColor: org.primaryColor,
          logoUrl: org.logoUrl,
        }),
      ];
    });
  } catch (e) {
    // The card HAS been charged by this point. Never show a bare crash page for
    // that; the donation is recoverable from the gateway reference we log.
    if (isDuplicateChargeError(e)) return done("ok");
    captureError(e, { source: "portal.cardUpdate.record", planId, chargeRef });
    return done("charged_not_recorded");
  }

  // After the commit, so a mail outage can't roll back a recorded gift.
  await flushEmails(emails);

  return done("ok");
}
