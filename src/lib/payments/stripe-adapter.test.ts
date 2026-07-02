import { describe, it, expect, vi } from "vitest";
import { createHmac } from "crypto";
import { StripeAdapter } from "./stripe-adapter";

const KEY = "sk_test_abc123";
const WHSEC = "whsec_testsecret";

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function adapter(fetchImpl: typeof fetch, secretKey = KEY) {
  return new StripeAdapter({ secretKey, webhookSecret: WHSEC, fetchImpl });
}

function signedWebhook(payload: object, secret = WHSEC, timestamp = Math.floor(Date.now() / 1000)) {
  const body = JSON.stringify(payload);
  const v1 = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return { headers: { "stripe-signature": `t=${timestamp},v1=${v1}` }, body };
}

describe("StripeAdapter.charge", () => {
  it("creates a confirmed PaymentIntent and maps success", async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      expect(String(url)).toBe("https://api.stripe.com/v1/payment_intents");
      const params = new URLSearchParams(String(init?.body));
      expect(params.get("amount")).toBe("5000"); // $50.00 → cents
      expect(params.get("currency")).toBe("cad");
      expect(params.get("confirm")).toBe("true");
      expect(params.get("metadata[orgId]")).toBe("org_1");
      expect((init?.headers as Record<string, string>)["Idempotency-Key"]).toBe("idem-1");
      return jsonResponse({ id: "pi_123", status: "succeeded" });
    }) as unknown as typeof fetch;

    const result = await adapter(fetchImpl).charge({
      orgId: "org_1",
      providerToken: "pm_card_visa",
      money: { amount: 50, currency: "CAD" },
      idempotencyKey: "idem-1",
    });
    expect(result).toEqual({ success: true, providerChargeRef: "pi_123" });
  });

  it("maps stored composite tokens to customer + off_session", async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const params = new URLSearchParams(String(init?.body));
      expect(params.get("customer")).toBe("cus_9");
      expect(params.get("payment_method")).toBe("pm_9");
      expect(params.get("off_session")).toBe("true");
      return jsonResponse({ id: "pi_9", status: "succeeded" });
    }) as unknown as typeof fetch;

    const result = await adapter(fetchImpl).charge({
      orgId: "org_1",
      providerToken: "cus_9|pm_9",
      money: { amount: 25, currency: "CAD" },
      idempotencyKey: "idem-2",
    });
    expect(result.success).toBe(true);
  });

  it("bridges the mock one-off placeholder to a test PaymentMethod ONLY in test mode", async () => {
    const seen: string[] = [];
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      seen.push(new URLSearchParams(String(init?.body)).get("payment_method") ?? "");
      return jsonResponse({ id: "pi_x", status: "succeeded" });
    }) as unknown as typeof fetch;

    await adapter(fetchImpl).charge({
      orgId: "o",
      providerToken: "tok_public_oneoff",
      money: { amount: 10, currency: "CAD" },
      idempotencyKey: "i1",
    });
    await adapter(fetchImpl, "sk_live_abc").charge({
      orgId: "o",
      providerToken: "tok_public_oneoff",
      money: { amount: 10, currency: "CAD" },
      idempotencyKey: "i2",
    });
    expect(seen).toEqual(["pm_card_visa", "tok_public_oneoff"]);
  });

  it("maps a card decline to a failed ChargeResult", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(
        {
          error: {
            type: "card_error",
            code: "card_declined",
            decline_code: "insufficient_funds",
            message: "Your card has insufficient funds.",
            payment_intent: { id: "pi_declined" },
          },
        },
        402
      )
    ) as unknown as typeof fetch;

    const result = await adapter(fetchImpl).charge({
      orgId: "org_1",
      providerToken: "pm_card_visa",
      money: { amount: 10, currency: "CAD" },
      idempotencyKey: "idem-3",
    });
    expect(result.success).toBe(false);
    expect(result.failureCode).toBe("insufficient_funds");
    expect(result.providerChargeRef).toBe("pi_declined");
  });

  it("treats a non-succeeded intent status as failure", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ id: "pi_ra", status: "requires_action" })
    ) as unknown as typeof fetch;

    const result = await adapter(fetchImpl).charge({
      orgId: "org_1",
      providerToken: "pm_x",
      money: { amount: 10, currency: "CAD" },
      idempotencyKey: "idem-4",
    });
    expect(result.success).toBe(false);
    expect(result.failureCode).toBe("intent_requires_action");
  });
});

