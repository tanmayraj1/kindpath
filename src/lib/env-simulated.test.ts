import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { simulatedGatewayAllowed, isSimulatedProvider } from "./env";

/**
 * The simulated gateway may run on a preview deployment so the donation flow can
 * be demonstrated without a payment provider — but never on the production site,
 * because its webhook verifier accepts unsigned JSON.
 *
 * `NODE_ENV` cannot make that distinction: it is "production" for every Next.js
 * production build, preview deployments included. These tests pin the property
 * that actually matters — that the real site refuses to simulate.
 */
const saved = { ...process.env };

beforeEach(() => {
  delete process.env.VERCEL_ENV;
  delete process.env.NODE_ENV;
});
afterEach(() => {
  process.env = { ...saved };
});

describe("simulatedGatewayAllowed", () => {
  it("REFUSES on the production deployment", () => {
    process.env.VERCEL_ENV = "production";
    process.env.NODE_ENV = "production";
    expect(simulatedGatewayAllowed()).toBe(false);
  });

  it("allows on a preview deployment, where NODE_ENV is also 'production'", () => {
    // The whole reason this function exists: a preview build is NODE_ENV
    // production too, so keying on NODE_ENV would refuse a harmless demo.
    process.env.VERCEL_ENV = "preview";
    process.env.NODE_ENV = "production";
    expect(simulatedGatewayAllowed()).toBe(true);
  });

  it("allows on Vercel's development environment", () => {
    process.env.VERCEL_ENV = "development";
    expect(simulatedGatewayAllowed()).toBe(true);
  });

  it("allows in local development", () => {
    process.env.NODE_ENV = "development";
    expect(simulatedGatewayAllowed()).toBe(true);
  });

  it("REFUSES a self-hosted production build, which reports no VERCEL_ENV at all", () => {
    // Absent VERCEL_ENV must not read as "not production" — that would let a
    // self-hosted real deployment simulate payments.
    process.env.NODE_ENV = "production";
    expect(simulatedGatewayAllowed()).toBe(false);
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
