import type { PaymentProvider } from "./provider";
import { MockAdapter } from "./mock-adapter";
import { StripeAdapter } from "./stripe-adapter";
import { WeVendAdapter } from "./wevend-adapter";

let provider: PaymentProvider | null = null;

/**
 * The platform-wide default provider, from PAYMENT_PROVIDER.
 *
 * Used for webhook verification (which arrives before any org is known) and as
 * the fallback for an org that hasn't connected its own gateway. Note that
 * `mock`/unset is rejected outright in production by src/lib/env.ts — it used to
 * fall through here silently and make the webhook endpoint unauthenticated.
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

// Per-org adapters. Each charity connects its OWN gateway account so donations
// settle directly to them. Keyed by orgId so a warm serverless instance reuses
// the authenticated adapter (and, for WeVend, its JWT).
const orgProviders = new Map<string, PaymentProvider>();

/**
 * Resolve the provider for a specific org, preferring the org's own encrypted
 * credentials (Organization.posCredentialsRef) over the platform default.
 *
 * Every money path and every payment-related page MUST go through this rather
 * than `getPaymentProvider()`, or the UI can offer one flow while the charge
 * takes another.
 */
export async function getPaymentProviderForOrg(orgId: string): Promise<PaymentProvider> {
  const cached = orgProviders.get(orgId);
  if (cached) return cached;

  const { loadOrgGatewayCredentials } = await import("./org-credentials");
  const load = await loadOrgGatewayCredentials(orgId);

  // Credentials exist but can't be read: refuse. Falling back to the platform
  // default here would silently deposit this org's donations into a DIFFERENT
  // merchant account. A visible failure is the only safe outcome.
  if (load.status === "unreadable") {
    throw new Error(`Payment gateway unavailable for this organization: ${load.reason}`);
  }

  // Never configured → the platform default is what's intended.
  if (load.status === "none") {
    const fallback = getPaymentProvider();
    orgProviders.set(orgId, fallback);
    return fallback;
  }

  const { creds } = load;
  const built: PaymentProvider =
    creds.provider === "stripe"
      ? new StripeAdapter({ secretKey: creds.secretKey, webhookSecret: creds.webhookSecret })
      : new WeVendAdapter({
          mid: creds.mid,
          email: creds.email,
          wvNumber: creds.wvNumber,
          password: creds.password,
          termId: creds.termId,
        });

  orgProviders.set(orgId, built);
  return built;
}

/** Drop a cached per-org adapter (call after credentials change). */
export function invalidateOrgProvider(orgId: string): void {
  orgProviders.delete(orgId);
}

export { supportsHostedSale } from "./provider";
export type { PaymentProvider } from "./provider";
export * from "./types";
