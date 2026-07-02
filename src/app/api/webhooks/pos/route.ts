import { adminDb } from "@/lib/db";
import { getPaymentProvider } from "@/lib/payments";
import { handlePaymentEvent } from "@/lib/payment-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Inbound payment-provider (POS) webhooks. The provider adapter verifies the
 * signature and normalizes the payload; we de-dupe via webhook_events and apply
 * the event (e.g. refund → void receipt). Returns 200 quickly so the provider
 * doesn't retry on success.
 */
export async function POST(req: Request) {
  const body = await req.text();
  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => (headers[k] = v));

  const provider = getPaymentProvider();
  let event;
  try {
    event = await provider.verifyWebhook({ headers, body });
  } catch {
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
  } catch {
    await adminDb.webhookEvent.update({
      where: { providerEventId: event.id },
      data: { status: "failed" },
    });
    return Response.json({ error: "processing failed" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
