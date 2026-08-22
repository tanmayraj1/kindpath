import { db, adminDb } from "@/lib/db";
import { captureError } from "@/lib/observability";
import { getJobHealth, STALE_AFTER_HOURS } from "@/lib/job-runs";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { platformGatewayHealth } from "@/lib/payments/platform-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveness check for uptime monitors.
 *
 * Checks BOTH database roles. It previously only pinged `adminDb` — the
 * superuser/migration connection — so a broken `DATABASE_URL` or a revoked grant
 * on the RLS-constrained app role (which actually serves every request) would
 * still report `ok: true` while the site was down for users.
 *
 * It also reports the billing cron's heartbeat, so an uptime monitor watching
 * this endpoint catches a cron that has silently stopped firing — otherwise
 * indistinguishable from a cron with nothing to do.
 */
export async function GET() {
  // Unauthenticated and it touches the database, so it needs its own budget.
  if (!(await rateLimit(`health:${clientIp()}`, 60, 60_000)).ok) {
    return Response.json({ error: "too many requests" }, { status: 429 });
  }

  const startedAt = Date.now();
  const base = {
    release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
    env: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
  };

  try {
    await Promise.all([db.$queryRaw`SELECT 1`, adminDb.$queryRaw`SELECT 1`]);
  } catch (e) {
    captureError(e, { source: "health" });
    return Response.json({ ok: false, db: "down", ...base }, { status: 503 });
  }
  const dbLatencyMs = Date.now() - startedAt;

  // A stale cron is degraded, not down: the site works, but money isn't moving.
  // Reported as 503 so an uptime monitor actually alerts on it.
  let billing;
  try {
    const health = await getJobHealth("billing");
    billing = {
      lastSuccessAt: health.lastSuccessAt,
      lastStatus: health.lastStatus,
      hoursSinceSuccess:
        health.hoursSinceSuccess === null ? null : Math.round(health.hoursSinceSuccess * 10) / 10,
      staleAfterHours: STALE_AFTER_HOURS,
      stale: health.stale,
    };
  } catch (e) {
    captureError(e, { source: "health.jobs" });
    billing = { stale: true, error: "could not read job heartbeat" };
  }

  // The platform gateway is what every org without its own account charges
  // through. A key that boots but cannot take CAD (wrong-country account) is
  // "down" for donations even though every page renders.
  const payments = await platformGatewayHealth();
  const paymentsBroken = payments.checked && !payments.ok;

  const ok = !billing.stale && !paymentsBroken;
  return Response.json(
    { ok, db: "up", dbLatencyMs, billing, payments, ...base },
    { status: ok ? 200 : 503 }
  );
}
