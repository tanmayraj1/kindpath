import type { PaymentProvider } from "./provider";
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
 * In-memory simulation of a payment processor for local dev + tests.
 * Lets the full donation → receipt → recurring → refund lifecycle run before
 * the real client POS API exists. Deterministic, no network.
 *
 * Test hook: charges with an amount ending in .01 are simulated as DECLINED,
 * so failed-payment + retry flows can be exercised.
 */
export class MockAdapter implements PaymentProvider {
  readonly name = "mock";

  private id(prefix: string) {
    // Deterministic-enough unique id without Math.random/Date in hot paths.
    return `${prefix}_${Buffer.from(`${prefix}:${process.hrtime.bigint()}`).toString("hex").slice(0, 18)}`;
  }

  async enrollPaymentMethod(input: EnrollInput): Promise<PaymentToken> {
    return {
      providerToken: this.id("tok"),
      type: input.type ?? "card",
      brand: "Visa",
      last4: "4242",
      expMonth: 12,
      expYear: 2030,
    };
  }

  async charge(input: ChargeInput): Promise<ChargeResult> {
    const declined = Math.round(input.money.amount * 100) % 100 === 1;
    if (declined) {
      return {
        success: false,
        providerChargeRef: this.id("ch"),
        failureCode: "card_declined",
        failureMessage: "The card was declined (simulated).",
      };
    }
    return { success: true, providerChargeRef: this.id("ch") };
  }

  async createRecurring(_input: RecurringInput): Promise<RecurringRef> {
    return { providerRecurringRef: this.id("sub") };
  }

  async cancelRecurring(_ref: RecurringRef): Promise<void> {
    return;
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    return { success: true, providerRefundRef: this.id("re") };
  }

  async verifyWebhook(req: RawWebhook): Promise<PaymentEvent> {
    // A real adapter verifies an HMAC signature here.
    const parsed = JSON.parse(req.body) as Partial<PaymentEvent>;
    return {
      id: parsed.id ?? this.id("evt"),
      type: parsed.type ?? "payment.succeeded",
      orgId: parsed.orgId,
      providerChargeRef: parsed.providerChargeRef,
      providerRecurringRef: parsed.providerRecurringRef,
      raw: parsed,
    };
  }
}
