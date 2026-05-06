-- 1. Allow created_by to be NULL (fixes onDelete: "set null" conflict)
ALTER TABLE meeting_notes
  ALTER COLUMN created_by DROP NOT NULL;

-- 2. Rename source_url to original_filename
ALTER TABLE meeting_notes
  RENAME COLUMN source_url TO original_filename;

-- 3. Update source check constraint
-- Drizzle enforces enums at the ORM layer (no native Postgres CHECK was generated).
-- If your DB has a named check constraint, drop and recreate it:
--   ALTER TABLE meeting_notes DROP CONSTRAINT IF EXISTS meeting_notes_source_check;
-- Then update any existing rows (safe on an empty dev DB):
UPDATE meeting_notes
  SET source = 'paste' WHERE source = 'manual';
UPDATE meeting_notes
  SET source = 'upload' WHERE source = 'granola';
-- No further SQL needed; Drizzle will validate the new enum on insert/update.
