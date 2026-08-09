import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHmac } from "node:crypto";
import { MockAdapter } from "./mock-adapter";

/**
 * These tests exist because of a real vulnerability, not for coverage.
 *
 * `getPaymentProvider()` falls back to MockAdapter for any unset or unrecognized
 * PAYMENT_PROVIDER. Its `verifyWebhook` used to be a bare `JSON.parse` with no
 * signature check, which made `POST /api/webhooks/pos` an unauthenticated way to
 * forge a `refund.succeeded` event and VOID a real charity's official tax
 * receipt. Every case below is a regression guard on that.
 */

const SECRET = "test-webhook-secret-at-least-32-chars-long";
const ORIGINAL_SECRET = process.env.WEBHOOK_TEST_SECRET;

function sign(body: string, secret = SECRET) {
  return createHmac("sha256", secret).update(body).digest("hex");
}

function webhook(body: string, signature?: string) {
  const headers: Record<string, string> = {};
  if (signature) headers["x-kindpath-signature"] = signature;
  return { headers, body };
}

const EVENT = JSON.stringify({
  id: "evt_1",
  type: "refund.succeeded",
  providerChargeRef: "ch_victim",
});

beforeEach(() => {
  process.env.WEBHOOK_TEST_SECRET = SECRET;
});

afterEach(() => {
  vi.unstubAllEnvs();
  if (ORIGINAL_SECRET === undefined) delete process.env.WEBHOOK_TEST_SECRET;
  else process.env.WEBHOOK_TEST_SECRET = ORIGINAL_SECRET;
});

describe("MockAdapter.verifyWebhook — signature enforcement", () => {
  it("REJECTS an unsigned payload", async () => {
    // This is the exact request that previously voided receipts.
    await expect(new MockAdapter().verifyWebhook(webhook(EVENT))).rejects.toThrow(
      /missing x-kindpath-signature/i
    );
  });

  it("REJECTS a payload signed with the wrong secret", async () => {
    await expect(
      new MockAdapter().verifyWebhook(webhook(EVENT, sign(EVENT, "attacker-secret")))
    ).rejects.toThrow(/invalid webhook signature/i);
  });

  it("REJECTS a signature for a different body (no replay onto new content)", async () => {
    const otherBody = JSON.stringify({ id: "evt_2", type: "refund.succeeded" });
    await expect(
      new MockAdapter().verifyWebhook(webhook(EVENT, sign(otherBody)))
    ).rejects.toThrow(/invalid webhook signature/i);
  });

  it("REJECTS a truncated signature rather than comparing prefixes", async () => {
    const full = sign(EVENT);
    await expect(
      new MockAdapter().verifyWebhook(webhook(EVENT, full.slice(0, 20)))
    ).rejects.toThrow(/invalid webhook signature/i);
  });

  it("accepts a correctly signed payload and normalizes it", async () => {
    const event = await new MockAdapter().verifyWebhook(webhook(EVENT, sign(EVENT)));
    expect(event).toMatchObject({
      id: "evt_1",
      type: "refund.succeeded",
      providerChargeRef: "ch_victim",
    });
  });
});

describe("MockAdapter.verifyWebhook — production refusal", () => {
  it("refuses ALL webhooks in production, even correctly signed ones", async () => {
    vi.stubEnv("NODE_ENV", "production");
    // Defence in depth: env.ts also rejects PAYMENT_PROVIDER=mock in production,
    // but the adapter must not rely on that being configured correctly.
    await expect(
      new MockAdapter().verifyWebhook(webhook(EVENT, sign(EVENT)))
    ).rejects.toThrow(/does not accept webhooks in production/i);
  });
});

describe("MockAdapter.verifyWebhook — misconfiguration", () => {
  it("refuses rather than accepting anything when no secret is configured", async () => {
    delete process.env.WEBHOOK_TEST_SECRET;
    const originalAuth = process.env.AUTH_SECRET;
    delete process.env.AUTH_SECRET;
    try {
      await expect(new MockAdapter().verifyWebhook(webhook(EVENT, sign(EVENT)))).rejects.toThrow(
        /requires WEBHOOK_TEST_SECRET/i
      );
    } finally {
      if (originalAuth !== undefined) process.env.AUTH_SECRET = originalAuth;
    }
  });
});
