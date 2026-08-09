import crypto from "node:crypto";
import { runBilling } from "@/lib/billing";
import { runSubscriptionCycle } from "@/lib/subscriptions";
import { captureError, log } from "@/lib/observability";
import { startJobRun, finishJobRun, logUnauthorizedCron } from "@/lib/job-runs";
import { clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Constant-time secret comparison to avoid timing attacks. */
function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Trigger a recurring-billing run. Protect with CRON_SECRET via either:
 *   Authorization: Bearer <CRON_SECRET>   or   ?secret=<CRON_SECRET>
 * Point a scheduler (Vercel Cron, GitHub Actions, etc.) at this daily.
 */
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  const url = new URL(req.url);
  const provided =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    url.searchParams.get("secret") ??
    "";

  if (!secret || !provided || !safeEqual(provided, secret)) {
    // Log it. A rotated CRON_SECRET otherwise fails in total silence: this
    // returns before anything is recorded, so the job just looks like it never
    // ran while every recurring gift quietly stops being collected.
    logUnauthorizedCron("billing", clientIp());
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

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
