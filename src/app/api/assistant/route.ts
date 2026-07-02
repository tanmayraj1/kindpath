import { getSession } from "@/lib/auth/session";
import { withTenant } from "@/lib/tenant";
import { getOrgAccess } from "@/lib/access";
import { runAssistant, type ChatMessage } from "@/lib/assistant/run";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.kind !== "org" || !session.orgId) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  // feature gate
  const access = await getOrgAccess(session.orgId);
  if (!access.active || !access.features.assistant) {
    return Response.json({ error: "assistant not enabled" }, { status: 403 });
  }
  if (!(await rateLimit(`assistant:${clientIp()}`, 20, 60_000)).ok) {
    return Response.json({ error: "Too many messages. Please wait a moment." }, { status: 429 });
  }

  let body: { messages?: ChatMessage[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  const messages = (body.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-12) // keep recent context bounded
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));

  if (!messages.length) return Response.json({ error: "no messages" }, { status: 400 });

  const org = await withTenant(session.orgId, (tx) =>
    tx.organization.findUnique({ where: { id: session.orgId }, select: { name: true } })
  );

  const result = await runAssistant(session.orgId, org?.name ?? "your organization", messages);
  return Response.json(result);
}
