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
