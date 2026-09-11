import crypto from "node:crypto";
import { appUrl as deploymentUrl } from "@/lib/app-url";

/**
 * Signed link a donor follows to finish a tax receipt after they have already paid.
 *
 * Why this exists: an official CRA receipt needs the donor's full name and mailing
 * address (docs/02_COMPLIANCE.md §1.1), but nobody standing at a POS terminal or
 * scanning a QR in a pew wants to type an address on a phone. So the giving page
 * asks for an email and nothing else, and the details are collected later, from
 * the donor's inbox, when they have a keyboard and a minute.
 *
 * The token IS the authorization — it arrives only at the address the donor typed,
 * and it lets the holder put a name and address on a tax document. It therefore
 * carries an expiry and is bound to one donation, so it cannot be replayed against
 * another gift.
 *
 * 90 days: long enough for the "I'll do it later" that this whole flow exists to
 * permit, short enough that a live link is not sitting in an inbox indefinitely.
 * A donor who misses the window has not lost their receipt — the organization can
 * still complete the details for them from the dashboard.
 */
const DEFAULT_TTL_DAYS = 90;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
}

function mac(donationId: string, exp: number) {
  return crypto
    .createHmac("sha256", secret())
    .update(`receipt-details:${donationId}.${exp}`)
    .digest("base64url");
}

export function signDetailsToken(donationId: string, ttlDays = DEFAULT_TTL_DAYS): string {
  const exp = Math.floor(Date.now() / 1000) + ttlDays * 86400;
  return `${exp}.${mac(donationId, exp)}`;
}

export type DetailsTokenResult = "ok" | "expired" | "invalid";

/**
 * Distinguishes expired from invalid on purpose: "this link has expired, ask the
 * organization to finish it for you" is actionable, and "not found" for a link the
 * donor was legitimately sent reads as though their gift went missing.
 */
export function checkDetailsToken(
  donationId: string,
  token: string | null | undefined
): DetailsTokenResult {
  if (!token) return "invalid";
  const [expStr, sig] = token.split(".");
  const exp = Number(expStr);
  if (!exp || !sig) return "invalid";

  const expected = mac(donationId, exp);
  let matches = false;
  try {
    matches = crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return "invalid";
  }
  // Signature first, then expiry — an unsigned guess must never be told that it
  // merely arrived too late.
  if (!matches) return "invalid";
  return exp < Math.floor(Date.now() / 1000) ? "expired" : "ok";
}

export function detailsPath(donationId: string): string {
  return `/receipt-details/${donationId}?t=${signDetailsToken(donationId)}`;
}

export function detailsUrl(donationId: string): string {
  const base = deploymentUrl();
  return `${base}${detailsPath(donationId)}`;
}
