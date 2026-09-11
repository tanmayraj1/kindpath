import { describe, it, expect } from "vitest";
import { simulatedGatewayAllowed, isSimulatedProvider } from "./env";

/**
 * The simulated gateway may run on a preview deployment so the donation flow can
 * be demonstrated without a payment provider — but never on the production site,
 * because its webhook verifier accepts unsigned JSON.
 *
 * `NODE_ENV` alone cannot make that distinction: it is "production" for every
 * Next.js production build, preview deployments included.
 *
 * The rule is exercised through explicit arguments rather than by mutating
 * process.env, because bundlers substitute `process.env.NODE_ENV` at transform
 * time — a test that assigns it proves nothing about what production evaluates.
 */
describe("simulatedGatewayAllowed", () => {
  it("REFUSES on the production deployment", () => {
    expect(simulatedGatewayAllowed("production", "production")).toBe(false);
  });

  it("allows on a preview deployment, where NODE_ENV is also 'production'", () => {
    // The whole reason this takes VERCEL_ENV: a preview build is NODE_ENV
    // production too, so keying on NODE_ENV would refuse a harmless demo.
    expect(simulatedGatewayAllowed("preview", "production")).toBe(true);
  });

  it("allows on Vercel's development environment", () => {
    expect(simulatedGatewayAllowed("development", "production")).toBe(true);
  });

  it("allows in local development", () => {
    expect(simulatedGatewayAllowed(undefined, "development")).toBe(true);
  });

  it("REFUSES a self-hosted production build, which reports no VERCEL_ENV at all", () => {
    // Absent VERCEL_ENV must not read as "not production" — that would let a
    // self-hosted real deployment simulate payments.
    expect(simulatedGatewayAllowed(undefined, "production")).toBe(false);
  });

  it("allows production ONLY with the explicit opt-in", () => {
    expect(simulatedGatewayAllowed("production", "production", "yes")).toBe(true);
  });

  it("ignores a half-hearted opt-in value", () => {
    // Anything but the exact token leaves production refusing, so a stray
    // "true"/"1"/"" cannot switch the real site into simulation.
    for (const v of ["true", "1", "YES", "", " yes", undefined]) {
      expect(simulatedGatewayAllowed("production", "production", v)).toBe(false);
    }
  });
});

describe("isSimulatedProvider", () => {
  it("recognises both simulated providers and nothing else", () => {
    expect(isSimulatedProvider("mock")).toBe(true);
    expect(isSimulatedProvider("mock-hosted")).toBe(true);
    expect(isSimulatedProvider("stripe")).toBe(false);
    expect(isSimulatedProvider("wevend")).toBe(false);
    expect(isSimulatedProvider(undefined)).toBe(false);
  });
});
