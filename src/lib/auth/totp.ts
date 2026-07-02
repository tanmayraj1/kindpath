import { createHmac, randomBytes, timingSafeEqual } from "crypto";

/**
 * RFC 6238 TOTP + RFC 4226 HOTP, implemented on Node crypto (no dependency).
 * Compatible with Google Authenticator, Authy, 1Password, etc.
 * Default parameters: SHA-1, 30-second step, 6 digits — the universal default
 * every authenticator app assumes.
 */

const STEP = 30;
const DIGITS = 6;
const ALG = "sha1";

// ---- base32 (RFC 4648, no padding) — the encoding authenticator apps expect ----
const B32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i];
    bits += 8;
    while (bits >= 5) {
      out += B32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += B32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, "").replace(/\s/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i++) {
    const idx = B32_ALPHABET.indexOf(clean[i]);
    if (idx === -1) throw new Error("Invalid base32 character");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** A fresh random secret (20 bytes = 160 bits), returned base32-encoded. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** RFC 4226 HOTP for a specific counter. `secret` is the raw key bytes. */
function hotp(secret: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  // 64-bit big-endian counter (safe for counters within Number range)
  buf.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac(ALG, secret).update(buf).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return (binary % 10 ** DIGITS).toString().padStart(DIGITS, "0");
}

/** Current (or given-time) TOTP code for a base32 secret. */
export function totp(secretBase32: string, atMs: number = Date.now()): string {
  const counter = Math.floor(atMs / 1000 / STEP);
  return hotp(base32Decode(secretBase32), counter);
}

/**
 * Verify a submitted token against a base32 secret, allowing ±`window` steps of
 * clock drift (default ±1 = ~90s tolerance). Constant-time per candidate.
 */
export function verifyTotp(
  secretBase32: string,
  token: string,
  opts: { window?: number; atMs?: number } = {}
): boolean {
  const window = opts.window ?? 1;
  const atMs = opts.atMs ?? Date.now();
  const cleaned = token.replace(/\s/g, "");
  if (!/^\d{6}$/.test(cleaned)) return false;
  const secret = base32Decode(secretBase32);
  const counter = Math.floor(atMs / 1000 / STEP);
  for (let i = -window; i <= window; i++) {
    if (counter + i < 0) continue;
    const candidate = hotp(secret, counter + i);
    const a = Buffer.from(candidate);
    const b = Buffer.from(cleaned);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}

/** otpauth:// URI to encode into the enrollment QR code. */
export function otpauthUrl(opts: { secret: string; account: string; issuer: string }): string {
  // Label is "issuer:account" with the colon kept literal (each part encoded).
  const label = `${encodeURIComponent(opts.issuer)}:${encodeURIComponent(opts.account)}`;
  const params = new URLSearchParams({
    secret: opts.secret,
    issuer: opts.issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** Human-friendly single-use recovery codes (e.g. "a1b2c-3d4e5"). */
export function generateRecoveryCodes(count = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const raw = randomBytes(5).toString("hex"); // 10 hex chars
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
  }
  return codes;
}
