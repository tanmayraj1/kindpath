import { headers } from "next/headers";
import { log } from "./observability";

/**
 * Rate limiter with two backends:
 *   - Upstash Redis (distributed) when UPSTASH_REDIS_REST_URL + _TOKEN are set —
 *     correct for serverless/multi-instance (e.g. Vercel).
 *   - In-memory sliding window fallback otherwise (fine for a single instance / dev).
 *
 * Fixed-window counter on Redis (INCR + EXPIRE NX). Fail-OPEN on Redis errors so a
 * limiter outage never locks out real users.
 */
const buckets = new Map<string, number[]>();

function memoryLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;
  const hits = (buckets.get(key) ?? []).filter((t) => t > cutoff);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  return true;
}

async function redisLimit(
  url: string,
  token: string,
  key: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  const windowSec = Math.ceil(windowMs / 1000);
  const k = `rl:${key}`;
  try {
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify([
        ["INCR", k],
        ["EXPIRE", k, windowSec, "NX"],
      ]),
      cache: "no-store",
    });
    if (!res.ok) {
      // Fail OPEN so a limiter outage never locks out real users — but say so.
      // Silence here meant a revoked token or an Upstash outage turned EVERY
      // rate limit in the app (login, password reset, donation charge) into a
      // no-op with zero signal that anything had changed.
      log("warn", "rate limiter unavailable — failing open", {
        source: "rate-limit",
        status: res.status,
      });
      return true;
    }
    const data = (await res.json()) as Array<{ result: number }>;
    const count = data?.[0]?.result ?? 0;
    return count <= limit;
  } catch (e) {
    log("warn", "rate limiter unreachable — failing open", {
      source: "rate-limit",
      error: e instanceof Error ? e.message : String(e),
    });
    return true;
  }
}

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<{ ok: boolean }> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    return { ok: await redisLimit(url, token, key, limit, windowMs) };
  }
  return { ok: memoryLimit(key, limit, windowMs) };
}

/** Best-effort client IP from proxy headers (server actions / route handlers). */
export function clientIp(): string {
  const h = headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}
