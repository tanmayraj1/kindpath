/**
 * Provider-agnostic payment types. The rest of KindPath speaks ONLY these types,
 * so swapping the client POS in later is a single adapter (see provider.ts).
 */

export type Money = {
  amount: number; // major units, e.g. 50.00
  currency: string; // "CAD"
};

export type EnrollInput = {
  orgId: string;
  donorId: string;
  // In a real adapter this would be a single-use token from the gateway's
  // hosted fields — never raw PAN. The mock accepts a fake token.
  gatewayToken: string;
  type?: "card" | "bank";
};

export type PaymentToken = {
  providerToken: string;
  type: "card" | "bank";
  brand?: string;
  last4?: string;
  expMonth?: number;
  expYear?: number;
};

export type ChargeInput = {
  orgId: string;
  providerToken: string;
  money: Money;
  idempotencyKey: string;
  metadata?: Record<string, string>;
};

export type ChargeResult = {
  success: boolean;
  providerChargeRef: string;
  failureCode?: string;
  failureMessage?: string;
};

export type RecurringInput = {
  orgId: string;
  providerToken: string;
  money: Money;
  frequency: "weekly" | "monthly" | "quarterly" | "annual";
};

export type RecurringRef = { providerRecurringRef: string };

export type RefundInput = {
  orgId: string;
  providerChargeRef: string;
  money?: Money; // omit for full refund
  idempotencyKey: string;
};

export type RefundResult = {
  success: boolean;
  providerRefundRef: string;
};

export type PaymentEventType =
  | "payment.succeeded"
  | "payment.failed"
  | "refund.succeeded"
  | "method.expiring";

export type PaymentEvent = {
  id: string; // provider event id (idempotency)
  type: PaymentEventType;
  orgId?: string;
  providerChargeRef?: string;
  providerRecurringRef?: string;
  raw: unknown;
};

export type RawWebhook = {
  headers: Record<string, string>;
  body: string;
};

// ---- Hosted (redirect / iframe) payment flow ----
// Gateways like WeVend WePay capture card details in their OWN hosted iframe, then
// redirect the browser back — they don't charge server-side synchronously. These
// types model that flow, which `charge()` alone can't express.

export type HostedSaleInput = {
  orgId: string;
  money: Money;
  /** Provider order id. WeVend requires ≤15 chars; generated if omitted. */
  orderId?: string;
  /** Absolute URL the gateway returns the browser to (WeVend: must end in /response). */
  redirectUrl: string;
  metadata?: Record<string, string>;
  /**
   * Ask the gateway to retain the payment method for future off-session charges.
   * Set for recurring gifts: KindPath's billing cron owns the schedule and charges
   * the saved method each period, so the method must survive this one transaction.
   */
  savePaymentMethod?: boolean;
  /** Prefills the gateway's receipt/contact field where supported. */
  donorEmail?: string;
  /** Shown to the donor on the gateway's own page. */
  description?: string;
};

export type HostedSaleInit = {
  /** Provider order reference — used to poll/confirm and to build the iframe URL. */
  paymentOrderId: string;
  /** Absolute hosted-iframe URL to send the donor to for card entry. */
  redirectTo: string;
};

export type ConfirmResult = {
  success: boolean;
  /** Confirmed transaction id — reusable as the token for `charge()` (sale-with-token). */
  providerChargeRef: string;
  paymentOrderId?: string;
  /** Amount the gateway actually charged, major units — cross-check against intended amount. */
  amount?: number;
  cardBrand?: string;
  last4?: string;
  /**
   * Token for charging this donor again off-session, when `savePaymentMethod` was
   * requested and the gateway retained one. Distinct from `providerChargeRef`:
   * WeVend reuses the transaction id as its token, Stripe returns "cus_x|pm_y".
   */
  providerToken?: string;
  failureCode?: string;
  failureMessage?: string;
};
