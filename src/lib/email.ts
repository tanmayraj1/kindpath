/**
 * Minimal email sender. Uses Resend's HTTP API when RESEND_API_KEY is set;
 * otherwise logs to the console (dev fallback) so the full flow works locally
 * without an email account. No SDK dependency — just fetch.
 *
 * The dev fallback reports `simulated: true` so callers never record a receipt
 * as genuinely delivered when nothing left the building. `RESEND_API_KEY` is a
 * hard production requirement (src/lib/env.ts), so the fallback cannot run in prod.
 */
import { BRAND_HEX } from "@/lib/brand";

type SendInput = {
  to: string;
  subject: string;
  html: string;
};

export type SendResult =
  | { ok: true; id?: string; simulated?: boolean }
  | { ok: false; error: string; retryable: boolean };

/** HTTP statuses worth another attempt: rate limits and transient server faults. */
function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

export async function sendEmail({ to, subject, html }: SendInput): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "KindPath <receipts@kindpath.app>";

  if (!apiKey) {
    // Dev fallback — no provider configured. Action links are echoed because
    // invite, reset and portal-setup flows are otherwise untestable locally:
    // the raw token exists ONLY in the email body by design, so without this
    // there is no way to follow one without reading it out of the database.
    // Guarded on NODE_ENV so a production misconfiguration can never print a
    // live credential into a log aggregator.
    const links =
      process.env.NODE_ENV === "production"
        ? []
        : (html.match(/href="[^"]*\/(?:reset|verify)\?token=[^"]*"/g) ?? []).map((h) =>
            h.slice(6, -1)
          );
    console.log(
      `\n📧 [email:dev] to=${to}\n   subject=${subject}` +
        links.map((u) => `\n   🔗 ${u}`).join("") +
        `\n   (set RESEND_API_KEY to send for real)\n`
    );
    return { ok: true, id: "dev-console", simulated: true };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) {
      const body = await res.text();
      return {
        ok: false,
        error: `Resend ${res.status}: ${body.slice(0, 200)}`,
        retryable: isRetryableStatus(res.status),
      };
    }
    const data = (await res.json()) as { id?: string };
    return { ok: true, id: data.id };
  } catch (e) {
    // Network-level failure — always worth retrying.
    return { ok: false, error: e instanceof Error ? e.message : "send failed", retryable: true };
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Send with bounded exponential backoff. Only retries transient failures — a
 * rejected address or bad API key fails immediately rather than burning 3 attempts.
 */
export async function sendEmailWithRetry(input: SendInput, attempts = 3): Promise<SendResult> {
  let last: SendResult = { ok: false, error: "no attempt made", retryable: false };
  for (let i = 0; i < attempts; i++) {
    last = await sendEmail(input);
    if (last.ok || !last.retryable) return last;
    if (i < attempts - 1) await sleep(250 * 2 ** i); // 250ms, 500ms
  }
  return last;
}

/** Escape user-supplied text before interpolating into email HTML (anti-injection). */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type EmailBrand = {
  orgName?: string;
  brandColor?: string | null;
  logoUrl?: string | null;
};

const HEX6 = /^#?[0-9a-fA-F]{6}$/;

/**
 * KindPath's own brand colour, for emails an org hasn't branded.
 *
 * A literal, not a token: email clients don't resolve CSS custom properties, so
 * this cannot read `--brand-600` the way the app does. That makes it the one
 * place a palette change has to be mirrored by hand — this constant was still
 * the pre-reskin indigo after the whole product moved to teal, which is exactly
 * the drift a named constant makes visible and a scattered literal does not.
 */
const KINDPATH_BRAND = BRAND_HEX;

export function brandHex(c?: string | null): string {
  return safeColor(c);
}

function safeColor(c?: string | null): string {
  if (!c) return KINDPATH_BRAND;
  return HEX6.test(c) ? (c.startsWith("#") ? c : `#${c}`) : KINDPATH_BRAND;
}

/** Branded HTML wrapper. When `brand` is provided, the email adopts the org's
 *  logo/name + brand color; otherwise it falls back to KindPath styling. */
export function emailLayout(opts: {
  heading: string;
  body: string;
  cta?: { label: string; url: string };
  /**
   * Several actions in one email. Used where an address legitimately belongs to
   * more than one account and each needs its own single-use link — one message
   * with two buttons beats two near-identical messages arriving together.
   */
  ctas?: { label: string; url: string }[];
  brand?: EmailBrand;
}) {
  const color = safeColor(opts.brand?.brandColor);
  const header = opts.brand?.logoUrl
    ? `<img src="${opts.brand.logoUrl}" alt="${opts.brand.orgName ?? ""}" style="max-height:40px;max-width:200px;margin-bottom:16px"/>`
    : opts.brand?.orgName
      ? `<div style="font-weight:800;font-size:20px;margin-bottom:16px;color:${color}">${opts.brand.orgName}</div>`
      : `<div style="font-weight:800;font-size:20px;margin-bottom:16px">Kind<span style="color:${KINDPATH_BRAND}">Path</span></div>`;
  const footer = opts.brand?.orgName
    ? `${opts.brand.orgName} · powered by KindPath`
    : `KindPath · Donation management for faith communities`;
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Inter,Arial,sans-serif;color:#0f172a">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px">
    ${header}
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:28px;border-top:4px solid ${color}">
      <h1 style="font-size:18px;margin:0 0 12px">${opts.heading}</h1>
      <div style="font-size:14px;line-height:1.6;color:#334155">${opts.body}</div>
      ${(opts.ctas ?? (opts.cta ? [opts.cta] : []))
        .map(
          (c, i) =>
            `<div style="margin-top:${i === 0 ? 24 : 10}px"><a href="${c.url}" style="display:inline-block;background:${i === 0 ? color : "#fff"};color:${i === 0 ? "#fff" : color};border:1px solid ${color};text-decoration:none;padding:11px 20px;border-radius:8px;font-size:14px;font-weight:600">${c.label}</a></div>`
        )
        .join("")}
    </div>
    <p style="font-size:12px;color:#94a3b8;text-align:center;margin-top:16px">${footer}</p>
  </div></body></html>`;
}
