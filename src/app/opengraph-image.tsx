import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "KindPath — Donation management for Canadian faith communities";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * The card every shared KindPath link renders as.
 *
 * Generated rather than a committed PNG: it inherits the brand values from this
 * file instead of from an asset nobody re-exports, so a palette change can't
 * leave a stale image in circulation the way the pre-reskin indigo survived in
 * the email templates.
 *
 * Deliberately plain — system fonts, flat colour, no gradients or fetched
 * assets. This runs on the edge and must render in milliseconds; every font file
 * or remote image is a network hop that can time out and leave a link previewing
 * as a grey box.
 *
 * Two Satori constraints this file learned the hard way, both of which fail at
 * RENDER time rather than at build or typecheck — so the only way to catch them
 * is to actually fetch the image:
 *
 *  1. Every <div> with more than one child must declare display:flex explicitly.
 *     Satori has no block layout; a bare div with two children throws.
 *  2. Only glyphs present in the bundled system font render. A "✓" sends Satori
 *     to fetch a dynamic font, which 400s here and aborts the whole response.
 *     Draw shapes with divs, not with symbol characters.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#FAF9EF",
          padding: "72px 80px",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              background: "#1F7A6D",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* The check drawn as two rotated bars — a "✓" character has no
                glyph in the bundled font and aborts the render. */}
            <div
              style={{
                display: "flex",
                width: 22,
                height: 11,
                borderLeft: "4px solid #fff",
                borderBottom: "4px solid #fff",
                transform: "rotate(-45deg)",
                marginTop: -4,
              }}
            />
          </div>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 700, color: "#101613" }}>
            <span>Kind</span>
            <span style={{ color: "#1F7A6D" }}>Path</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              fontSize: 68,
              fontWeight: 700,
              color: "#101613",
              lineHeight: 1.08,
              letterSpacing: "-0.02em",
              maxWidth: 940,
            }}
          >
            Modern giving for faith communities.
          </div>
          <div style={{ fontSize: 30, color: "#5A625C", maxWidth: 900, lineHeight: 1.35 }}>
            CRA-compliant tax receipts, recurring giving and a donor portal — built for Canadian
            temples, churches and mosques.
          </div>
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          {["CRA receipts", "Recurring giving", "Donor portal", "Made in Canada"].map((t) => (
            <div
              key={t}
              style={{
                fontSize: 22,
                fontWeight: 600,
                color: "#1F7A6D",
                background: "#E9F5F0",
                padding: "10px 20px",
                borderRadius: 999,
              }}
            >
              {t}
            </div>
          ))}
        </div>
      </div>
    ),
    size
  );
}
