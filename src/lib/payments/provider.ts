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
}
