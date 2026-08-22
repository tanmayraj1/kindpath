import { describe, it, expect } from "vitest";
import { verifyInboundWebhook, candidateOrgIdFromBody } from "./webhook-verify";
import { UnsupportedWebhookEvent, type PaymentEvent } from "./types";
import type { PaymentProvider } from "./provider";

/**
 * The property under test: a webhook signed by an org's OWN gateway is still
 * accepted, and a payload that verifies against nothing is still rejected.
 */

const event = (id: string): PaymentEvent => ({ id, type: "refund.succeeded", raw: {} });

function provider(name: string, behaviour: "ok" | "bad-sig" | "unsupported"): PaymentProvider {
  return {
    name,
    verifyWebhook: async () => {
      if (behaviour === "ok") return event(`evt_${name}`);
      if (behaviour === "unsupported") throw new UnsupportedWebhookEvent("customer.created");
      throw new Error("Stripe webhook: signature verification failed");
    },
  } as unknown as PaymentProvider;
}

const body = (obj: Record<string, unknown>) => JSON.stringify({ data: { object: obj } });

describe("verifyInboundWebhook", () => {
  it("accepts the platform gateway's own webhooks without touching org lookups", async () => {
    let looked = false;
    const r = await verifyInboundWebhook(
      { headers: {}, body: body({ id: "pi_1" }) },
      {
        platform: () => provider("platform", "ok"),
        forOrg: async () => provider("org", "ok"),
        orgIdForChargeRef: async () => {
          looked = true;
          return "org_1";
        },
      }
    );
    expect(r.event.id).toBe("evt_platform");
    expect(looked).toBe(false);
  });

  it("falls back to the org named in metadata when the platform secret doesn't match", async () => {
    const r = await verifyInboundWebhook(
      { headers: {}, body: body({ id: "pi_1", metadata: { orgId: "org_1" } }) },
      {
        platform: () => provider("platform", "bad-sig"),
        forOrg: async (id) => provider(`org:${id}`, "ok"),
        orgIdForChargeRef: async () => null,
      }
    );
    expect(r.event.id).toBe("evt_org:org_1");
    expect(r.provider.name).toBe("org:org_1");
  });

  it("locates the org through the charge reference when metadata is absent", async () => {
    // charge.refunded carries payment_intent, not our metadata.
    const r = await verifyInboundWebhook(
      { headers: {}, body: body({ id: "ch_9", payment_intent: "pi_42" }) },
      {
        platform: () => provider("platform", "bad-sig"),
        forOrg: async (id) => provider(`org:${id}`, "ok"),
        orgIdForChargeRef: async (ref) => (ref === "pi_42" ? "org_7" : null),
      }
    );
    expect(r.provider.name).toBe("org:org_7");
  });

  it("still rejects when neither the platform nor the org secret matches", async () => {
    await expect(
      verifyInboundWebhook(
        { headers: {}, body: body({ id: "pi_1", metadata: { orgId: "org_1" } }) },
        {
          platform: () => provider("platform", "bad-sig"),
          forOrg: async () => provider("org", "bad-sig"),
          orgIdForChargeRef: async () => null,
        }
      )
    ).rejects.toThrow(/signature verification failed/);
  });

  it("rejects with the original error when the body names no org at all", async () => {
    await expect(
      verifyInboundWebhook(
        { headers: {}, body: "not json" },
        {
          platform: () => provider("platform", "bad-sig"),
          forOrg: async () => provider("org", "ok"),
          orgIdForChargeRef: async () => null,
        }
      )
    ).rejects.toThrow(/signature verification failed/);
  });

  it("propagates an unsupported-type answer from the platform without trying the org", async () => {
    await expect(
      verifyInboundWebhook(
        { headers: {}, body: body({ id: "pi_1", metadata: { orgId: "org_1" } }) },
        {
          platform: () => provider("platform", "unsupported"),
          forOrg: async () => provider("org", "ok"),
          orgIdForChargeRef: async () => null,
        }
      )
    ).rejects.toBeInstanceOf(UnsupportedWebhookEvent);
  });
});

describe("candidateOrgIdFromBody", () => {
  it("prefers metadata.orgId and falls back to payment_intent then id", () => {
    expect(candidateOrgIdFromBody(body({ id: "x", metadata: { orgId: "o" } }))).toEqual({
      orgId: "o",
      chargeRef: "x",
    });
    expect(candidateOrgIdFromBody(body({ id: "ch", payment_intent: "pi" }))).toEqual({
      orgId: undefined,
      chargeRef: "pi",
    });
    expect(candidateOrgIdFromBody("{")).toEqual({});
  });
});
