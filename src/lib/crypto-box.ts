import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "crypto";

/**
 * Authenticated encryption for small secrets at rest (per-org gateway
 * credentials). AES-256-GCM; key derived via HKDF from CREDENTIALS_KEY
 * (falls back to AUTH_SECRET so dev works without extra setup — set a
 * dedicated CREDENTIALS_KEY in production so rotating one doesn't rotate
 * the other).
 *
 * Token format: v1.<iv b64url>.<ciphertext b64url>.<gcm tag b64url>
 */

const VERSION = "v1";

function key(): Buffer {
  const source = process.env.CREDENTIALS_KEY ?? process.env.AUTH_SECRET;
  if (!source) throw new Error("CREDENTIALS_KEY or AUTH_SECRET must be set");
  return Buffer.from(hkdfSync("sha256", source, "kindpath-credbox", "aes-256-gcm", 32));
}

export function seal(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), ct.toString("base64url"), tag.toString("base64url")].join(".");
}

export function open(token: string | null | undefined): string | null {
  if (!token) return null;
  const [v, ivB64, ctB64, tagB64] = token.split(".");
  if (v !== VERSION || !ivB64 || !ctB64 || !tagB64) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB64, "base64url"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null; // wrong key, tampered, or truncated
  }
}
