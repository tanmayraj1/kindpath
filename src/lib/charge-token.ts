import crypto from "node:crypto";

/**
 * Tamper-proof charge token. After a charge is authorized we return a SIGNED
 * token that embeds the authoritative amount/org. completeDonation trusts the
 * token, never the client's posted amount — so a donor can't be charged $1 and
 * recorded for $1000. Stateless (HMAC), short-lived.
 */
export type ChargePayload = {
  ref: string; // provider charge reference
  orgId: string;
  amount: number;
  currency: string;
  /**
   * Card metadata reported by the gateway, when it reports any. Carried through
   * so a saved payment method shows the donor's ACTUAL card in their portal.
   * Previously every saved method was labelled "Visa •••• 4242" regardless of
   * what was used, which is worse than showing nothing.
   */
  brand?: string | null;
  last4?: string | null;
  exp: number; // unix seconds
};

const TTL_SECONDS = 60 * 60; // 1 hour to finish entering details

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
}

export function signChargeToken(p: Omit<ChargePayload, "exp">): string {
  const payload: ChargePayload = { ...p, exp: Math.floor(Date.now() / 1000) + TTL_SECONDS };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function verifyChargeToken(token: string): ChargePayload | null {
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  try {
    if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as ChargePayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
