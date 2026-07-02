import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-for-vitest-only-0123456789";
});

describe("charge token (donation amount integrity)", () => {
  it("round-trips the authoritative amount", async () => {
    const { signChargeToken, verifyChargeToken } = await import("./charge-token");
    const token = signChargeToken({ ref: "ch_1", orgId: "org_1", amount: 100, currency: "CAD" });
    const payload = verifyChargeToken(token);
    expect(payload?.amount).toBe(100);
    expect(payload?.orgId).toBe("org_1");
    expect(payload?.ref).toBe("ch_1");
  });

  it("rejects a tampered token (forged amount)", async () => {
    const { signChargeToken, verifyChargeToken } = await import("./charge-token");
    const token = signChargeToken({ ref: "ch_1", orgId: "org_1", amount: 1, currency: "CAD" });
    // attacker rewrites the payload to $1000 but keeps the signature
    const [, mac] = token.split(".");
    const forged =
      Buffer.from(JSON.stringify({ ref: "ch_1", orgId: "org_1", amount: 1000, currency: "CAD", exp: 9999999999 }))
        .toString("base64url") + "." + mac;
    expect(verifyChargeToken(forged)).toBeNull();
  });

  it("rejects garbage", async () => {
    const { verifyChargeToken } = await import("./charge-token");
    expect(verifyChargeToken("not-a-token")).toBeNull();
    expect(verifyChargeToken("")).toBeNull();
  });
});

describe("receipt access token (PII gate)", () => {
  it("verifies a token only for its own receipt id", async () => {
    const { signReceiptToken, verifyReceiptToken } = await import("./receipt-links");
    const token = signReceiptToken("receipt_A");
    expect(verifyReceiptToken("receipt_A", token)).toBe(true);
    expect(verifyReceiptToken("receipt_B", token)).toBe(false); // can't reuse on another receipt
    expect(verifyReceiptToken("receipt_A", token + "x")).toBe(false); // tampered
    expect(verifyReceiptToken("receipt_A", null)).toBe(false);
  });
});

describe("email html escaping (anti-injection)", () => {
  it("escapes angle brackets and quotes", async () => {
    const { escapeHtml } = await import("./email");
    expect(escapeHtml('<script>alert(1)</script>')).toBe(
      "&lt;script&gt;alert(1)&lt;/script&gt;"
    );
    expect(escapeHtml('a & "b" \'c\'')).toBe("a &amp; &quot;b&quot; &#39;c&#39;");
  });
});
