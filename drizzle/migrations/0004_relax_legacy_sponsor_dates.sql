-- Sponsorship dates now come from the linked event. These legacy columns are
-- still present from the starter schema, but new deal inserts should not have
-- to duplicate event dates.
ALTER TABLE sponsors ALTER COLUMN start_date DROP NOT NULL;
ALTER TABLE sponsors ALTER COLUMN end_date DROP NOT NULL;
