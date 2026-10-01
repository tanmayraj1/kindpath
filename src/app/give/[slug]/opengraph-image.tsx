import { ImageResponse } from "next/og";
import { getPublicOrg } from "@/lib/queries/public";
import { BRAND_HEX } from "@/lib/brand";
import { normalizeBrandColor } from "@/lib/brand-color";

// Node, not edge: this reads the organization from the database.
export const runtime = "nodejs";
// Branding changes should show up in new shares without a redeploy, but an
// unfurler fetching the same link repeatedly needn't hit the database each time.
export const revalidate = 600;
export const alt = "Give online";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * The preview card for a charity's giving link — their name, logo and colour.
 *
 * Shares the Satori rules learned in src/app/opengraph-image.tsx: every div with
 * several children declares display:flex, and no glyph the bundled font lacks
 * may reach the renderer — a missing glyph triggers a font fetch that fails and
 * aborts the whole image, which unfurls as a grey box. Hence `renderable()`.
 */

/** Latin (incl. accents) and common punctuation — what the bundled font covers. */
function renderable(text: string): boolean {
  return /^[ -ɏ‐-‧′″]*$/.test(text);
}

/** Satori decodes PNG and JPEG data URIs; WebP (and anything remote) is skipped. */
function usableLogo(url: string | null | undefined): string | null {
  if (!url) return null;
  return /^data:image\/(png|jpe?g);base64,/i.test(url) ? url : null;
}

function nameSize(name: string): number {
  if (name.length <= 18) return 84;
  if (name.length <= 28) return 72;
  if (name.length <= 40) return 60;
  return 50;
}

export default async function GiveOpengraphImage({ params }: { params: { slug: string } }) {
  const org = await getPublicOrg(params.slug);

  const color = normalizeBrandColor(org?.primaryColor ?? "") ?? BRAND_HEX;
  const rawName = org?.name ?? "";
  const name = rawName && renderable(rawName) ? rawName : null;
  const logo = usableLogo(org?.logoUrl);
  const initials = (name ?? "")
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  const registered = org?.charityStatus === "registered";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#FAF9EF",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* The charity's colour, edge to edge, so the card reads as theirs at a glance. */}
        <div style={{ display: "flex", height: 18, background: color }} />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            flexGrow: 1,
            padding: "60px 80px 56px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo}
                alt=""
                height={120}
                style={{ maxWidth: 320, height: 120, objectFit: "contain" }}
              />
            ) : (
              <div
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: 60,
                  background: color,
                  color: "#ffffff",
                  fontSize: 48,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {initials}
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ fontSize: 34, fontWeight: 600, color }}>Give to</div>
            <div
              style={{
                fontSize: name ? nameSize(name) : 72,
                fontWeight: 700,
                color: "#101613",
                lineHeight: 1.05,
                letterSpacing: "-0.02em",
                maxWidth: 1040,
              }}
            >
              {name ?? "Give online"}
            </div>
            <div style={{ fontSize: 28, color: "#5A625C" }}>
              {registered
                ? "Secure online donation · Official tax receipt by email"
                : "Secure online donation · Confirmation by email"}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 15,
                background: BRAND_HEX,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {/* The KindPath check drawn as two bars — no glyph needed. */}
              <div
                style={{
                  display: "flex",
                  width: 12,
                  height: 6,
                  borderLeft: "3px solid #fff",
                  borderBottom: "3px solid #fff",
                  transform: "rotate(-45deg)",
                  marginTop: -2,
                }}
              />
            </div>
            <div style={{ display: "flex", fontSize: 24, color: "#5A625C" }}>
              <span style={{ marginRight: 8 }}>Powered by</span>
              <span style={{ fontWeight: 700, color: "#101613" }}>Kind</span>
              <span style={{ fontWeight: 700, color: BRAND_HEX }}>Path</span>
            </div>
          </div>
        </div>
      </div>
    ),
    size
  );
}
