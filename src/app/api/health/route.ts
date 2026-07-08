import { adminDb } from "@/lib/db";
import { captureError } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Liveness + DB connectivity check for uptime monitors / load balancers. */
export async function GET() {
  const startedAt = Date.now();
  try {
    await adminDb.$queryRaw`SELECT 1`;
    return Response.json({
      ok: true,
      db: "up",
      dbLatencyMs: Date.now() - startedAt,
      release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
      env: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    });
  } catch (e) {
    captureError(e, { source: "health" });
    return Response.json({ ok: false, db: "down" }, { status: 503 });
  }
}
