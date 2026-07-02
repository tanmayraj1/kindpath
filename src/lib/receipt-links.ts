import crypto from "node:crypto";

/**
 * Signed, expiring access tokens for receipt PDFs, so public/email links don't
 * expose receipts to anyone who guesses a UUID. Tokens are HMAC(receiptId|exp).
 */
const DEFAULT_TTL_DAYS = 400; // tax receipts are downloaded long after issue

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
}

export function signReceiptToken(receiptId: string, ttlDays = DEFAULT_TTL_DAYS): string {
  const exp = Math.floor(Date.now() / 1000) + ttlDays * 86400;
  const mac = crypto
    .createHmac("sha256", secret())
    .update(`${receiptId}.${exp}`)
    .digest("base64url");
  return `${exp}.${mac}`;
}

export function verifyReceiptToken(receiptId: string, token: string | null | undefined): boolean {
  if (!token) return false;
  const [expStr, mac] = token.split(".");
  const exp = Number(expStr);
  if (!exp || !mac || exp < Math.floor(Date.now() / 1000)) return false;
  const expected = crypto
    .createHmac("sha256", secret())
    .update(`${receiptId}.${exp}`)
    .digest("base64url");
  try {
    return crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected));
  } catch {
    return false;
  }
}

/** Relative signed PDF path for public/email use. */
export function signedReceiptPath(receiptId: string): string {
  return `/api/receipts/${receiptId}/pdf?t=${signReceiptToken(receiptId)}`;
}

/** Absolute signed URL (for emails). */
export function signedReceiptUrl(receiptId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base}${signedReceiptPath(receiptId)}`;
}
