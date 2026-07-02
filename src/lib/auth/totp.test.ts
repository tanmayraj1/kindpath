import { describe, it, expect } from "vitest";
import {
  base32Encode,
  base32Decode,
  totp,
  verifyTotp,
  otpauthUrl,
  generateTotpSecret,
  generateRecoveryCodes,
} from "./totp";

// RFC 4226 Appendix D test key: ASCII "12345678901234567890"
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));

describe("base32", () => {
  it("round-trips arbitrary bytes", () => {
    const b = Buffer.from("hello world 123");
    expect(base32Decode(base32Encode(b)).equals(b)).toBe(true);
  });
  it("matches the known RFC key encoding", () => {
    expect(RFC_SECRET).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
  });
});

describe("totp — RFC 4226/6238 vectors", () => {
  // counter = floor(timeMs/1000/30); these are the documented HOTP outputs.
  const vectors: [number, string][] = [
    [0, "755224"],
    [30_000, "287082"],
    [59_000, "287082"], // still counter 1
    [60_000, "359152"],
    [90_000, "969429"],
    [120_000, "338314"],
  ];
  for (const [ms, code] of vectors) {
    it(`t=${ms}ms → ${code}`, () => {
      expect(totp(RFC_SECRET, ms)).toBe(code);
    });
  }
});

describe("verifyTotp", () => {
  it("accepts the current code", () => {
    const now = Date.now();
    expect(verifyTotp(RFC_SECRET, totp(RFC_SECRET, now), { atMs: now })).toBe(true);
  });
  it("accepts a code from one step ago (drift window)", () => {
    const now = 100_000;
    const prev = totp(RFC_SECRET, now - 30_000);
    expect(verifyTotp(RFC_SECRET, prev, { atMs: now, window: 1 })).toBe(true);
  });
  it("rejects a code outside the window", () => {
    const now = 300_000;
    const stale = totp(RFC_SECRET, now - 5 * 30_000);
    expect(verifyTotp(RFC_SECRET, stale, { atMs: now, window: 1 })).toBe(false);
  });
  it("rejects malformed input", () => {
    expect(verifyTotp(RFC_SECRET, "abc", {})).toBe(false);
    expect(verifyTotp(RFC_SECRET, "12345", {})).toBe(false);
    expect(verifyTotp(RFC_SECRET, "", {})).toBe(false);
  });
  it("tolerates spaces in the submitted code", () => {
    const now = 0;
    expect(verifyTotp(RFC_SECRET, "755 224", { atMs: now })).toBe(true);
  });
});

describe("otpauthUrl", () => {
  it("encodes the secret, issuer and account", () => {
    const url = otpauthUrl({ secret: "ABC234", account: "jane@stmarys.org", issuer: "KindPath" });
    expect(url).toContain("otpauth://totp/KindPath:jane%40stmarys.org");
    expect(url).toContain("secret=ABC234");
    expect(url).toContain("issuer=KindPath");
    expect(url).toContain("period=30");
  });
});

describe("generators", () => {
  it("secrets are valid base32 and unique", () => {
    const a = generateTotpSecret();
    const b = generateTotpSecret();
    expect(a).not.toBe(b);
    expect(() => base32Decode(a)).not.toThrow();
    expect(totp(a)).toMatch(/^\d{6}$/);
  });
  it("recovery codes are formatted and unique", () => {
    const codes = generateRecoveryCodes(10);
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const c of codes) expect(c).toMatch(/^[0-9a-f]{5}-[0-9a-f]{5}$/);
  });
});
