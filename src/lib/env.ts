/**
 * Fail-fast environment validation. Imported by the DB layer so misconfiguration
 * surfaces immediately on first server use rather than as a confusing runtime error.
 * Missing vars throw in production; in development we only warn (so `npm run dev`
 * works against the local defaults). During `next build` ("Collecting page data"
 * imports this module) we also only warn — CI/Vercel builds shouldn't need runtime
 * secrets to compile; the hard failure still happens on first real request.
 */
const REQUIRED = ["DATABASE_URL", "AUTH_SECRET"] as const;
const PROD_REQUIRED = ["ADMIN_DATABASE_URL", "NEXT_PUBLIC_APP_URL", "CRON_SECRET"] as const;

let validated = false;

export function assertEnv() {
  if (validated) return;
  validated = true;

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
    if (process.env.PAYMENT_PROVIDER === "stripe") {
      if (!process.env.STRIPE_SECRET_KEY) missing.push("STRIPE_SECRET_KEY");
      if (!process.env.STRIPE_WEBHOOK_SECRET) missing.push("STRIPE_WEBHOOK_SECRET");
      if (process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_")) {
        console.warn("⚠️  Stripe is in TEST mode (sk_test_) while NODE_ENV=production.");
      }
    }
    if (process.env.PAYMENT_PROVIDER === "wevend") {
      for (const key of ["WEVEND_BASE_URL", "WEVEND_IFRAME_URL", "WEVEND_MID", "WEVEND_EMAIL", "WEVEND_PASSWORD", "WEVEND_TERM_ID"]) {
        if (!process.env[key]) missing.push(key);
      }
    }
  }

  if (missing.length) {
    const msg = `Missing required environment variables: ${missing.join(", ")}`;
    const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
    if (isProd && !isBuildPhase) throw new Error(msg);
    console.warn(`⚠️  ${msg} (${isBuildPhase ? "build" : "dev"}: continuing)`);
  }
}
