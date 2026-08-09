import { adminDb } from "@/lib/db";
import { getPaymentProvider } from "@/lib/payments";
import { handlePaymentEvent } from "@/lib/payment-events";
import { captureError, log } from "@/lib/observability";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Body cap. A webhook payload is small; anything larger is not a webhook. */
const MAX_BODY_BYTES = 64 * 1024;

/**
 * Inbound payment-provider (POS) webhooks. The provider adapter verifies the
 * signature and normalizes the payload; we de-dupe via webhook_events and apply
 * the event (e.g. refund → void receipt). Returns 200 quickly so the provider
 * doesn't retry on success.
 *
 * This endpoint is unauthenticated by nature — the signature IS the auth — and
 * it can void a tax receipt, so it is rate limited and every rejection is
 * distinguished rather than collapsed into one generic error.
 */
export async function POST(req: Request) {
  if (!(await rateLimit(`webhook-pos:${clientIp()}`, 60, 60_000)).ok) {
    return Response.json({ error: "too many requests" }, { status: 429 });
  }

  const body = await req.text();
  if (body.length > MAX_BODY_BYTES) {
    return Response.json({ error: "payload too large" }, { status: 413 });
  }

  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => (headers[k] = v));

  const provider = getPaymentProvider();
  let event;
  try {
    event = await provider.verifyWebhook({ headers, body });
  } catch (e) {
    const message = e instanceof Error ? e.message : "verification failed";

    // Some providers have no webhook channel at all (WeVend reconciles via the
    // return URL + confirmTransaction). That is a configuration fact, not a
    // caller error — reporting it as "invalid signature" sent whoever was
    // debugging it hunting for a signing secret that does not exist.
    if (/does not send webhooks/i.test(message)) {
      captureError(e, { source: "webhook.pos", reason: "provider_has_no_webhooks", provider: provider.name });
      return Response.json({ error: "this provider does not send webhooks" }, { status: 501 });
    }

    // A genuine signature failure is expected traffic on a public endpoint —
    // log it, don't page anyone.
    log("warn", "webhook signature rejected", {
      source: "webhook.pos",
      provider: provider.name,
      reason: message,
      ip: clientIp(),
    });
    return Response.json({ error: "invalid signature" }, { status: 400 });
  }

  // idempotency — skip if we've already processed this provider event id
  const existing = await adminDb.webhookEvent.findUnique({
    where: { providerEventId: event.id },
  });
  if (existing?.status === "processed") {
    return Response.json({ ok: true, deduped: true });
  }

  await adminDb.webhookEvent.upsert({
    where: { providerEventId: event.id },
    create: { providerEventId: event.id, type: event.type, payload: event.raw as object, status: "received" },
    update: { type: event.type, payload: event.raw as object, status: "received" },
  });

  try {
    await handlePaymentEvent(event);
    await adminDb.webhookEvent.update({
      where: { providerEventId: event.id },
      data: { status: "processed", processedAt: new Date() },
    });
  } catch (e) {
    captureError(e, { source: "webhook.pos", eventId: event.id, eventType: event.type });
    await adminDb.webhookEvent.update({
      where: { providerEventId: event.id },
      data: { status: "failed" },
    });
    return Response.json({ error: "processing failed" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
