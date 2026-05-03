ALTER TABLE partners_events
  ADD COLUMN IF NOT EXISTS event_status text NOT NULL DEFAULT 'asked';

ALTER TABLE company_events
  ADD COLUMN IF NOT EXISTS event_status text NOT NULL DEFAULT 'asked';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'partners_events_event_status_check'
  ) THEN
    ALTER TABLE partners_events
      ADD CONSTRAINT partners_events_event_status_check
      CHECK (event_status IN ('asked', 'interested', 'form_sent', 'form_submitted', 'confirmed', 'declined', 'attended'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'company_events_event_status_check'
  ) THEN
    ALTER TABLE company_events
      ADD CONSTRAINT company_events_event_status_check
      CHECK (event_status IN ('asked', 'interested', 'form_sent', 'form_submitted', 'confirmed', 'declined', 'attended'));
  END IF;
END $$;
