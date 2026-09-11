import crypto from "node:crypto";
import { appUrl as deploymentUrl } from "@/lib/app-url";

/**
 * Signed, expiring access tokens for volunteer pass verification pages, so the
 * QR on a pass can be scanned by door staff without any login while still not
 * exposing passes to anyone who guesses a UUID. Token = HMAC(passId|exp).
 */
const DEFAULT_TTL_DAYS = 366; // passes are typically valid for a season/year

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
}

export function signPassToken(passId: string, ttlDays = DEFAULT_TTL_DAYS): string {
  const exp = Math.floor(Date.now() / 1000) + ttlDays * 86400;
  const mac = crypto
    .createHmac("sha256", secret())
    .update(`pass:${passId}.${exp}`)
    .digest("base64url");
  return `${exp}.${mac}`;
}

export function verifyPassToken(passId: string, token: string | null | undefined): boolean {
  if (!token) return false;
  const [expStr, mac] = token.split(".");
  const exp = Number(expStr);
  if (!exp || !mac || exp < Math.floor(Date.now() / 1000)) return false;
  const expected = crypto
    .createHmac("sha256", secret())
    .update(`pass:${passId}.${exp}`)
    .digest("base64url");
  try {
    return crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected));
  } catch {
    return false;
  }
}

/** Relative signed verification path (encoded into the pass QR). */
export function signedPassPath(passId: string): string {
  return `/vp/${passId}?t=${signPassToken(passId)}`;
}

/** Absolute signed URL (QR content / emails). */
export function signedPassUrl(passId: string): string {
  const base = deploymentUrl();
  return `${base}${signedPassPath(passId)}`;
}
