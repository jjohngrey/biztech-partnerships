-- Pipeline conversations can start before a specific event is known.
-- Keep the sponsor/conversation record and clear the event link if an event is removed.
ALTER TABLE sponsors DROP CONSTRAINT IF EXISTS sponsors_event_id_events_id_fk;
ALTER TABLE sponsors ALTER COLUMN event_id DROP NOT NULL;
ALTER TABLE sponsors
  ADD CONSTRAINT sponsors_event_id_events_id_fk
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE set null;
