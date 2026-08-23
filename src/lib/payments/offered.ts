import { WeVendAdapter } from "./wevend-adapter";

/**
 * Which gateway an organization is offered when it connects its own account.
 *
 * Decision (2026-08-23): WeVend. The Stripe adapter, connect action and form
 * remain in the repo — tested, and working for Canadian Stripe accounts — but
 * are not shown to charities. Flip this constant to offer Stripe again; nothing
 * else needs to change.
 */
export const OFFERED_ORG_GATEWAY: "wevend" | "stripe" = "wevend";

/**
 * The WeVend environment the whole platform points at. Credentials are per
 * org but the gateway host is platform-wide (`WEVEND_BASE_URL`), so a charity
 * connecting a production merchant to a sandbox-pointed platform would "connect"
 * and then fail at the first gift — the UI must say which it is.
 */
export function wevendEnvironment(): "sandbox" | "production" | "unknown" {
  return WeVendAdapter.environmentOf(process.env.WEVEND_BASE_URL);
}

export function wevendEnabled(): boolean {
  return Boolean(process.env.WEVEND_BASE_URL && process.env.WEVEND_IFRAME_URL);
}
