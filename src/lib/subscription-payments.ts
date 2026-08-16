import "server-only";
import { adminDb } from "@/lib/db";
import { captureError } from "@/lib/observability";

/**
 * How KindPath collects its OWN subscription fees.
 *
 * This is deliberately a seam, not a payment integration. Billing today is
 * manual: an invoice is issued and someone at the charity arranges an e-transfer
 * or cheque, and support marks it paid. That works for a pilot and it is honest
 * about being what it is — but the billing page said "Payment due" with no way
 * to pay, which is a dead end for the customer.
 *
 * Two things are wired here now:
 *   1. `getPaymentInstructions` — what the org should actually DO, surfaced on
 *      the billing page in place of a button that doesn't exist.
 *   2. `SubscriptionPaymentProvider` — the interface an automated collector will
 *      implement, so switching from manual to card-on-file is one adapter rather
 *      than a rewrite of the invoicing built in Phase 2.
 *
 * Kept strictly separate from src/lib/payments/*: that is the DONOR money path,
 * running against each charity's OWN merchant account. This is KindPath billing
 * its customers, through KindPath's account. Conflating them would be how a
 * charity's donations end up settling to the wrong merchant.
 */

export type SubscriptionPaymentIntent = {
  invoiceId: string;
  orgId: string;
  amount: number;
  currency: string;
  /** Where to send the payer; absent when collection isn't automated yet. */
  redirectTo?: string;
};

export interface SubscriptionPaymentProvider {
  readonly name: string;
  /** Begin collecting an outstanding invoice. */
  beginPayment(invoiceId: string): Promise<SubscriptionPaymentIntent>;
  /** Confirm a payment after the payer returns, and mark the invoice paid. */
  confirmPayment(reference: string): Promise<{ paid: boolean; invoiceId?: string }>;
}

export type PaymentInstructions = {
  /** Whether an org can pay online right now. False while billing is manual. */
  automated: boolean;
  heading: string;
  body: string;
  contactEmail: string;
};

const BILLING_EMAIL = process.env.BILLING_CONTACT_EMAIL ?? "billing@kindpath.ca";

/**
 * What to tell an organization that owes money.
 *
 * When an automated provider is configured this becomes a "Pay now" button; until
 * then it says plainly how to pay and who to reach, which is strictly better than
 * a figure with no next step.
 */
export function getPaymentInstructions(outstanding: number): PaymentInstructions {
  const automated = Boolean(process.env.SUBSCRIPTION_PAYMENT_PROVIDER);

  if (outstanding <= 0) {
    return {
      automated,
      heading: "Nothing owing",
      body: "Your account is paid up. We'll email you when the next invoice is ready.",
      contactEmail: BILLING_EMAIL,
    };
  }

  return {
    automated,
    heading: "How to pay",
    body:
      "Send an Interac e-transfer or cheque for the amount above, quoting your invoice number. " +
      "We'll mark it paid as soon as it arrives — your account stays fully available in the " +
      "meantime, and donations and receipts are never interrupted while an invoice is outstanding.",
    contactEmail: BILLING_EMAIL,
  };
}

/**
 * Resolve the configured collector, or null while billing is manual.
 *
 * Returning null rather than throwing is the point: every caller has to handle
 * "not automated yet", which is what keeps the manual path working.
 */
export function getSubscriptionPaymentProvider(): SubscriptionPaymentProvider | null {
  const name = process.env.SUBSCRIPTION_PAYMENT_PROVIDER;
  if (!name) return null;

  captureError(new Error(`SUBSCRIPTION_PAYMENT_PROVIDER='${name}' is set but no adapter is built`), {
    source: "subscription-payments.resolve",
  });
  return null;
}

/** Outstanding invoices for an org, newest first — what "Payment due" refers to. */
export async function listOutstandingInvoices(orgId: string) {
  return adminDb.subscriptionInvoice.findMany({
    where: { orgId, status: { notIn: ["paid", "void"] } },
    orderBy: { issuedAt: "desc" },
    take: 24,
    select: { id: true, invoiceNumber: true, total: true, status: true, issuedAt: true },
  });
}
