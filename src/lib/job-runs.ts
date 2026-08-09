import { adminDb } from "@/lib/db";
import { captureError, log } from "@/lib/observability";

/**
 * Heartbeat ledger for scheduled jobs.
 *
 * The failure this exists to catch is silence. A cron that stops firing — Vercel
 * Cron disabled, `CRON_SECRET` rotated on one side only, the project renamed —
 * looks exactly like a cron with nothing to do. Meanwhile every donor's recurring
 * gift quietly stops being collected. Recording each run means "when did billing
 * last succeed?" has an answer, and `/api/health` can go red on its own.
 */

/** A run older than this with no success means something is wrong. */
export const STALE_AFTER_HOURS = 36; // daily job + a generous margin

export type JobName = "billing";

export async function startJobRun(job: JobName): Promise<string | null> {
  try {
    const run = await adminDb.jobRun.create({ data: { job, status: "running" } });
    return run.id;
  } catch (e) {
    // Bookkeeping must never stop the job it is recording.
    captureError(e, { source: "job-runs.start", job });
    return null;
  }
}

export async function finishJobRun(
  id: string | null,
  outcome: { ok: boolean; summary?: unknown; error?: string }
): Promise<void> {
  if (!id) return;
  try {
    const run = await adminDb.jobRun.findUnique({ where: { id }, select: { startedAt: true } });
    const finishedAt = new Date();
    await adminDb.jobRun.update({
      where: { id },
      data: {
        status: outcome.ok ? "ok" : "failed",
        finishedAt,
        durationMs: run ? finishedAt.getTime() - run.startedAt.getTime() : null,
        summary: (outcome.summary ?? undefined) as object | undefined,
        error: outcome.error?.slice(0, 500),
      },
    });
  } catch (e) {
    captureError(e, { source: "job-runs.finish", id });
  }
}

export type JobHealth = {
  job: string;
  lastSuccessAt: Date | null;
  lastRunAt: Date | null;
  lastStatus: string | null;
  hoursSinceSuccess: number | null;
  stale: boolean;
};

/**
 * Health of one job. `stale` is true when there has been no successful run inside
 * the window — including when there has *never* been one, which is the state a
 * brand-new deployment with a misconfigured cron sits in.
 */
export async function getJobHealth(job: JobName): Promise<JobHealth> {
  const [lastSuccess, lastRun] = await Promise.all([
    adminDb.jobRun.findFirst({
      where: { job, status: "ok" },
      orderBy: { startedAt: "desc" },
      select: { startedAt: true },
    }),
    adminDb.jobRun.findFirst({
      where: { job },
      orderBy: { startedAt: "desc" },
      select: { startedAt: true, status: true },
    }),
  ]);

  const hoursSinceSuccess = lastSuccess
    ? (Date.now() - lastSuccess.startedAt.getTime()) / 3_600_000
    : null;

  return {
    job,
    lastSuccessAt: lastSuccess?.startedAt ?? null,
    lastRunAt: lastRun?.startedAt ?? null,
    lastStatus: lastRun?.status ?? null,
    hoursSinceSuccess,
    stale: hoursSinceSuccess === null || hoursSinceSuccess > STALE_AFTER_HOURS,
  };
}

/** Recent runs for the God Mode panel. */
export async function listJobRuns(job: JobName, take = 20) {
  return adminDb.jobRun.findMany({ where: { job }, orderBy: { startedAt: "desc" }, take });
}

/**
 * Record an unauthorized cron attempt. A rotated CRON_SECRET otherwise fails
 * completely silently — the 401 returns before anything is logged, so the job
 * looks like it simply never ran.
 */
export function logUnauthorizedCron(job: JobName, ip: string): void {
  log("warn", "cron request rejected — check CRON_SECRET", { source: "cron.auth", job, ip });
}
