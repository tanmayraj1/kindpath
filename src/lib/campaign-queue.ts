import { adminDb } from "@/lib/db";
import { withTenant } from "@/lib/tenant";
import { flushEmails, type QueuedEmail } from "@/lib/notifications";
import { emailLayout, escapeHtml } from "@/lib/email";
import { captureError, log } from "@/lib/observability";
import { loadSegmentRecipients, type SegmentKey } from "@/lib/segments";

/**
 * Draining a bulk email send.
 *
 * Bulk sending used to run inline in the server action: a serial loop of one
 * HTTPS call plus one UPDATE per recipient, hard-capped at 200 with no cursor.
 * Two consequences — the request held open for the length of the send, and an
 * organization past 200 consented donors could never complete one at all.
 *
 * Now the action records an EmailCampaign row and drains only the first batch, so
 * a small organization still sees delivery immediately. Anything left is picked
 * up by the campaign cron, resuming from the keyset cursor rather than the start.
 */

/** Recipients per drain pass. Bounded so one pass stays well inside a request. */
export const CAMPAIGN_BATCH_SIZE = 50;

/** Safety valve: stop a runaway campaign rather than mail forever. */
const MAX_RECIPIENTS = 50_000;

type Branding = { orgName: string; brandColor: string | null; logoUrl: string | null };

function renderCampaignEmail(subject: string, message: string, brand: Branding): string {
  const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/portal/profile`;
  return emailLayout({
    heading: escapeHtml(subject),
    body:
      `${escapeHtml(message).replace(/\n/g, "<br/>")}` +
      `<hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0"/>` +
      `<p style="font-size:12px;color:#94a3b8">You're receiving this from ${escapeHtml(brand.orgName)} ` +
      `because you opted in to updates. <a href="${portalUrl}">Manage your preferences</a> to unsubscribe.</p>`,
    brand,
  });
}

/**
 * Send the next batch of one campaign. Returns whether more work remains.
 *
 * Every step commits its own progress: the notification rows for a batch are
 * written and the cursor advanced before the next batch is read, so a process
 * killed mid-campaign resumes after the last donor it actually reached instead
 * of mailing the earlier ones a second time.
 */
export async function drainCampaignBatch(campaignId: string): Promise<{ done: boolean; sent: number }> {
  const campaign = await adminDb.emailCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign || campaign.status === "sent" || campaign.status === "failed") {
    return { done: true, sent: 0 };
  }

  if (campaign.status === "queued") {
    await adminDb.emailCampaign.update({
      where: { id: campaignId },
      data: { status: "sending", startedAt: campaign.startedAt ?? new Date() },
    });
  }

  const orgId = campaign.orgId;

  try {
    const prepared = await withTenant(orgId, async (tx) => {
      const org = await tx.organization.findUnique({ where: { id: orgId } });
      const recipients = await loadSegmentRecipients(tx, campaign.segment as SegmentKey, {
        take: CAMPAIGN_BATCH_SIZE,
        afterId: campaign.cursorDonorId,
      });
      if (recipients.length === 0) return null;

      const brand: Branding = {
        orgName: org?.name ?? "your organization",
        brandColor: org?.primaryColor ?? null,
        logoUrl: org?.logoUrl ?? null,
      };
      const html = renderCampaignEmail(campaign.subject, campaign.body, brand);

      // Queue every recipient in one write, then read the rows back correlated to
      // THIS campaign. Matching on `status: queued` alone would sweep up rows left
      // behind by any other interrupted send.
      await tx.notification.createMany({
        data: recipients.map((r) => ({
          orgId,
          donorId: r.id,
          channel: "email" as const,
          category: "marketing",
          status: "queued" as const,
          caslChecked: true,
          payload: { subject: campaign.subject, segment: campaign.segment, campaignId },
        })),
      });
      const rows = await tx.notification.findMany({
        where: {
          orgId,
          category: "marketing",
          status: "queued",
          payload: { path: ["campaignId"], equals: campaignId },
          donorId: { in: recipients.map((r) => r.id) },
        },
        select: { id: true, donorId: true },
      });

      const byDonor = new Map(rows.filter((r) => r.donorId).map((r) => [r.donorId as string, r.id]));
      const messages: QueuedEmail[] = recipients
        .filter((r) => byDonor.has(r.id))
        .map((r) => ({
          notificationId: byDonor.get(r.id) as string,
          orgId,
          to: r.email,
          subject: campaign.subject,
          html,
        }));

      return { messages, lastId: recipients[recipients.length - 1].id, count: recipients.length };
    });

    if (!prepared) {
      await adminDb.emailCampaign.update({
        where: { id: campaignId },
        data: { status: "sent", finishedAt: new Date() },
      });
      return { done: true, sent: 0 };
    }

    await flushEmails(prepared.messages);

    const sent = await adminDb.notification.count({
      where: { id: { in: prepared.messages.map((m) => m.notificationId) }, status: "sent" },
    });

    const updated = await adminDb.emailCampaign.update({
      where: { id: campaignId },
      data: {
        cursorDonorId: prepared.lastId,
        sentCount: { increment: sent },
        failedCount: { increment: prepared.messages.length - sent },
      },
    });

    // A partial batch means the segment is exhausted. The cap is a backstop so a
    // pathological segment can't mail indefinitely.
    const exhausted = prepared.count < CAMPAIGN_BATCH_SIZE;
    const overCap = updated.sentCount + updated.failedCount >= MAX_RECIPIENTS;
    if (exhausted || overCap) {
      await adminDb.emailCampaign.update({
        where: { id: campaignId },
        data: {
          status: "sent",
          finishedAt: new Date(),
          error: overCap && !exhausted ? `Stopped at the ${MAX_RECIPIENTS} recipient safety cap.` : null,
        },
      });
      return { done: true, sent };
    }

    return { done: false, sent };
  } catch (e) {
    // Leave the cursor where it is: the campaign resumes from the last donor it
    // actually reached, so a retry never re-mails anyone.
    captureError(e, { source: "campaign-queue.drain", campaignId, orgId });
    await adminDb.emailCampaign.update({
      where: { id: campaignId },
      data: { status: "failed", finishedAt: new Date(), error: (e as Error).message.slice(0, 500) },
    });
    return { done: true, sent: 0 };
  }
}

/**
 * Drain pending campaigns across every organization. Called by the cron.
 *
 * `maxBatches` bounds one cron invocation so a large backlog is spread over
 * several runs instead of exceeding the platform's function timeout.
 */
export async function drainPendingCampaigns(maxBatches = 20): Promise<{
  campaigns: number;
  batches: number;
  sent: number;
}> {
  const pending = await adminDb.emailCampaign.findMany({
    where: { status: { in: ["queued", "sending"] } },
    orderBy: { createdAt: "asc" },
    select: { id: true },
    take: 25,
  });

  let batches = 0;
  let sent = 0;
  for (const c of pending) {
    let done = false;
    while (!done && batches < maxBatches) {
      const r = await drainCampaignBatch(c.id);
      sent += r.sent;
      done = r.done;
      batches += 1;
    }
    if (batches >= maxBatches) break;
  }

  log("info", "campaign queue drained", { campaigns: pending.length, batches, sent });
  return { campaigns: pending.length, batches, sent };
}
