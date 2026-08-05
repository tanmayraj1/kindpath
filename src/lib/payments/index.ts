import type { PaymentProvider } from "./provider";
import { MockAdapter } from "./mock-adapter";
import { StripeAdapter } from "./stripe-adapter";
import { WeVendAdapter } from "./wevend-adapter";

let provider: PaymentProvider | null = null;

/**
 * Returns the configured payment provider (singleton). Switch on PAYMENT_PROVIDER.
 * WeVend uses the single-merchant env credentials here; per-org merchant creds
 * will be threaded through once credential storage is wired.
 */
export function getPaymentProvider(): PaymentProvider {
  if (provider) return provider;

  switch (process.env.PAYMENT_PROVIDER) {
    case "stripe":
      provider = new StripeAdapter();
      break;
    case "wevend":
      provider = new WeVendAdapter();
      break;
    case "mock-hosted":
      // Simulates a WeVend-style redirect gateway locally (see MockAdapter).
      provider = new MockAdapter({ hosted: true });
      break;
    case "mock":
    default:
      provider = new MockAdapter();
  }
  return provider;
}

// Per-org adapters (WeVend: one merchant account per org). Keyed by orgId so a
// warm serverless instance reuses the authenticated adapter + its JWT.
const orgProviders = new Map<string, PaymentProvider>();

/**
 * Resolve the provider for a specific org. For WeVend, prefers the org's own
 * encrypted merchant credentials (Organization.posCredentialsRef) and falls
 * back to the env-level merchant when none are stored. Other providers are
 * org-agnostic and return the singleton.
 */
export async function getPaymentProviderForOrg(orgId: string): Promise<PaymentProvider> {
  if (process.env.PAYMENT_PROVIDER !== "wevend") return getPaymentProvider();

  const cached = orgProviders.get(orgId);
  if (cached) return cached;

  const { loadOrgGatewayCredentials } = await import("./org-credentials");
  const load = await loadOrgGatewayCredentials(orgId);

  // Credentials exist but can't be read: refuse. Falling back to the env-level
  // merchant here would silently deposit this org's donations into a DIFFERENT
  // merchant account. A visible failure is the only safe outcome.
  if (load.status === "unreadable") {
    throw new Error(`Payment gateway unavailable for this organization: ${load.reason}`);
  }

  const provider =
    load.status === "ok"
      ? new WeVendAdapter({
          mid: load.creds.mid,
          email: load.creds.email,
          wvNumber: load.creds.wvNumber,
          password: load.creds.password,
          termId: load.creds.termId,
        })
      : getPaymentProvider(); // never configured → env-level merchant is intended
  orgProviders.set(orgId, provider);
  return provider;
}

/** Drop a cached per-org adapter (call after credentials change). */
export function invalidateOrgProvider(orgId: string): void {
  orgProviders.delete(orgId);
}

export { supportsHostedSale } from "./provider";
export type { PaymentProvider } from "./provider";
export * from "./types";
