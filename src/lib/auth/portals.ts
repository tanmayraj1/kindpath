/**
 * Where each principal belongs, and how to safely honour a requested destination.
 *
 * Deliberately dependency-free: `middleware.ts` runs on the edge runtime and
 * cannot import Prisma or anything marked `server-only`, and middleware and the
 * login actions must agree on these rules exactly. Anything imported here would
 * have to hold on the edge too.
 */

export type PrincipalKind = "platform" | "org" | "donor" | "volunteer";

export const PORTAL_HOME: Record<PrincipalKind, string> = {
  platform: "/admin",
  org: "/dashboard",
  donor: "/portal",
  volunteer: "/volunteer",
};

/**
 * Resolve a caller-supplied `?next=` to a path this principal may actually open.
 *
 * Middleware sets `next` when it bounces an unauthenticated request, so honouring
 * it is what makes a deep link survive sign-in — today it is set and then thrown
 * away, so every link into the app lands you on a portal home page instead.
 *
 * The value is attacker-controlled: anyone can send someone a `/login?next=…`
 * URL, and the login form carries it in a hidden field. So this is a filter, not
 * a parse — anything not provably an in-app path for THIS principal falls back
 * to their own home rather than being repaired.
 *
 * Rejected, each for a specific reason:
 *   - `https://evil.com`      absolute, obviously off-site
 *   - `//evil.com`            protocol-relative; a browser treats it as off-site
 *   - `/\evil.com`            browsers normalise `\` to `/` in special schemes,
 *                             so a naive "starts with /" check lets this through
 *   - control characters      header/URL splitting
 *   - `/dashboard` for a donor  cross-portal; middleware would bounce it anyway,
 *                             but bouncing twice is a worse experience than
 *                             landing somewhere correct the first time
 *   - `/portalx/...`          prefix-matches `/portal` textually but is a
 *                             different route
 */
export function safeNext(next: string | null | undefined, kind: PrincipalKind): string {
  const home = PORTAL_HOME[kind];
  if (!next) return home;

  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return home;
  // Control characters, including CR and LF — header/URL splitting.
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(next)) return home;

  let url: URL;
  try {
    url = new URL(next, "http://internal.invalid");
  } catch {
    return home;
  }
  // A relative parse that changed origin means the input smuggled one in.
  if (url.origin !== "http://internal.invalid") return home;

  // Must be the principal's own portal, or something inside it.
  if (url.pathname !== home && !url.pathname.startsWith(`${home}/`)) return home;

  // The fragment never reaches the server, so there is nothing to preserve there.
  return url.pathname + url.search;
}
