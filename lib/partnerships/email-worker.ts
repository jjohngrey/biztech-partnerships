/**
 * Background worker that drains the email send queue one chunk at a time.
 *
 * Lifecycle:
 *   1. The compose UI calls enqueueEmailCampaignAction → flips the campaign to
 *      `queued` (optionally with a future scheduled_at).
 *   2. A pg_cron job (or Vercel Cron, or a manual smoke-test) hits
 *      POST /api/partnerships/email/send/process every minute.
 *   3. That route calls processNextBatch(), which:
 *        - picks the oldest queued/sending campaign whose schedule is due
 *        - resolves the sender's stored Google OAuth tokens (no live session)
 *        - sends up to BATCH_SIZE recipients, sleeping between each call
 *        - respects DAILY_PER_SENDER_CAP and stops early if exhausted
 *        - logs each successful send as a contact_activities row
 *        - flips the campaign to `sent` / `partial` once no queued sends remain
 *
 * The serial-with-sleep send loop is intentional. Gmail's per-user quota
 * dimension is "messages per second", and a brand-new sender that bursts
 * dozens of near-identical messages back-to-back trips spam heuristics well
 * before it hits the published per-day cap. INTER_MESSAGE_DELAY_MS keeps the
 * burst rate gentle.
 *
 * Concurrency: pg_cron is a single scheduler, so two ticks never overlap. The
 * route handler also short-circuits if no queued campaign is ready, so retries
 * are cheap. We don't take a row lock here — if you ever start running the
 * worker from multiple processes, add SELECT … FOR UPDATE SKIP LOCKED on the
 * pickup query.
 */

