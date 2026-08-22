import { assessStripeAccount } from "./stripe-account";

export type PlatformGatewayHealth =
  | { provider: string; checked: false; reason: string }
  | { provider: "stripe"; checked: true; ok: boolean; country?: string; liveMode: boolean; reason?: string };

let cache: { at: number; value: PlatformGatewayHealth } | null = null;
const CACHE_MS = 10 * 60 * 1000;

/**
 * Can the PLATFORM gateway — the fallback every org without its own account
 * runs on — actually take a CAD donation?
 *
 * Surfaced on /api/health because the first production key was from an
 * account registered in India: /api/ready was green, the balance probe passed,
 * and every donation on the site failed at Checkout with a message only the
 * Vercel function log ever saw. Cached so an uptime monitor polling health
 * does not turn into a Stripe API poll.
 */
export async function platformGatewayHealth(
  fetchImpl: typeof fetch = fetch,
  now = Date.now()
): Promise<PlatformGatewayHealth> {
  if (cache && now - cache.at < CACHE_MS) return cache.value;

  const provider = process.env.PAYMENT_PROVIDER ?? "unset";
  let value: PlatformGatewayHealth;

  if (provider !== "stripe") {
    value = { provider, checked: false, reason: "no account-level check for this provider" };
  } else {
    const key = process.env.STRIPE_SECRET_KEY ?? "";
    const liveMode = key.startsWith("sk_live_");
    try {
      const res = await fetchImpl("https://api.stripe.com/v1/account", {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (!res.ok) {
        value = { provider: "stripe", checked: true, ok: false, liveMode, reason: `Stripe answered ${res.status} to /v1/account` };
      } else {
        const acct = (await res.json()) as { country?: string };
        const assessed = assessStripeAccount(acct);
        value = assessed.ok
          ? { provider: "stripe", checked: true, ok: true, country: assessed.country, liveMode }
          : { provider: "stripe", checked: true, ok: false, country: acct.country, liveMode, reason: assessed.reason };
      }
    } catch (e) {
      // Transient: report, but don't cache a network blip for ten minutes.
      return { provider: "stripe", checked: false, reason: e instanceof Error ? e.message : "network error" };
    }
  }

  cache = { at: now, value };
  return value;
}
