import crypto from "node:crypto";
import { runBilling } from "@/lib/billing";

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

  const summary = await runBilling();
  return Response.json({ ok: true, summary });
}

export const GET = handle;
export const POST = handle;
