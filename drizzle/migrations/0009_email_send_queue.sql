-- ---------------------------------------------------------------------------
-- Email send queue + worker support
-- ---------------------------------------------------------------------------
-- Background-worker model for mass send. The send action only flips a draft
-- to `queued`; a pg_cron-driven worker drains BATCH_SIZE recipients per tick,
-- bounded by a per-sender daily cap (see lib/partnerships/email-quota.ts).
--
-- Status flow on email_campaigns:
--   draft   -> author hasn't sent yet
--   queued  -> author hit "Send", worker hasn't picked it up
--   sending -> worker is mid-drain; some sends complete, some still queued
--   sent    -> all sends complete, no failures
--   partial -> all sends complete, at least one failed
--   failed  -> terminal failure before any sends went out (e.g. consent revoked)
--
-- Status flow on email_sends is unchanged (queued/sent/skipped/failed); the
-- worker just walks them in chunks instead of in one request.
--
-- Both timestamp columns are nullable: queued_at marks when the user enqueued
-- the send, last_attempted_at marks the last worker tick. Both inform the UI
-- and any "stuck for >X minutes" diagnostics later.

ALTER TABLE email_campaigns
  ADD COLUMN IF NOT EXISTS queued_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_attempted_at timestamptz,
  -- When the sender wants the worker to start sending. NULL = send as soon as
  -- the worker picks up the queue (status = 'queued'). When set in the future,
  -- the worker skips this campaign until now() >= scheduled_at.
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;

-- The status column is plain text (no DB-level CHECK) to match the existing
-- pattern in 0003_partnerships_crm_foundation.sql. The Drizzle enum at
-- lib/db/schema.ts is the source of truth for valid values.

-- Worker pickup: find oldest queued recipients on each tick. Status-first
-- composite index keeps the "WHERE status = 'queued' ORDER BY created_at" scan
-- on a small slice of the table even after thousands of sends accumulate.
CREATE INDEX IF NOT EXISTS email_sends_status_created_idx
  ON email_sends (status, created_at);

-- Daily quota counter: count today's sent rows for a given sender via the
-- campaign join. The (status, sent_at) prefix narrows the join input quickly.
CREATE INDEX IF NOT EXISTS email_sends_status_sent_at_idx
  ON email_sends (status, sent_at);
