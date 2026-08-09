/**
 * Lightweight observability seam — no SDK dependency.
 *
 * - log(level, msg, fields): one-line structured JSON to stdout/stderr, which
 *   Vercel log drains and `vercel logs` pick up cleanly.
 * - captureError(err, ctx): when SENTRY_DSN is set, posts a minimal event to
 *   Sentry's store API over plain HTTP (fire-and-forget); always also logs
 *   locally so nothing is silently swallowed when the DSN is absent.
 *
 * Swap in the full @sentry/nextjs SDK later without touching call sites —
 * only this module changes.
 */

type Level = "info" | "warn" | "error";

export function log(level: Level, message: string, fields: Record<string, unknown> = {}): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    message,
    ...fields,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

type Dsn = { publicKey: string; host: string; projectId: string };

let warnedAboutDsn = false;

/**
 * Parse a Sentry DSN. Returns null when absent (fine — reporting is optional) or
 * malformed (NOT fine). A typo'd DSN used to silently disable error reporting
 * forever, and looked exactly like having none configured; now it says so once.
 */
export function parseDsn(dsn: string | undefined | null): Dsn | null {
  if (!dsn) return null;
  const complain = (reason: string) => {
    if (!warnedAboutDsn) {
      warnedAboutDsn = true;
      console.warn(
        `⚠️  SENTRY_DSN is set but unusable (${reason}) — error reporting is DISABLED.`
      );
    }
    return null;
  };
  try {
    const u = new URL(dsn);
    const projectId = u.pathname.replace(/\//g, "");
    if (!u.username) return complain("no public key");
    if (!u.host) return complain("no host");
    if (!projectId) return complain("no project id");
    return { publicKey: u.username, host: u.host, projectId };
  } catch {
    return complain("not a valid URL");
  }
}

/** Build the Sentry store-API event body (exported for tests). */
export function buildSentryEvent(
  err: unknown,
  ctx: Record<string, unknown> = {}
): Record<string, unknown> {
  const e = err instanceof Error ? err : new Error(String(err));
  return {
    event_id: crypto.randomUUID().replace(/-/g, ""),
    timestamp: new Date().toISOString(),
    platform: "node",
    level: "error",
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    release: process.env.VERCEL_GIT_COMMIT_SHA ?? undefined,
    exception: {
      values: [
        {
          type: e.name,
          value: e.message,
          stacktrace: e.stack
            ? { frames: e.stack.split("\n").slice(1, 12).map((line) => ({ function: line.trim() })) }
            : undefined,
        },
      ],
    },
    extra: ctx,
  };
}

/**
 * Report an error. Never throws; never blocks the caller beyond initiating
 * the request (fire-and-forget).
 */
export function captureError(err: unknown, ctx: Record<string, unknown> = {}): void {
  const e = err instanceof Error ? err : new Error(String(err));
  log("error", e.message, { name: e.name, stack: e.stack?.split("\n").slice(0, 4).join(" | "), ...ctx });

  const dsn = parseDsn(process.env.SENTRY_DSN);
  if (!dsn) return;

  const url = `https://${dsn.host}/api/${dsn.projectId}/store/`;
  void fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${dsn.publicKey}, sentry_client=kindpath/1.0`,
    },
    body: JSON.stringify(buildSentryEvent(err, ctx)),
  }).catch(() => {
    // Monitoring must never take the app down with it.
  });
}
