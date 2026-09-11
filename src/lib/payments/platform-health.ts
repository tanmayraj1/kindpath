import { assessStripeAccount } from "./stripe-account";
import { WeVendAdapter } from "./wevend-adapter";

export type PlatformGatewayHealth =
  | { provider: string; checked: false; reason: string }
  | { provider: "stripe"; checked: true; ok: boolean; country?: string; liveMode: boolean; reason?: string }
  | { provider: "wevend"; checked: true; ok: boolean; environment: "sandbox" | "production" | "unknown"; reason?: string }
  | { provider: string; checked: true; ok: boolean; simulated: true; reason: string };

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

  if (provider === "mock" || provider === "mock-hosted") {
    // Reported as NOT ok on the real site, deliberately. Nothing is broken — but
    // a production deployment that cannot take real money is a state someone has
    // to notice and undo, so an uptime monitor should keep saying so until they
    // do. On a preview this is the expected state, so it reads as ok.
    const onProduction = process.env.VERCEL_ENV === "production";
    value = {
      provider,
      checked: true,
      ok: !onProduction,
      simulated: true,
      reason: onProduction
        ? "the production site is running a SIMULATED gateway (ALLOW_SIMULATED_GATEWAY=yes) — no donation here is real; unset it to resume taking payments"
        : "simulated gateway on a non-production deployment",
    };
  } else if (provider === "wevend") {
    // Authenticate as the platform merchant/org. A wrong password or MID is
    // "down" for every org on the fallback, and nothing else reports it.
    try {
      const { environment } = await new WeVendAdapter().probe();
      value = { provider: "wevend", checked: true, ok: true, environment };
    } catch (e) {
      const reason = e instanceof Error ? e.message : "WeVend authentication failed";
      // Config errors (missing env) are stable — cache them; network blips aren't.
      if (/requires WEVEND_|authentication failed|Invalid|not found/i.test(reason)) {
        value = { provider: "wevend", checked: true, ok: false, environment: WeVendAdapter.environmentOf(process.env.WEVEND_BASE_URL), reason };
      } else {
        return { provider: "wevend", checked: false, reason };
      }
    }
  } else if (provider !== "stripe") {
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
