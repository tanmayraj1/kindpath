import { describe, it, expect, beforeAll } from "vitest";
import { signPassToken, verifyPassToken, signedPassPath } from "./pass-links";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-for-pass-links-0123456789";
});

describe("volunteer pass tokens", () => {
  it("round-trips a valid token", () => {
    const t = signPassToken("pass-1");
    expect(verifyPassToken("pass-1", t)).toBe(true);
  });

  it("rejects a token for a different pass", () => {
    const t = signPassToken("pass-1");
    expect(verifyPassToken("pass-2", t)).toBe(false);
  });

  it("rejects tampered and missing tokens", () => {
    const t = signPassToken("pass-1");
    expect(verifyPassToken("pass-1", t.slice(0, -2) + "xx")).toBe(false);
    expect(verifyPassToken("pass-1", null)).toBe(false);
    expect(verifyPassToken("pass-1", "")).toBe(false);
  });

  it("rejects expired tokens", () => {
    const t = signPassToken("pass-1", -1); // TTL in the past
    expect(verifyPassToken("pass-1", t)).toBe(false);
  });

  it("is not interchangeable with receipt tokens (domain-separated HMAC)", async () => {
    const { signReceiptToken } = await import("./receipt-links");
    const rt = signReceiptToken("pass-1");
    expect(verifyPassToken("pass-1", rt)).toBe(false);
  });

  it("builds a QR-able verification path", () => {
    expect(signedPassPath("abc")).toMatch(/^\/vp\/abc\?t=\d+\.[A-Za-z0-9_-]+$/);
  });
});
