/**
 * Validation for user-uploaded raster images (org logos). SVG is intentionally
 * rejected: even rendered via <img> it's a needless XSS/parsing surface, and the
 * receipt PDF renderer only handles raster formats reliably.
 */

export const MAX_LOGO_BYTES = 256 * 1024; // 256 KB — plenty for a logo, keeps the inlined data URI small

const ALLOWED: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

// Magic-byte signatures — don't trust the browser-supplied MIME alone.
function sniff(bytes: Buffer): string | null {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export type ImageCheck =
  | { ok: true; contentType: string; ext: string }
  | { ok: false; error: string };

/** Validate size + true content type of an uploaded image. */
export function validateImage(bytes: Buffer, declaredType: string): ImageCheck {
  if (bytes.length === 0) return { ok: false, error: "The file is empty." };
  if (bytes.length > MAX_LOGO_BYTES) {
    return { ok: false, error: "That image is too large — please use one under 256 KB." };
  }
  const sniffed = sniff(bytes);
  if (!sniffed || !ALLOWED[sniffed]) {
    return { ok: false, error: "Use a PNG, JPG or WebP image." };
  }
  // The declared type should agree with the bytes (defence in depth; not fatal alone).
  if (declaredType && ALLOWED[declaredType] && declaredType !== sniffed) {
    return { ok: false, error: "The file type doesn't match its contents." };
  }
  return { ok: true, contentType: sniffed, ext: ALLOWED[sniffed] };
}
