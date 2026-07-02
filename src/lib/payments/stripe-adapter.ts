import { createHmac, timingSafeEqual } from "crypto";
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
  PaymentEventType,
} from "./types";

const STRIPE_API = "https://api.stripe.com/v1";
/** Reject webhooks whose timestamp is older than this (replay protection). */
const WEBHOOK_TOLERANCE_SECONDS = 300;

type StripeErrorBody = {
  error?: { code?: string; decline_code?: string; message?: string; type?: string };
};

/**
 * Stripe adapter for the PaymentProvider seam. Talks to the Stripe REST API
 * directly (form-encoded) — no SDK dependency. Configure with:
 *
 *   PAYMENT_PROVIDER=stripe
 *   STRIPE_SECRET_KEY=sk_test_...   (test mode until launch)
 *   STRIPE_WEBHOOK_SECRET=whsec_... (from the Stripe webhook endpoint)
 *
 * Token shapes:
 * - Stored methods (donor portal / recurring): "cus_xxx|pm_xxx" — a customer
 *   with an attached payment method, charged off_session.
 * - One-off public giving: a PaymentMethod id ("pm_...") from Stripe.js.
 *   With a TEST key only, the mock flow's "tok_public_oneoff" placeholder is
 *   mapped to Stripe's "pm_card_visa" test method so the existing giving page
 *   works end-to-end before Elements is wired into the frontend.
 */
export class StripeAdapter implements PaymentProvider {
  readonly name = "stripe";

  private readonly secretKey: string;
  private readonly webhookSecret: string;
  /** Injectable for tests. */
  private readonly fetchImpl: typeof fetch;

  constructor(opts?: { secretKey?: string; webhookSecret?: string; fetchImpl?: typeof fetch }) {
    this.secretKey = opts?.secretKey ?? process.env.STRIPE_SECRET_KEY ?? "";
    this.webhookSecret = opts?.webhookSecret ?? process.env.STRIPE_WEBHOOK_SECRET ?? "";
    this.fetchImpl = opts?.fetchImpl ?? fetch;
    if (!this.secretKey) {
      throw new Error("PAYMENT_PROVIDER=stripe requires STRIPE_SECRET_KEY");
    }
  }

