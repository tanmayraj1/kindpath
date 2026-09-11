/**
 * Fail-fast environment validation. Imported by the DB layer so misconfiguration
 * surfaces immediately on first server use rather than as a confusing runtime error.
 * Missing vars throw in production; in development we only warn (so `npm run dev`
 * works against the local defaults). During `next build` ("Collecting page data"
 * imports this module) we also only warn — CI/Vercel builds shouldn't need runtime
 * secrets to compile; the hard failure still happens on first real request.
 */
const REQUIRED = ["DATABASE_URL", "AUTH_SECRET"] as const;
const PROD_REQUIRED = [
  "ADMIN_DATABASE_URL",
  "NEXT_PUBLIC_APP_URL",
  "CRON_SECRET",
  // Without this, src/lib/email.ts silently falls back to console logging and
  // every receipt is recorded as delivered while nothing actually sends.
  "RESEND_API_KEY",
  // Resend rejects any send whose From address isn't on a domain verified to the
  // account. The fallback in src/lib/email.ts is an address on a domain we don't
  // own, so a deployment with RESEND_API_KEY set but this unset doesn't degrade —
  // it fails every single send, including receipts and password-reset links,
  // while the API key's presence makes the code believe mail is going out.
  "EMAIL_FROM",
  // Encrypts each org's gateway credentials. It falls back to AUTH_SECRET, so
  // leaving it unset couples credential decryption to session signing: rotating
  // AUTH_SECRET would destroy every org's stored gateway credentials and
  // invalidate every receipt link already emailed to a donor.
  "CREDENTIALS_KEY",
] as const;

let validated = false;

/**
 * Collect the names of every missing/invalid required variable, WITHOUT throwing.
 *
 * Split out of `assertEnv` so a diagnostic route can report configuration state
 * on an instance that is otherwise unbootable: `assertEnv()` throws while
 * `src/lib/db.ts` is being imported, which kills every route that touches the
 * database before its handler — or any error boundary — ever runs. The only
 * evidence then lives in the platform's function logs, and the browser sees a
 * bare 500 with nothing to act on.
 *
 * Returns variable NAMES only, never values. The names are already public (they
 * are listed in .env.example in the repo), so this discloses nothing a reader of
 * the source doesn't have — while the fact that the app is misconfigured is
 * already evident from the 500s it is emitted to explain.
 */
export function isSimulatedProvider(provider: string | undefined): boolean {
  return provider === "mock" || provider === "mock-hosted";
}

/**
 * May the simulated gateway run on this deployment?
 *
 * `NODE_ENV` is "production" for EVERY Next.js production build, including
 * Vercel preview deployments, so it cannot tell "the real site" from "a throwaway
 * demo URL" — which is why this keys on `VERCEL_ENV` instead.
 *
 * Preview and development deployments may simulate. The production deployment
 * may not, and neither may a self-hosted production build (no VERCEL_ENV at all),
 * because the mock's webhook verifier accepts unsigned JSON: wherever it runs,
 * /api/webhooks/pos becomes an unauthenticated way to void tax receipts. That
 * endpoint additionally refuses simulated events on any hosted deployment — see
 * src/app/api/webhooks/pos/route.ts — so this relaxation cannot reopen that hole.
 */
export function simulatedGatewayAllowed(): boolean {
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv) return vercelEnv !== "production";
  // Not on Vercel: allowed only outside a production build.
  return process.env.NODE_ENV !== "production";
}

export function missingEnv(): string[] {
  const isProd = process.env.NODE_ENV === "production";
  const missing: string[] = [];

  for (const key of REQUIRED) {
    if (!process.env[key]) missing.push(key);
  }
  if (isProd) {
    for (const key of PROD_REQUIRED) {
      if (!process.env[key]) missing.push(key);
    }
    if (process.env.AUTH_SECRET && process.env.AUTH_SECRET.length < 32) {
      missing.push("AUTH_SECRET (must be ≥32 chars in production)");
    }

    // A real provider must be named explicitly. Leaving this unset used to fall
    // through to MockAdapter (src/lib/payments/index.ts), whose webhook verifier
    // accepted unsigned JSON — turning /api/webhooks/pos into an unauthenticated
    // way to void a charity's official tax receipts. Never default in production.
    const provider = process.env.PAYMENT_PROVIDER;
    if (!provider) {
      missing.push("PAYMENT_PROVIDER (must be 'stripe' or 'wevend' in production)");
    } else if ((provider === "mock" || provider === "mock-hosted") && !simulatedGatewayAllowed()) {
      missing.push(
        `PAYMENT_PROVIDER is '${provider}' — the simulated gateway must never run in production`
      );
    } else if (provider !== "stripe" && provider !== "wevend" && !isSimulatedProvider(provider)) {
      missing.push(`PAYMENT_PROVIDER '${provider}' is not a known provider`);
    }

    if (process.env.PAYMENT_PROVIDER === "stripe") {
      // Shape, not just presence. A presence check passes on a placeholder — and
      // the failure that produces is the worst kind: the app boots, /api/ready
      // reports {"ready":true}, the site looks fixed, and the first REAL donor
      // gets a Stripe auth error at the moment they try to give. Keys have a
      // known prefix, so this is cheap to catch at boot instead of at the till.
      const sk = process.env.STRIPE_SECRET_KEY;
      const whsec = process.env.STRIPE_WEBHOOK_SECRET;

      if (!sk) {
        missing.push("STRIPE_SECRET_KEY");
      } else if (!/^sk_(test|live)_[A-Za-z0-9]{10,}$/.test(sk)) {
        missing.push(
          "STRIPE_SECRET_KEY doesn't look like a Stripe key (expected sk_test_… or sk_live_…) — a placeholder was probably pasted"
        );
      }

      if (!whsec) {
        missing.push("STRIPE_WEBHOOK_SECRET");
      } else if (!/^whsec_[A-Za-z0-9]{10,}$/.test(whsec)) {
        missing.push(
          "STRIPE_WEBHOOK_SECRET doesn't look like a signing secret (expected whsec_…) — a placeholder was probably pasted"
        );
      }

      if (sk?.startsWith("sk_test_")) {
        console.warn("⚠️  Stripe is in TEST mode (sk_test_) while NODE_ENV=production.");
      }
    }
    if (process.env.PAYMENT_PROVIDER === "wevend") {
      for (const key of ["WEVEND_BASE_URL", "WEVEND_IFRAME_URL", "WEVEND_MID", "WEVEND_PASSWORD", "WEVEND_TERM_ID"]) {
        if (!process.env[key]) missing.push(key);
      }
      // Two auth shapes: org/ISV (wvNumber) or merchant (email). Exactly one is enough.
      if (!process.env.WEVEND_WV_NUMBER && !process.env.WEVEND_EMAIL) {
        missing.push("WEVEND_WV_NUMBER or WEVEND_EMAIL");
      }
    }
  }

  return missing;
}

export function assertEnv() {
  if (validated) return;
  validated = true;

  const isProd = process.env.NODE_ENV === "production";
  const missing = missingEnv();

  if (missing.length) {
    const msg = `Missing required environment variables: ${missing.join(", ")}`;
    const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
    if (isProd && !isBuildPhase) throw new Error(msg);
    console.warn(`⚠️  ${msg} (${isBuildPhase ? "build" : "dev"}: continuing)`);
  }
}
