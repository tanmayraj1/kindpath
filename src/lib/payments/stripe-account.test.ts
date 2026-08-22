import { describe, it, expect } from "vitest";
import { assessStripeAccount } from "./stripe-account";

describe("assessStripeAccount", () => {
  it("accepts a Canadian account", () => {
    expect(assessStripeAccount({ country: "CA", charges_enabled: true })).toEqual({ ok: true, country: "CA" });
    expect(assessStripeAccount({ country: "ca" })).toEqual({ ok: true, country: "CA" });
  });

  it("refuses an account registered elsewhere and names the country", () => {
    // The real first production key: an Indian account whose balance probe passed
    // and whose every CAD Checkout then failed.
    const r = assessStripeAccount({ country: "IN", charges_enabled: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/registered in IN/);
  });

  it("refuses when the country is missing rather than guessing", () => {
    expect(assessStripeAccount({}).ok).toBe(false);
  });
});
