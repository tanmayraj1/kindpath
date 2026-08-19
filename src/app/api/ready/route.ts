import { missingEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Configuration readiness probe.
 *
 * Deliberately imports NOTHING but `@/lib/env` — in particular not `@/lib/db`,
 * whose top-level `assertEnv()` is exactly what takes the rest of the app down.
 * A route that imported the database layer to report on the database layer would
 * 500 for the same reason as everything else, which is how a missing variable
 * turns into an afternoon of guessing.
 *
 * `/api/health` answers "is the database reachable"; this answers the question
 * that comes first — "is this instance configured well enough to boot at all".
 *
 * Reports variable NAMES only. See the note on `missingEnv()`.
 */
export function GET() {
  const missing = missingEnv();
  const base = {
    release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
    env: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
  };

  if (missing.length === 0) {
    return Response.json({ ready: true, ...base });
  }

  return Response.json(
    {
      ready: false,
      missing,
      hint: "Set these in the hosting platform's environment for this deployment, then redeploy. See docs/10_DEPLOYMENT.md.",
      ...base,
    },
    { status: 503 }
  );
}
