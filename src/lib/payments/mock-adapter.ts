import { createHmac, timingSafeEqual } from "node:crypto";
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
  HostedSaleInput,
  HostedSaleInit,
  ConfirmResult,
} from "./types";

/**
 * In-memory simulation of a payment processor for local dev + tests.
 * Lets the full donation → receipt → recurring → refund lifecycle run before
 * the real client POS API exists. Deterministic, no network.
 *
 * Test hook: charges with an amount ending in .01 are simulated as DECLINED,
 * so failed-payment + retry flows can be exercised.
 *
 * Hosted mode (PAYMENT_PROVIDER=mock-hosted): simulates a WeVend-style
 * redirect gateway. beginHostedSale "redirects" to the local /mock-gateway
 * page (a clearly-labelled fake card form) which bounces back to the app's
 * /response URL — so the entire hosted flow is E2E-testable with no gateway.
 * The amount is encoded in the order id (stateless): cents ending in 01 decline.
 */
export class MockAdapter implements PaymentProvider {
  readonly name = "mock";

  constructor(private readonly opts: { hosted?: boolean } = {}) {
    if (opts.hosted) {
      // Presence of these methods is what supportsHostedSale() detects, so
      // plain mock mode must NOT expose them. Assign per-instance in hosted mode.
      this.beginHostedSale = async (input: HostedSaleInput): Promise<HostedSaleInit> => {
        const cents = Math.round(input.money.amount * 100);
        const paymentOrderId = `mpo_${cents}_${this.id("po").slice(-6)}`;
        const redirect = encodeURIComponent(input.redirectUrl);
        return {
          paymentOrderId,
          redirectTo: `/mock-gateway/${paymentOrderId}?redirect=${redirect}`,
        };
      };
      this.confirmTransaction = async (transactionId: string): Promise<ConfirmResult> => {
        // transactionId format mirrors beginHostedSale: mtx_<cents>_<rand>
        const cents = Number(transactionId.split("_")[1] ?? 0);
        const declined = cents % 100 === 1;
        return declined
          ? {
              success: false,
              providerChargeRef: transactionId,
              amount: cents / 100,
              failureCode: "card_declined",
              failureMessage: "The card was declined (simulated).",
            }
          : {
              success: true,
              providerChargeRef: transactionId,
              amount: cents / 100,
              cardBrand: "Visa",
              last4: "4242",
            };
      };
    }
  }

  beginHostedSale?: (input: HostedSaleInput) => Promise<HostedSaleInit>;
  confirmTransaction?: (transactionId: string) => Promise<ConfirmResult>;

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

  /**
   * Verify + normalize a simulated webhook.
   *
   * This used to be a bare `JSON.parse` with no signature at all. Because
   * `getPaymentProvider()` falls back to MockAdapter for any unset or
   * unrecognized PAYMENT_PROVIDER, that made `POST /api/webhooks/pos` an
   * unauthenticated endpoint that could forge a `refund.succeeded` event and
   * VOID a real charity's official tax receipt. A test double must never be an
   * authentication bypass.
   *
   * Now: refuses outright in production, and otherwise requires an HMAC over the
   * raw body keyed by WEBHOOK_TEST_SECRET (falling back to AUTH_SECRET in dev so
   * local testing still works without extra setup).
   */
  async verifyWebhook(req: RawWebhook): Promise<PaymentEvent> {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "The mock payment adapter does not accept webhooks in production. " +
          "Set PAYMENT_PROVIDER to a real provider."
      );
    }

    const secret = process.env.WEBHOOK_TEST_SECRET ?? process.env.AUTH_SECRET;
    if (!secret) {
      throw new Error("Mock webhook verification requires WEBHOOK_TEST_SECRET or AUTH_SECRET.");
    }

    const provided = req.headers["x-kindpath-signature"] ?? req.headers["X-KindPath-Signature"];
    if (!provided) throw new Error("Missing x-kindpath-signature header.");

    const expected = createHmac("sha256", secret).update(req.body).digest("hex");
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new Error("Invalid webhook signature.");
    }

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
