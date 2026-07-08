import { captureError } from "@/lib/observability";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Intake for client-side error boundaries (error.tsx / global-error.tsx).
 * Accepts a tiny JSON payload and forwards it through captureError.
 * Deliberately dumb: no auth (errors happen logged-out too), tightly
 * rate-limited, hard caps on field sizes, and it never echoes input back.
 */
export async function POST(req: Request) {
  if (!(await rateLimit(`monitor:${clientIp()}`, 10, 60_000)).ok) {
    return new Response(null, { status: 429 });
  }
  let body: { message?: string; digest?: string; url?: string } = {};
  try {
    body = await req.json();
  } catch {
    return new Response(null, { status: 400 });
  }
  captureError(new Error(String(body.message ?? "client error").slice(0, 500)), {
    source: "client-boundary",
    digest: String(body.digest ?? "").slice(0, 100),
    url: String(body.url ?? "").slice(0, 300),
  });
  return new Response(null, { status: 204 });
}