import { and, asc, eq, inArray, isNull, lte, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { emailCampaigns, emailSends } from "@/lib/db/schema";
import { getAuthedClient } from "@/lib/google/client";
import {
  buildMergeValues,
  listEmailRecipients,
  listEvents,
  listUsers,
  logEmailInteraction,
  renderMergeTemplate,
  updateEmailCampaignStatus,
  updateEmailSendResult,
} from "./repository";
import {
  BATCH_SIZE,
  INTER_MESSAGE_DELAY_MS,
  getRemainingDailyQuota,
  sleep,
} from "./email-quota";

function encodeRawEmail(input: { to: string; subject: string; body: string }) {
  const message = [
    `To: ${input.to}`,
    `Subject: ${input.subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    input.body,
  ].join("\r\n");
  return Buffer.from(message).toString("base64url");
}

export type ProcessBatchResult =
  | { kind: "idle"; reason: "no-campaign" | "scheduled-for-later" | "no-recipients" }
  | {
      kind: "blocked";
      reason: "no-sender" | "needs-consent" | "quota-exhausted";
      campaignId: string;
      message: string;
    }
  | {
      kind: "processed";
      campaignId: string;
      attempted: number;
      sent: number;
      failed: number;
      skipped: number;
      remainingForCampaign: number;
      campaignStatus: "sending" | "sent" | "partial";
    };

type DueCampaignRow = typeof emailCampaigns.$inferSelect;

/**
 * Pick the oldest queued/sending campaign whose schedule is due (NULL or in
 * the past). Ties broken by queued_at then created_at so re-queues run in
 * insertion order.
 */
async function pickDueCampaign(now: Date): Promise<DueCampaignRow | null> {
  const [row] = await db
    .select()
    .from(emailCampaigns)
    .where(
      and(
        inArray(emailCampaigns.status, ["queued", "sending"]),
        or(isNull(emailCampaigns.scheduledAt), lte(emailCampaigns.scheduledAt, now)),
      ),
    )
    .orderBy(asc(emailCampaigns.queuedAt), asc(emailCampaigns.createdAt))
    .limit(1);
  return row ?? null;
}

export async function processNextBatch(now: Date = new Date()): Promise<ProcessBatchResult> {
  const campaign = await pickDueCampaign(now);
  if (!campaign) return { kind: "idle", reason: "no-campaign" };

  if (!campaign.senderUserId) {
    await updateEmailCampaignStatus(campaign.id, "failed", { lastAttemptedAt: now });
    return {
      kind: "blocked",
      reason: "no-sender",
      campaignId: campaign.id,
      message: "Campaign has no sender; cannot deliver.",
    };
  }

  // Re-check schedule under "now" — defensive against the picked row sitting in
  // memory across a long worker run.
  if (campaign.scheduledAt && campaign.scheduledAt > now) {
    return { kind: "idle", reason: "scheduled-for-later" };
  }

  // Per-sender daily quota. If exhausted we leave the campaign queued; the
  // next worker tick after the local-day rollover will retry.
  const remainingQuota = await getRemainingDailyQuota(campaign.senderUserId, now);
  if (remainingQuota <= 0) {
    await db
      .update(emailCampaigns)
      .set({ lastAttemptedAt: now })
      .where(eq(emailCampaigns.id, campaign.id));
    return {
      kind: "blocked",
      reason: "quota-exhausted",
      campaignId: campaign.id,
      message: "Sender hit the daily send cap. Queue resumes tomorrow.",
    };
  }

  const effectiveBatchSize = Math.min(BATCH_SIZE, remainingQuota);

  // Live Gmail client for the campaign's sender (no live session — we resolve
  // their stored OAuth tokens directly).
  const googleClient = await getAuthedClient(campaign.senderUserId, [
    "https://www.googleapis.com/auth/gmail.send",
  ]);
  if ("kind" in googleClient) {
    await updateEmailCampaignStatus(campaign.id, "failed", { lastAttemptedAt: now });
    return {
      kind: "blocked",
      reason: "needs-consent",
      campaignId: campaign.id,
      message: "Sender needs to re-grant Gmail send permission before this campaign can drain.",
    };
  }

  const queuedSends = await db
    .select()
    .from(emailSends)
    .where(and(eq(emailSends.campaignId, campaign.id), eq(emailSends.status, "queued")))
    .orderBy(asc(emailSends.createdAt))
    .limit(effectiveBatchSize);

  if (!queuedSends.length) {
    // No work left — flip terminal state based on whether anything failed.
    await flipTerminalStatus(campaign.id, now);
    return { kind: "idle", reason: "no-recipients" };
  }

  // Mark the campaign as in-flight before sending the first message so the
  // status pill in the UI updates promptly.
  await db
    .update(emailCampaigns)
    .set({ status: "sending", lastAttemptedAt: now })
    .where(eq(emailCampaigns.id, campaign.id));

  const [recipients, allUsers, allEvents] = await Promise.all([
    listEmailRecipients(),
    listUsers(),
    listEvents({ includeArchived: true }),
  ]);
  const recipientByPartnerId = new Map(recipients.map((recipient) => [recipient.id, recipient]));
  const senderSummary = allUsers.find((user) => user.id === campaign.senderUserId) ?? null;
  const eventSummary = campaign.eventId
    ? allEvents.find((event) => event.id === campaign.eventId) ?? null
    : null;

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const send of queuedSends) {
    const recipient = send.partnerId ? recipientByPartnerId.get(send.partnerId) : null;
    if (!recipient) {
      skipped += 1;
      await updateEmailSendResult({
        sendId: send.id,
        status: "skipped",
        error: "Recipient no longer has an email-ready partner record.",
      });
      continue;
    }

    const values = await buildMergeValues({
      recipient,
      sender: senderSummary,
      event: eventSummary,
    });
    const subject = renderMergeTemplate(campaign.subject, values);
    const body = renderMergeTemplate(campaign.body, values);

    try {
      const response = await googleClient.gmail.users.messages.send({
        userId: "me",
        requestBody: {
          raw: encodeRawEmail({ to: recipient.email, subject, body }),
        },
      });
      const externalMessageId = response.data.id ?? null;
      await updateEmailSendResult({
        sendId: send.id,
        status: "sent",
        externalMessageId,
      });
      if (send.companyId) {
        await logEmailInteraction({
          companyId: send.companyId,
          partnerId: send.partnerId,
          userId: campaign.senderUserId,
          subject,
          notes: `Mail merge outreach campaign ${campaign.id}`,
          externalMessageId,
        });
      }
      sent += 1;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Gmail send failed.";
      failed += 1;
      await updateEmailSendResult({
        sendId: send.id,
        status: "failed",
        error: message,
      });
    }

    await sleep(INTER_MESSAGE_DELAY_MS);
  }

  // Tally what's still queued for this campaign so the UI can show progress
  // and the worker knows whether to flip a terminal status.
  const remainingRows = await db
    .select({ id: emailSends.id })
    .from(emailSends)
    .where(and(eq(emailSends.campaignId, campaign.id), eq(emailSends.status, "queued")));
  const remaining = remainingRows.length;

  let nextStatus: "sending" | "sent" | "partial" = "sending";
  if (remaining === 0) {
    nextStatus = await flipTerminalStatus(campaign.id, now);
  }

  return {
    kind: "processed",
    campaignId: campaign.id,
    attempted: queuedSends.length,
    sent,
    failed,
    skipped,
    remainingForCampaign: remaining,
    campaignStatus: nextStatus,
  };
}

/**
 * Pick `sent` vs `partial` based on whether any send for this campaign failed.
 * Caller has already verified there are no queued sends left.
 */
async function flipTerminalStatus(campaignId: string, now: Date): Promise<"sent" | "partial"> {
  const failedRows = await db
    .select({ id: emailSends.id })
    .from(emailSends)
    .where(and(eq(emailSends.campaignId, campaignId), eq(emailSends.status, "failed")))
    .limit(1);
  const status: "sent" | "partial" = failedRows.length ? "partial" : "sent";
  await updateEmailCampaignStatus(campaignId, status, { lastAttemptedAt: now });
  return status;
}
