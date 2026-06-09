-- ---------------------------------------------------------------------------
-- Standardize contact_activities.subject for touchpoints
-- ---------------------------------------------------------------------------
-- Touchpoints (non-meeting-log contact_activities rows) get a fixed pipeline
-- stage enum stored in `subject`. Meeting logs continue to use free-text
-- titles in the same column, so the enum is enforced only at the application
-- layer (validateTouchpointSubject in lib/partnerships/repository.ts), not via
-- a DB CHECK constraint.
--
-- This migration is a best-effort backfill of existing touchpoint rows.
-- Unmapped values default to 'initial_outreach', and the original value is
-- preserved at the top of `notes` so it can be reclassified manually.

-- Meeting logs are identified by the same predicate the app uses:
--   type = 'meeting' AND (content IS NOT NULL OR legacy_meeting_note_id IS NOT NULL)
-- Everything else is treated as a touchpoint here.

-- Phase A — preserve original subject in notes for rows that won't map cleanly.
UPDATE contact_activities
SET notes = CASE
    WHEN notes IS NULL OR notes = '' THEN 'Original subject: ' || subject
    ELSE 'Original subject: ' || subject || E'\n\n' || notes
  END
WHERE NOT (type = 'meeting' AND (content IS NOT NULL OR legacy_meeting_note_id IS NOT NULL))
  AND subject NOT IN (
    'initial_interest', 'deferred', 'ghosted',
    'discovery_call_scheduled', 'discovery_call_completed', 'follow_up',
    'closed_success', 'closed_reject'
  )
  AND NOT (
    subject ILIKE 'discovery call%'
    OR subject ILIKE 'initial reply%'
    OR subject ILIKE 'initial interest%'
    OR subject ILIKE 'initial outreach%'
    OR subject ILIKE 'first outreach%'
    OR subject ILIKE 'cold%'
    OR subject ILIKE 'follow%up%'
    OR subject ILIKE 'followed up%'
    OR subject ILIKE 'closed%won%'
    OR subject ILIKE 'closed%success%'
    OR subject = 'won'
    OR subject ILIKE 'closed%lost%'
    OR subject ILIKE 'closed%reject%'
    OR subject = 'lost'
    OR subject ILIKE 'deferred%'
    OR subject ILIKE '%not now%'
    OR subject ILIKE 'ghost%'
    OR subject ILIKE 'no response%'
  );

-- Phase B — map subjects to the new enum values.
-- Note: any "initial outreach" / "first outreach" / "cold" values collapse
-- into initial_interest, which is the new first-stage default.
UPDATE contact_activities
SET subject = CASE
    WHEN subject ILIKE '%discovery call%schedul%' THEN 'discovery_call_scheduled'
    WHEN subject ILIKE '%discovery call%' THEN 'discovery_call_completed'
    WHEN subject ILIKE 'follow%up%' OR subject ILIKE 'followed up%' THEN 'follow_up'
    WHEN subject ILIKE 'closed%won%' OR subject ILIKE 'closed%success%' OR subject = 'won' THEN 'closed_success'
    WHEN subject ILIKE 'closed%lost%' OR subject ILIKE 'closed%reject%' OR subject = 'lost' THEN 'closed_reject'
    WHEN subject ILIKE 'deferred%' OR subject ILIKE '%not now%' THEN 'deferred'
    WHEN subject ILIKE 'ghost%' OR subject ILIKE 'no response%' THEN 'ghosted'
    ELSE 'initial_interest'
  END
WHERE NOT (type = 'meeting' AND (content IS NOT NULL OR legacy_meeting_note_id IS NOT NULL))
  AND subject NOT IN (
    'initial_interest', 'deferred', 'ghosted',
    'discovery_call_scheduled', 'discovery_call_completed', 'follow_up',
    'closed_success', 'closed_reject'
  );
