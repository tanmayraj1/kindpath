import { drainPendingCampaigns } from "@/lib/campaign-queue";
import { captureError, log } from "@/lib/observability";
import { startJobRun, finishJobRun } from "@/lib/job-runs";
import { requireCronAuth } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/**
 * Both crons do real work per row — a gateway charge and an email each — so the
 * platform default (10s) kills them partway, leaving the heartbeat row stuck at
 * "running". The work itself is bounded to stay comfortably inside this.
 */
export const maxDuration = 60;

/**
 * Drain queued bulk email sends.
 *
 * Separate from the billing cron on purpose: a mail-provider outage must not
 * stop recurring gifts from being collected, and a billing fault must not strand
 * a half-sent campaign. Each pass resumes from the campaign's keyset cursor, so
 * running this more often only makes delivery faster — it never re-mails anyone.
 */
async function handle(req: Request) {
  const denied = requireCronAuth(req, "campaigns");
  if (denied) return denied;

  const runId = await startJobRun("campaigns");
  try {
    const result = await drainPendingCampaigns();
    await finishJobRun(runId, { ok: true, summary: result });
    log("info", "campaign cron complete", result);
    return Response.json({ ok: true, ...result });
  } catch (e) {
    captureError(e, { source: "cron.campaigns" });
    await finishJobRun(runId, { ok: false, error: (e as Error).message });
    return Response.json({ ok: false, error: "campaign drain failed" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
