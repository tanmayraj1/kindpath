/**
 * Browser-only: shrink an uploaded logo so it fits the server's size limit.
 *
 * Logos are stored inline as data URIs (src/lib/storage) and embedded in emails
 * and the PDF receipt, so the server caps them at MAX_LOGO_BYTES. A logo straight
 * from a designer or a website is routinely larger than that, and the admin got
 * "too large" with no way to fix it short of an image editor. This does the
 * resizing for them.
 *
 * Output is always PNG or JPEG. WebP is accepted as input but not produced: the
 * PDF renderer and several email clients cannot display it.
 */

const TARGET_BYTES = 240 * 1024; // a margin under the server's 256 KB
const MAX_SIDE = 600; // logos render at ~40–120 px; 600 covers high-DPI screens

async function decode(file: File): Promise<CanvasImageSource & { width: number; height: number }> {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file);
    } catch {
      // fall through to <img>, which handles a few formats createImageBitmap rejects
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function encode(
  source: CanvasImageSource & { width: number; height: number },
  maxSide: number,
  type: "image/png" | "image/jpeg",
  quality?: number
): Promise<Blob | null> {
  const scale = Math.min(1, maxSide / Math.max(source.width, source.height));
  const w = Math.max(1, Math.round(source.width * scale));
  const h = Math.max(1, Math.round(source.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  if (type === "image/jpeg") {
    // JPEG has no transparency; a transparent logo would otherwise turn black.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
  }
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, w, h);
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Returns a file small enough to upload, or the original when it already is
 * (so a well-prepared logo is never re-encoded) or when shrinking fails — the
 * server then reports the problem as before.
 */
export async function shrinkLogo(file: File): Promise<File> {
  const alreadyFine =
    file.size <= TARGET_BYTES && (file.type === "image/png" || file.type === "image/jpeg");
  if (alreadyFine) return file;

  try {
    const img = await decode(file);
    const base = file.name.replace(/\.[^.]+$/, "") || "logo";

    // PNG first: it keeps transparency, which most logos rely on.
    const attempts: [number, "image/png" | "image/jpeg", number?][] = [
      [MAX_SIDE, "image/png"],
      [400, "image/png"],
      [MAX_SIDE, "image/jpeg", 0.88],
      [400, "image/jpeg", 0.82],
    ];
    for (const [side, type, q] of attempts) {
      const blob = await encode(img, side, type, q);
      if (blob && blob.size <= TARGET_BYTES) {
        return new File([blob], `${base}.${type === "image/png" ? "png" : "jpg"}`, { type });
      }
    }
  } catch {
    // Undecodable in this browser — let the server's validation explain.
  }
  return file;
}
