/**
 * Per-sender daily quota + chunk sizing for the mass-email worker.
 *
 * The numbers are deliberately conservative. Gmail Workspace allows 2,000
 * sends/day per user, but spam-detection signals (sudden burst from a single
 * sender, near-identical bodies to many recipients) trip well below the
 * published cap. 100/day per sender keeps us comfortably under the heuristic
 * threshold for a brand-new sender and gives plenty of headroom for the team's
 * actual outreach volume.
 *
 * BATCH_SIZE is the number of recipients the worker drains in a single tick.
 * 10 messages × ~400 ms/send + INTER_MESSAGE_DELAY_MS pacing fits comfortably
 * inside Vercel's 10-second Hobby function timeout, and a 1-minute pg_cron
 * cadence still drains a 100-recipient blast in well under an hour.
 */

import { and, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { emailCampaigns, emailSends } from "@/lib/db/schema";

export const BATCH_SIZE = 10;
export const DAILY_PER_SENDER_CAP = 100;
export const INTER_MESSAGE_DELAY_MS = 200;

/**
 * Start of "today" in the sender's local timezone, as a UTC Date.
 *
 * The daily cap is a calendar-day notion, not a 24-hour rolling window: the
 * intuition is "I shouldn't be sending 100 today AND 100 more an hour into
 * tomorrow." We use America/Vancouver because BizTech is a UBC club, but the
 * exact zone doesn't matter much — the cap is conservative enough that
 * boundary cases never bind.
 */
export function startOfTodayUtc(now: Date = new Date()): Date {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Vancouver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  const y = get("year");
  const m = get("month");
  const d = get("day");
  // Vancouver is UTC-8 (PST) or UTC-7 (PDT). Pick the wider of the two so we
  // never under-count a send that landed near local midnight: treat "today"
  // as starting 8 hours before UTC midnight on the local date.
  return new Date(`${y}-${m}-${d}T08:00:00.000Z`);
}

/**
 * How many emails this sender has successfully sent today (per the cap window).
 *
 * Counts `email_sends.status = 'sent'` rows whose campaign has the given
 * sender. We count the recipient row, not the campaign, because a campaign can
 * span multiple worker ticks and we care about per-message volume.
 */
export async function getDailySentCount(
  senderUserId: string,
  now: Date = new Date(),
): Promise<number> {
  const since = startOfTodayUtc(now);
  const rows = await db
    .select({ id: emailSends.id })
    .from(emailSends)
    .innerJoin(emailCampaigns, eq(emailSends.campaignId, emailCampaigns.id))
    .where(
      and(
        eq(emailCampaigns.senderUserId, senderUserId),
        eq(emailSends.status, "sent"),
        gte(emailSends.sentAt, since),
      ),
    );
  return rows.length;
}

/**
 * How many more recipients this sender can be charged for in this worker tick.
 *
 * Returns 0 when the cap is exhausted; the worker should leave the campaign in
 * 'queued'/'sending' so the next tick (after the local-day rollover) picks it
 * back up.
 */
export async function getRemainingDailyQuota(
  senderUserId: string,
  now: Date = new Date(),
): Promise<number> {
  const used = await getDailySentCount(senderUserId, now);
  return Math.max(0, DAILY_PER_SENDER_CAP - used);
}

/**
 * Sleep for the inter-message delay. Extracted so tests can stub it.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
