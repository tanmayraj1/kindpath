import { describe, it, expect, vi, beforeAll } from "vitest";
import { signDetailsToken, checkDetailsToken, detailsPath } from "./receipt-details-link";

/**
 * This token is the only thing standing between a stranger and putting a name and
 * address on someone else's official tax receipt, so the properties worth pinning
 * are: it cannot be forged, it cannot be moved to another donation, and it stops
 * working eventually.
 */

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-at-least-32-characters-long!!";
});

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("checkDetailsToken", () => {
  it("accepts a token it just issued", () => {
    expect(checkDetailsToken(A, signDetailsToken(A))).toBe("ok");
  });

  it("refuses a token minted for a different donation", () => {
    // Without binding, one donor's emailed link would let them complete anyone
    // else's receipt — the id is right there in the URL.
    expect(checkDetailsToken(B, signDetailsToken(A))).toBe("invalid");
  });

  it("refuses a tampered signature", () => {
    const token = signDetailsToken(A);
    const [exp, sig] = token.split(".");
    const flipped = sig[0] === "a" ? `b${sig.slice(1)}` : `a${sig.slice(1)}`;
    expect(checkDetailsToken(A, `${exp}.${flipped}`)).toBe("invalid");
  });

  it("refuses a token whose expiry was extended by hand", () => {
    // The expiry is inside the MAC, so pushing it out invalidates the signature
    // rather than buying more time.
    const [, sig] = signDetailsToken(A).split(".");
    const far = Math.floor(Date.now() / 1000) + 10 * 365 * 86400;
    expect(checkDetailsToken(A, `${far}.${sig}`)).toBe("invalid");
  });

  it("refuses missing and malformed tokens", () => {
    expect(checkDetailsToken(A, undefined)).toBe("invalid");
    expect(checkDetailsToken(A, "")).toBe("invalid");
    expect(checkDetailsToken(A, "nonsense")).toBe("invalid");
    expect(checkDetailsToken(A, "123")).toBe("invalid");
  });

  it("reports a genuine expiry as expired, not invalid", () => {
    // The distinction is the difference between "your gift is fine, ask the
    // charity" and a bare 404 on a link we sent them.
    vi.useFakeTimers();
    try {
      const token = signDetailsToken(A, 90);
      vi.advanceTimersByTime(91 * 86400 * 1000);
      expect(checkDetailsToken(A, token)).toBe("expired");
    } finally {
      vi.useRealTimers();
    }
  });

  it("still holds one day before the deadline", () => {
    vi.useFakeTimers();
    try {
      const token = signDetailsToken(A, 90);
      vi.advanceTimersByTime(89 * 86400 * 1000);
      expect(checkDetailsToken(A, token)).toBe("ok");
    } finally {
      vi.useRealTimers();
    }
  });

  it("never reports expired for a signature that was never valid", () => {
    // Order matters: an attacker probing with a forged token must not learn that
    // their guess would otherwise have been accepted.
    const stale = Math.floor(Date.now() / 1000) - 86400;
    expect(checkDetailsToken(A, `${stale}.notarealmac`)).toBe("invalid");
  });
});

describe("detailsPath", () => {
  it("carries the donation id and a token that verifies against it", () => {
    const path = detailsPath(A);
    expect(path.startsWith(`/receipt-details/${A}?t=`)).toBe(true);
    const token = new URL(path, "https://example.org").searchParams.get("t");
    expect(checkDetailsToken(A, token)).toBe("ok");
  });
});
