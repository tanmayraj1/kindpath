import crypto from "node:crypto";
import { runBilling } from "@/lib/billing";
import { captureError, log } from "@/lib/observability";

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
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const summary = await runBilling();
    log("info", "billing run complete", { ...summary });
    return Response.json({ ok: true, summary });
  } catch (e) {
    // A crashed run means missed charges — this must be visible, not a silent 500.
    captureError(e, { source: "cron.billing" });
    return Response.json({ ok: false, error: "billing run failed" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
