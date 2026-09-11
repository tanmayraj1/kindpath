/**
 * Where this deployment lives, and where the product officially lives.
 *
 * These are the same thing in production and different on a preview, which is
 * why they are two functions.
 *
 * `NEXT_PUBLIC_APP_URL` names the production site. A preview deployment has its
 * own hostname, so a preview that reuses that value sends people to production
 * halfway through whatever they were doing: the payment gateway's redirect after
 * a card is authorised, the "complete your receipt" link in an email, the QR code
 * on the giving page. The donor would land on the real site holding a token minted
 * against the preview's database, and nothing would resolve.
 *
 * Both are server-only: `VERCEL_URL` is not exposed to the browser.
 */

/** This deployment — for redirects back to us, emailed links and QR codes. */
export function appUrl(): string {
  if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

/**
 * The canonical public site — for SEO only (canonical tags, sitemap, robots,
 * structured data, Open Graph). These must keep naming production even when
 * rendered by a preview, or a preview could advertise itself as the real site.
 */
export function canonicalUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://www.kind-path.org";
}