  private get isTestMode() {
    return this.secretKey.startsWith("sk_test_");
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    params?: Record<string, string>,
    idempotencyKey?: string
  ): Promise<{ ok: boolean; status: number; body: T & StripeErrorBody }> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    };
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

    const res = await this.fetchImpl(`${STRIPE_API}${path}`, {
      method,
      headers,
      body: method === "POST" && params ? new URLSearchParams(params).toString() : undefined,
    });
    const body = (await res.json()) as T & StripeErrorBody;
    return { ok: res.ok, status: res.status, body };
  }

  async enrollPaymentMethod(input: EnrollInput): Promise<PaymentToken> {
    // gatewayToken is a PaymentMethod id from Stripe.js hosted fields — never raw PAN.
    const customer = await this.request<{ id: string }>("POST", "/customers", {
      "metadata[orgId]": input.orgId,
      "metadata[donorId]": input.donorId,
    });
    if (!customer.ok) {
      throw new Error(customer.body.error?.message ?? "Stripe: could not create customer");
    }

    const pm = await this.request<{
      id: string;
      type: string;
      card?: { brand: string; last4: string; exp_month: number; exp_year: number };
    }>("POST", `/payment_methods/${encodeURIComponent(input.gatewayToken)}/attach`, {
      customer: customer.body.id,
    });
    if (!pm.ok) {
      throw new Error(pm.body.error?.message ?? "Stripe: could not attach payment method");
    }

    return {
      providerToken: `${customer.body.id}|${pm.body.id}`,
      type: pm.body.type === "card" ? "card" : "bank",
      brand: pm.body.card?.brand,
      last4: pm.body.card?.last4,
      expMonth: pm.body.card?.exp_month,
      expYear: pm.body.card?.exp_year,
    };
  }

  async charge(input: ChargeInput): Promise<ChargeResult> {
    const params: Record<string, string> = {
      amount: String(Math.round(input.money.amount * 100)),
      currency: input.money.currency.toLowerCase(),
      confirm: "true",
      "metadata[orgId]": input.orgId,
      // Redirect-based methods can't complete in a server-side confirm.
      "automatic_payment_methods[enabled]": "true",
      "automatic_payment_methods[allow_redirects]": "never",
    };
    for (const [k, v] of Object.entries(input.metadata ?? {})) {
      params[`metadata[${k}]`] = v;
    }

    let token = input.providerToken;
    // Test-mode bridge: the pre-Elements giving page sends the mock placeholder.
    if (token === "tok_public_oneoff" && this.isTestMode) token = "pm_card_visa";

    if (token.includes("|")) {
      const [customer, pm] = token.split("|");
      params.customer = customer;
      params.payment_method = pm;
      params.off_session = "true";
    } else {
      params.payment_method = token;
    }

    const res = await this.request<{ id: string; status: string }>(
      "POST",
      "/payment_intents",
      params,
      input.idempotencyKey
    );

    if (!res.ok) {
      return {
        success: false,
        providerChargeRef: res.body.error?.type === "card_error" ? (res.body as { error?: { payment_intent?: { id?: string } } }).error?.payment_intent?.id ?? "" : "",
        failureCode: res.body.error?.decline_code ?? res.body.error?.code ?? "charge_failed",
        failureMessage: res.body.error?.message ?? "The payment could not be processed.",
      };
    }
    if (res.body.status !== "succeeded") {
      return {
        success: false,
        providerChargeRef: res.body.id,
        failureCode: `intent_${res.body.status}`,
        failureMessage: "The payment did not complete.",
      };
    }
    return { success: true, providerChargeRef: res.body.id };
  }

  async createRecurring(_input: RecurringInput): Promise<RecurringRef> {
    // KindPath's billing cron owns the schedule and calls charge() each period,
    // so no Stripe Subscription is created — the ref is synthetic.
    return { providerRecurringRef: `kp_sched_${Buffer.from(`${_input.orgId}:${process.hrtime.bigint()}`).toString("hex").slice(0, 18)}` };
  }

  async cancelRecurring(_ref: RecurringRef): Promise<void> {
    // Nothing provider-side to cancel (see createRecurring).
    return;
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    const params: Record<string, string> = {
      payment_intent: input.providerChargeRef,
    };
    if (input.money) params.amount = String(Math.round(input.money.amount * 100));

    const res = await this.request<{ id: string; status: string }>(
      "POST",
      "/refunds",
      params,
      input.idempotencyKey
    );
    if (!res.ok) {
      throw new Error(res.body.error?.message ?? "Stripe: refund failed");
    }
    return { success: res.body.status !== "failed", providerRefundRef: res.body.id };
  }

  async verifyWebhook(req: RawWebhook): Promise<PaymentEvent> {
    if (!this.webhookSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET is not set — cannot verify webhook");
    }
    const header =
      req.headers["stripe-signature"] ?? req.headers["Stripe-Signature"] ?? "";
    const parts = Object.fromEntries(
      header.split(",").map((p) => p.split("=", 2) as [string, string])
    );
    const timestamp = Number(parts.t);
    const signature = parts.v1;
    if (!timestamp || !signature) {
      throw new Error("Stripe webhook: missing or malformed signature header");
    }

    const expected = createHmac("sha256", this.webhookSecret)
      .update(`${timestamp}.${req.body}`)
      .digest("hex");
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(signature, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new Error("Stripe webhook: signature verification failed");
    }
    if (Math.abs(Date.now() / 1000 - timestamp) > WEBHOOK_TOLERANCE_SECONDS) {
      throw new Error("Stripe webhook: timestamp outside tolerance");
    }

    const event = JSON.parse(req.body) as {
      id: string;
      type: string;
      data?: { object?: { id?: string; payment_intent?: string; metadata?: Record<string, string> } };
    };
    const obj = event.data?.object ?? {};

    const typeMap: Record<string, PaymentEventType> = {
      "payment_intent.succeeded": "payment.succeeded",
      "payment_intent.payment_failed": "payment.failed",
      "charge.refunded": "refund.succeeded",
      "refund.created": "refund.succeeded",
    };
    const mapped = typeMap[event.type];
    if (!mapped) {
      throw new Error(`Stripe webhook: unhandled event type ${event.type}`);
    }

    return {
      id: event.id,
      type: mapped,
      orgId: obj.metadata?.orgId,
      // For charge/refund events the intent id lives on payment_intent; for
      // payment_intent events it's the object id itself.
      providerChargeRef: obj.payment_intent ?? obj.id,
      raw: event,
    };
  }
}
