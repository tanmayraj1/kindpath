import { describe, it, expect } from "vitest";
import { getEffectiveFeatures, featureSource, planBaseline } from "./features";

describe("entitlements", () => {
  it("starter baseline includes core, excludes premium", () => {
    const f = getEffectiveFeatures("starter", null);
    expect(f.receipts).toBe(true);
    expect(f.recurring).toBe(true);
    expect(f.campaigns).toBe(false);
    expect(f.communications).toBe(false);
  });

  it("community baseline includes campaigns + comms", () => {
    const f = getEffectiveFeatures("community", null);
    expect(f.campaigns).toBe(true);
    expect(f.communications).toBe(true);
  });

  it("enterprise gets everything", () => {
    const f = getEffectiveFeatures("enterprise", null);
    expect(Object.values(f).every(Boolean)).toBe(true);
  });

  it("override can grant a feature not in plan", () => {
    const f = getEffectiveFeatures("starter", { campaigns: true });
    expect(f.campaigns).toBe(true);
    expect(featureSource("starter", { campaigns: true }, "campaigns")).toBe("granted");
  });

  it("override can revoke a plan feature", () => {
    const f = getEffectiveFeatures("community", { campaigns: false });
    expect(f.campaigns).toBe(false);
    expect(featureSource("community", { campaigns: false }, "campaigns")).toBe("revoked");
  });

  it("unknown plan falls back to starter baseline", () => {
    expect(planBaseline("nope").has("receipts")).toBe(true);
    expect(planBaseline("nope").has("campaigns")).toBe(false);
  });
});