describe("StripeAdapter.refund", () => {
  it("refunds by payment intent, converting partial amounts to cents", async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      expect(String(url)).toBe("https://api.stripe.com/v1/refunds");
      const params = new URLSearchParams(String(init?.body));
      expect(params.get("payment_intent")).toBe("pi_123");
      expect(params.get("amount")).toBe("1250");
      return jsonResponse({ id: "re_1", status: "succeeded" });
    }) as unknown as typeof fetch;

    const result = await adapter(fetchImpl).refund({
      orgId: "org_1",
      providerChargeRef: "pi_123",
      money: { amount: 12.5, currency: "CAD" },
      idempotencyKey: "idem-r",
    });
    expect(result).toEqual({ success: true, providerRefundRef: "re_1" });
  });
});

describe("StripeAdapter.enrollPaymentMethod", () => {
  it("creates a customer, attaches the method, returns a composite token", async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).endsWith("/customers")) return jsonResponse({ id: "cus_1" });
      expect(String(url)).toContain("/payment_methods/pm_1/attach");
      return jsonResponse({
        id: "pm_1",
        type: "card",
        card: { brand: "visa", last4: "4242", exp_month: 12, exp_year: 2030 },
      });
    }) as unknown as typeof fetch;

    const token = await adapter(fetchImpl).enrollPaymentMethod({
      orgId: "org_1",
      donorId: "don_1",
      gatewayToken: "pm_1",
    });
    expect(token.providerToken).toBe("cus_1|pm_1");
    expect(token.last4).toBe("4242");
    expect(token.type).toBe("card");
  });
});

describe("StripeAdapter.verifyWebhook", () => {
  const event = {
    id: "evt_1",
    type: "payment_intent.succeeded",
    data: { object: { id: "pi_123", metadata: { orgId: "org_1" } } },
  };

  it("accepts a correctly signed event and normalizes it", async () => {
    const result = await adapter(vi.fn() as unknown as typeof fetch).verifyWebhook(
      signedWebhook(event)
    );
    expect(result).toMatchObject({
      id: "evt_1",
      type: "payment.succeeded",
      orgId: "org_1",
      providerChargeRef: "pi_123",
    });
  });

  it("uses payment_intent for charge-level events", async () => {
    const refund = {
      id: "evt_2",
      type: "charge.refunded",
      data: { object: { id: "ch_1", payment_intent: "pi_777" } },
    };
    const result = await adapter(vi.fn() as unknown as typeof fetch).verifyWebhook(
      signedWebhook(refund)
    );
    expect(result.type).toBe("refund.succeeded");
    expect(result.providerChargeRef).toBe("pi_777");
  });

  it("rejects a bad signature", async () => {
    const forged = signedWebhook(event, "whsec_wrong");
    await expect(
      adapter(vi.fn() as unknown as typeof fetch).verifyWebhook(forged)
    ).rejects.toThrow(/signature verification failed/);
  });

  it("rejects a stale timestamp (replay)", async () => {
    const old = signedWebhook(event, WHSEC, Math.floor(Date.now() / 1000) - 3600);
    await expect(
      adapter(vi.fn() as unknown as typeof fetch).verifyWebhook(old)
    ).rejects.toThrow(/timestamp outside tolerance/);
  });

  it("rejects unhandled event types", async () => {
    const other = signedWebhook({ id: "evt_3", type: "customer.created", data: { object: {} } });
    await expect(
      adapter(vi.fn() as unknown as typeof fetch).verifyWebhook(other)
    ).rejects.toThrow(/unhandled event type/);
  });
});
