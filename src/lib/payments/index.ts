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

  // Never configured → the platform default, where that means anything.
  if (load.status === "none") {
    if (!platformFallbackAllowed()) {
      // Not cached: the moment the org connects, the next request must see it.
      throw new GatewayNotConnectedError(orgId);
    }
    const fallback = getPaymentProvider();
    orgProviders.set(orgId, fallback);
    return fallback;
  }

  const { creds } = load;
  const built: PaymentProvider =
    creds.provider === "stripe"
      ? new StripeAdapter({ secretKey: creds.secretKey, webhookSecret: creds.webhookSecret })
      : // Mode is chosen explicitly rather than by `??` fallback. An org that
        // supplied its own merchant login must use it even when the platform
        // also has organization credentials in the environment — letting
        // `wvNumber` fall through to env would silently switch such an org onto
        // the platform's organization token.
        creds.wvNumber && creds.password
        ? // An organization login stored for this org (platform admin panel).
          new WeVendAdapter({ mid: creds.mid, termId: creds.termId, wvNumber: creds.wvNumber, password: creds.password })
        : creds.email && creds.password
        ? new WeVendAdapter({
            mid: creds.mid,
            termId: creds.termId,
            email: creds.email,
            password: creds.password,
            wvNumber: "", // force merchant mode
          })
        : // Organization Global Token: credentials come from the platform env,
          // this merchant is addressed by mid/termId.
          new WeVendAdapter({ mid: creds.mid, termId: creds.termId });

  orgProviders.set(orgId, built);
  return built;
}

/**
 * The org has no gateway of its own and may not borrow the platform's.
 *
 * A distinct class so public pages can show "not accepting online gifts yet"
 * instead of an error, and money paths can refuse with a sentence a donor
 * understands.
 */
export class GatewayNotConnectedError extends Error {
  constructor(readonly orgId: string) {
    super("This organization has not connected a payment gateway yet");
    this.name = "GatewayNotConnectedError";
  }
}

/**
 * May an org with no gateway of its own charge on the platform default?
 *
 * Under WeVend, never on the production site. Each charity is its own WeVend
 * merchant and KindPath has no merchant account to lend: a fallback would either
 * charge the sandbox test merchant in `WEVEND_MID` — a real-looking gift and CRA
 * receipt with no money behind it — or, with no MID set, fail at the donor's
 * card step. Refusing up front is the only honest outcome. Elsewhere (local,
 * preview) the env merchant is a convenience for testing the donation flow.
 *
 * Stripe and the simulated gateway keep their existing fallback.
 */
export function platformFallbackAllowed(
  provider: string | undefined = process.env.PAYMENT_PROVIDER,
  vercelEnv: string | undefined = process.env.VERCEL_ENV,
  platformMid: string | undefined = process.env.WEVEND_MID
): boolean {
  if (provider !== "wevend") return true;
  if (vercelEnv === "production") return false;
  return Boolean(platformMid);
}

/** Drop a cached per-org adapter (call after credentials change). */
export function invalidateOrgProvider(orgId: string): void {
  orgProviders.delete(orgId);
}

export { supportsHostedSale } from "./provider";
export type { PaymentProvider } from "./provider";
export * from "./types";
