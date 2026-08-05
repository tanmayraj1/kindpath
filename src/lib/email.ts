/**
 * Minimal email sender. Uses Resend's HTTP API when RESEND_API_KEY is set;
 * otherwise logs to the console (dev fallback) so the full flow works locally
 * without an email account. No SDK dependency — just fetch.
 *
 * The dev fallback reports `simulated: true` so callers never record a receipt
 * as genuinely delivered when nothing left the building. `RESEND_API_KEY` is a
 * hard production requirement (src/lib/env.ts), so the fallback cannot run in prod.
 */
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
    // Dev fallback — no provider configured.
    console.log(`\n📧 [email:dev] to=${to}\n   subject=${subject}\n   (set RESEND_API_KEY to send for real)\n`);
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
function safeColor(c?: string | null): string {
  if (!c) return "#4f46e5";
  return HEX6.test(c) ? (c.startsWith("#") ? c : `#${c}`) : "#4f46e5";
}

/** Branded HTML wrapper. When `brand` is provided, the email adopts the org's
 *  logo/name + brand color; otherwise it falls back to KindPath styling. */
export function emailLayout(opts: {
  heading: string;
  body: string;
  cta?: { label: string; url: string };
  brand?: EmailBrand;
}) {
  const color = safeColor(opts.brand?.brandColor);
  const header = opts.brand?.logoUrl
    ? `<img src="${opts.brand.logoUrl}" alt="${opts.brand.orgName ?? ""}" style="max-height:40px;max-width:200px;margin-bottom:16px"/>`
    : opts.brand?.orgName
      ? `<div style="font-weight:800;font-size:20px;margin-bottom:16px;color:${color}">${opts.brand.orgName}</div>`
      : `<div style="font-weight:800;font-size:20px;margin-bottom:16px">Kind<span style="color:#4f46e5">Path</span></div>`;
  const footer = opts.brand?.orgName
    ? `${opts.brand.orgName} · powered by KindPath`
    : `KindPath · Donation management for faith communities`;
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Inter,Arial,sans-serif;color:#0f172a">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px">
    ${header}
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:28px;border-top:4px solid ${color}">
      <h1 style="font-size:18px;margin:0 0 12px">${opts.heading}</h1>
      <div style="font-size:14px;line-height:1.6;color:#334155">${opts.body}</div>
      ${
        opts.cta
          ? `<div style="margin-top:24px"><a href="${opts.cta.url}" style="display:inline-block;background:${color};color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-size:14px;font-weight:600">${opts.cta.label}</a></div>`
          : ""
      }
    </div>
    <p style="font-size:12px;color:#94a3b8;text-align:center;margin-top:16px">${footer}</p>
  </div></body></html>`;
}
