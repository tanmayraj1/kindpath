import { describe, it, expect, vi } from "vitest";
import { platformFallbackAllowed } from "./index";
import { WeVendAdapter } from "./wevend-adapter";

/**
 * Under WeVend every charity is its own merchant. KindPath has no merchant
 * account to lend, so an org that hasn't connected one must not be charged on
 * whatever the platform env happens to name — on production that is at best the
 * sandbox test merchant (a real-looking gift and CRA receipt with no money
 * behind it).
 */
describe("platformFallbackAllowed", () => {
  it("REFUSES WeVend fallback on the production site, even with a platform MID set", () => {
    expect(platformFallbackAllowed("wevend", "production", "RCTST0000048568")).toBe(false);
    expect(platformFallbackAllowed("wevend", "production", undefined)).toBe(false);
  });

  it("allows WeVend fallback off production only when a test merchant is configured", () => {
    expect(platformFallbackAllowed("wevend", "preview", "RCTST0000048568")).toBe(true);
    expect(platformFallbackAllowed("wevend", undefined, "RCTST0000048568")).toBe(true);
    expect(platformFallbackAllowed("wevend", undefined, undefined)).toBe(false);
  });

  it("leaves Stripe and the simulated gateway as they were", () => {
    expect(platformFallbackAllowed("stripe", "production", undefined)).toBe(true);
    expect(platformFallbackAllowed("mock-hosted", "production", undefined)).toBe(true);
  });
});

describe("WeVendAdapter without a merchant", () => {
  const base = {
    baseUrl: "https://wepay.wevend.dev/api",
    iframeUrl: "https://iframe.wevend.dev",
    wvNumber: "WV-ISV-1",
    password: "pw",
    mid: "",
    termId: "",
  };

  it("constructs in organization mode with no MID — the platform health probe needs only the login", () => {
    expect(() => new WeVendAdapter({ ...base, fetchImpl: vi.fn() as unknown as typeof fetch })).not.toThrow();
  });

  it("still requires a MID in merchant mode, which logs in with it", () => {
    expect(
      () =>
        new WeVendAdapter({ ...base, wvNumber: "", email: "m@org.ca", fetchImpl: vi.fn() as unknown as typeof fetch })
    ).toThrow(/requires WEVEND/);
  });

  it("probes the organization login alone, without inventing a merchant lookup", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ success: true, data: { accessToken: "t", refreshToken: "r" } }))
    );
    const a = new WeVendAdapter({ ...base, fetchImpl: fetchImpl as unknown as typeof fetch });
    await expect(a.probe()).resolves.toEqual({ environment: "sandbox", midChecked: false });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("refuses to open a sale with no merchant rather than sending an empty MID", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ success: true, data: { accessToken: "t", refreshToken: "r" } }))
    );
    const a = new WeVendAdapter({ ...base, fetchImpl: fetchImpl as unknown as typeof fetch });
    await expect(
      a.beginHostedSale({ orgId: "o", money: { amount: 5, currency: "CAD" }, redirectUrl: "https://x/response" })
    ).rejects.toThrow(/no merchant/);
  });
});
