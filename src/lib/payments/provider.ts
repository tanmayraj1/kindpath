import type {
  EnrollInput,
  PaymentToken,
  ChargeInput,
  ChargeResult,
  RecurringInput,
  RecurringRef,
  RefundInput,
  RefundResult,
  RawWebhook,
  PaymentEvent,
  HostedSaleInput,
  HostedSaleInit,
  ConfirmResult,
} from "./types";

/**
 * The single seam between KindPath and any payment processor.
 * Implement this interface once per provider (MockAdapter now, ClientPosAdapter later).
 * No business logic changes when the provider changes — only the adapter.
 */
export interface PaymentProvider {
  readonly name: string;

  /** Tokenize a payment method. Returns a provider token; never stores raw data. */
  enrollPaymentMethod(input: EnrollInput): Promise<PaymentToken>;

  /** Charge a one-time amount against a stored token. */
  charge(input: ChargeInput): Promise<ChargeResult>;

  /** Create a recurring schedule (if the provider manages recurring server-side). */
  createRecurring(input: RecurringInput): Promise<RecurringRef>;

  /** Cancel a provider-managed recurring schedule. */
  cancelRecurring(ref: RecurringRef): Promise<void>;

  /** Refund a charge (full or partial). */
  refund(input: RefundInput): Promise<RefundResult>;

  /** Verify signature + normalize an inbound webhook into a PaymentEvent. */
  verifyWebhook(req: RawWebhook): Promise<PaymentEvent>;

  // ---- optional: hosted/redirect-flow gateways (e.g. WeVend iframe) ----

  /** Create a hosted sale order and return where to redirect the donor for card entry. */
  beginHostedSale?(input: HostedSaleInput): Promise<HostedSaleInit>;

  /** Server-side confirm a returned transaction (never trust the redirect's success flag). */
  confirmTransaction?(transactionId: string): Promise<ConfirmResult>;

  /** Void a sale/pre-auth transaction (not a completion). */
  voidTransaction?(providerChargeRef: string): Promise<{ success: boolean; providerRef: string }>;
}

/** Narrow a provider to one that supports the hosted (iframe/redirect) sale flow. */
export function supportsHostedSale(
  p: PaymentProvider
): p is PaymentProvider &
  Required<Pick<PaymentProvider, "beginHostedSale" | "confirmTransaction">> {
  return typeof p.beginHostedSale === "function" && typeof p.confirmTransaction === "function";
}
