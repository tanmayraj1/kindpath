import { runBilling } from "@/lib/billing";
import { runSubscriptionCycle } from "@/lib/subscriptions";
import { captureError, log } from "@/lib/observability";
import { startJobRun, finishJobRun } from "@/lib/job-runs";
import { requireCronAuth } from "@/lib/cron-auth";
import { purgeExpiredLoginCodes } from "@/lib/auth/login-code";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/**
 * Both crons do real work per row — a gateway charge and an email each — so the
 * platform default (10s) kills them partway, leaving the heartbeat row stuck at
 * "running". The work itself is bounded to stay comfortably inside this.
 */
export const maxDuration = 60;

/**
 * Trigger a recurring-billing run. Protect with CRON_SECRET via either:
 *   Authorization: Bearer <CRON_SECRET>   or   ?secret=<CRON_SECRET>
 * Point a scheduler (Vercel Cron, GitHub Actions, etc.) at this daily.
 */
async function handle(req: Request) {
  const denied = requireCronAuth(req, "billing");
  if (denied) return denied;

  const runId = await startJobRun("billing");

  // Two independent money flows. Isolated from each other on purpose: a fault in
  // KindPath's own invoicing must never stop donors' recurring gifts from being
  // collected, and vice versa.
  const result: { donations?: unknown; subscriptions?: unknown; errors: string[] } = { errors: [] };

  try {
    result.donations = await runBilling();
  } catch (e) {
    captureError(e, { source: "cron.billing.donations" });
    result.errors.push("donation billing failed");
  }

  try {
    result.subscriptions = await runSubscriptionCycle();
  } catch (e) {
    captureError(e, { source: "cron.billing.subscriptions" });
    result.errors.push("subscription cycle failed");
  }

  // Housekeeping that rides on the daily tick. Expired sign-in codes are
  // already unusable (consume checks expiresAt), so this is hygiene, not
  // security — and a failure here must not mark billing as failed.
  try {
    await purgeExpiredLoginCodes();
  } catch (e) {
    captureError(e, { source: "cron.billing.purgeLoginCodes" });
  }

  const ok = result.errors.length === 0;
  // The heartbeat records the outcome so "when did billing last succeed?" has an
  // answer, and /api/health can go red on its own if this stops running.
  await finishJobRun(runId, {
    ok,
    summary: { donations: result.donations, subscriptions: result.subscriptions },
    error: ok ? undefined : result.errors.join("; "),
  });

  log("info", "cron run complete", { errors: result.errors.length });
  // A crashed run means missed charges — surface it rather than reporting success.
  return Response.json({ ok, ...result }, { status: ok ? 200 : 500 });
}

export const GET = handle;
export const POST = handle;
