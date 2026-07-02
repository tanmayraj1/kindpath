import { describe, it, expect } from "vitest";
import { validateImage, MAX_LOGO_BYTES } from "./image";
import { getStorage } from "./index";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const WEBP = Buffer.concat([
  Buffer.from("RIFF", "ascii"),
  Buffer.from([0, 0, 0, 0]),
  Buffer.from("WEBP", "ascii"),
]);

describe("validateImage", () => {
  it("accepts PNG/JPG/WebP by magic bytes", () => {
    expect(validateImage(PNG, "image/png")).toMatchObject({ ok: true, contentType: "image/png" });
    expect(validateImage(JPG, "image/jpeg")).toMatchObject({ ok: true, contentType: "image/jpeg" });
    expect(validateImage(WEBP, "image/webp")).toMatchObject({ ok: true, contentType: "image/webp" });
  });

  it("rejects an empty file", () => {
    expect(validateImage(Buffer.alloc(0), "image/png")).toMatchObject({ ok: false });
  });

  it("rejects files over the size cap", () => {
    const big = Buffer.concat([PNG, Buffer.alloc(MAX_LOGO_BYTES)]);
    expect(validateImage(big, "image/png")).toMatchObject({ ok: false });
  });

  it("rejects disallowed / spoofed types (e.g. SVG or script)", () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>', "utf8");
    expect(validateImage(svg, "image/svg+xml")).toMatchObject({ ok: false });
    const html = Buffer.from("<html>gotcha</html>", "utf8");
    expect(validateImage(html, "image/png")).toMatchObject({ ok: false });
  });

  it("rejects when declared type contradicts the bytes", () => {
    // real PNG bytes but claims to be jpeg
    expect(validateImage(PNG, "image/jpeg")).toMatchObject({ ok: false });
  });
});

describe("data-uri storage", () => {
  it("encodes bytes to a usable data: URL", async () => {
    const { url } = await getStorage().put("org1", PNG, "image/png");
    expect(url).toBe(`data:image/png;base64,${PNG.toString("base64")}`);
  });
});
