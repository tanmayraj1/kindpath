import crypto from "node:crypto";

/**
 * Signed state for the hosted-gateway redirect hop (WeVend iframe et al).
 * Set as a short-lived httpOnly cookie before we send the donor to the
 * gateway; read back on the /response return page. HMAC-signed so the
 * amount/org/fund can't be tampered with while the donor is off-site.
 */
/**
 * What the donor was buying before they left for the gateway.
 *
 * Carried through the redirect so /response knows which completion form to show.
 * Ticket and membership purchases previously had no hosted path at all — they
 * called authorizeCharge with a mock placeholder token, so with a real gateway
 * configured they ran a demo code path.
 */
export type HostedKind = "donation" | "ticket" | "membership";

export type HostedState = {
  kind?: HostedKind; // absent on pre-existing cookies → treated as "donation"
  orgId: string;
  slug: string;
  amount: number; // effective amount (incl. cover-the-fees), major units
  currency: string;
  fundId?: string;
  campaignId?: string;
  frequency: "one_time" | "monthly";
  // ticket purchases
  eventId?: string;
  ticketTypeId?: string;
  quantity?: number;
  // membership joins
  planId?: string;
  paymentOrderId: string; // must match the gateway's return params
  exp: number; // unix seconds
};

export const HOSTED_STATE_COOKIE = "kindpath_hs";
const TTL_SECONDS = 30 * 60; // 30 min to finish paying on the gateway

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
}

export function signHostedState(p: Omit<HostedState, "exp">): string {
  const payload: HostedState = { ...p, exp: Math.floor(Date.now() / 1000) + TTL_SECONDS };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = crypto.createHmac("sha256", secret()).update(`hs.${body}`).digest("base64url");
  return `${body}.${mac}`;
}

export function verifyHostedState(token: string | undefined | null): HostedState | null {
  if (!token) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = crypto.createHmac("sha256", secret()).update(`hs.${body}`).digest("base64url");
  try {
    if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as HostedState;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
