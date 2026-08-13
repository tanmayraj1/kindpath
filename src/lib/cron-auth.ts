import crypto from "node:crypto";
import { logUnauthorizedCron, type JobName } from "@/lib/job-runs";
import { clientIp } from "@/lib/rate-limit";

/** Constant-time secret comparison to avoid timing attacks. */
function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Shared CRON_SECRET check for every scheduled endpoint.
 *
 * Returns a 401 Response when the caller isn't the scheduler, and null when it
 * is. The rejection is logged rather than silent: a rotated or missing
 * CRON_SECRET otherwise looks exactly like a job that simply never ran, which is
 * how recurring gifts could quietly stop being collected with no signal anywhere.
 */
export function requireCronAuth(req: Request, job: JobName): Response | null {
  const secret = process.env.CRON_SECRET;
  const url = new URL(req.url);
  const provided =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    url.searchParams.get("secret") ??
    "";

  if (!secret || !provided || !safeEqual(provided, secret)) {
    logUnauthorizedCron(job, clientIp());
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
