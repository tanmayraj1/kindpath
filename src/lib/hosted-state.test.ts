import { describe, it, expect, beforeAll } from "vitest";
import { signHostedState, verifyHostedState } from "./hosted-state";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-for-hosted-state-0123456789";
});

const BASE = {
  orgId: "org-1",
  slug: "st-marys",
  amount: 51.75,
  currency: "CAD",
  fundId: "fund-1",
  frequency: "one_time" as const,
  paymentOrderId: "po_123",
};

describe("hosted-state token", () => {
  it("round-trips the full payload", () => {
    const t = signHostedState(BASE);
    const back = verifyHostedState(t);
    expect(back).toMatchObject(BASE);
    expect(back!.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("rejects tampered payloads (amount edited)", () => {
    const t = signHostedState(BASE);
    const [body] = t.split(".");
    const decoded = JSON.parse(Buffer.from(body, "base64url").toString());
    decoded.amount = 1; // attacker lowers the recorded amount
    const forgedBody = Buffer.from(JSON.stringify(decoded)).toString("base64url");
    expect(verifyHostedState(`${forgedBody}.${t.split(".")[1]}`)).toBeNull();
  });

  it("rejects missing/malformed tokens", () => {
    expect(verifyHostedState(null)).toBeNull();
    expect(verifyHostedState("")).toBeNull();
    expect(verifyHostedState("abc")).toBeNull();
    expect(verifyHostedState("a.b")).toBeNull();
  });

  it("is domain-separated from charge tokens", async () => {
    const { signChargeToken } = await import("./charge-token");
    const ct = signChargeToken({ ref: "r", orgId: "org-1", amount: 5, currency: "CAD" });
    expect(verifyHostedState(ct)).toBeNull();
  });
});
