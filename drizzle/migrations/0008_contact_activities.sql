-- ---------------------------------------------------------------------------
-- Canonical contact activity timeline
-- ---------------------------------------------------------------------------
-- Meetings and lightweight touchpoints used to live in separate tables. Keep the
-- legacy tables for rollback/audit, but backfill and move app reads/writes here.

CREATE TABLE IF NOT EXISTS contact_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  legacy_interaction_id uuid UNIQUE REFERENCES interactions(id) ON DELETE set null,
  legacy_meeting_note_id uuid UNIQUE REFERENCES meeting_notes(id) ON DELETE set null,
  type text NOT NULL,
  direction text,
  subject text NOT NULL,
  content text,
  summary text,
  notes text,
  occurred_at timestamptz NOT NULL,
  follow_up_date date,
  source text NOT NULL DEFAULT 'manual',
  source_url text,
  original_filename text,
  external_message_id text,
  external_thread_id text,
  primary_company_id uuid REFERENCES companies(id) ON DELETE set null,
  primary_partner_id uuid REFERENCES partners(id) ON DELETE set null,
  primary_user_id uuid REFERENCES users(id) ON DELETE set null,
  sponsor_id uuid REFERENCES sponsors(id) ON DELETE set null,
  created_by uuid REFERENCES users(id) ON DELETE set null,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contact_activity_companies (
  activity_id uuid NOT NULL REFERENCES contact_activities(id) ON DELETE cascade,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE cascade,
  CONSTRAINT contact_activity_companies_activity_id_company_id_pk
    PRIMARY KEY (activity_id, company_id)
);

CREATE TABLE IF NOT EXISTS contact_activity_partners (
  activity_id uuid NOT NULL REFERENCES contact_activities(id) ON DELETE cascade,
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE cascade,
  CONSTRAINT contact_activity_partners_activity_id_partner_id_pk
    PRIMARY KEY (activity_id, partner_id)
);

CREATE TABLE IF NOT EXISTS contact_activity_events (
  activity_id uuid NOT NULL REFERENCES contact_activities(id) ON DELETE cascade,
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE cascade,
  CONSTRAINT contact_activity_events_activity_id_event_id_pk
    PRIMARY KEY (activity_id, event_id)
);

CREATE TABLE IF NOT EXISTS contact_activity_attendees (
  activity_id uuid NOT NULL REFERENCES contact_activities(id) ON DELETE cascade,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE cascade,
  CONSTRAINT contact_activity_attendees_activity_id_user_id_pk
    PRIMARY KEY (activity_id, user_id)
);

CREATE INDEX IF NOT EXISTS contact_activities_occurred_at_idx
  ON contact_activities(occurred_at DESC);
CREATE INDEX IF NOT EXISTS contact_activities_primary_company_id_idx
  ON contact_activities(primary_company_id);
CREATE INDEX IF NOT EXISTS contact_activities_primary_partner_id_idx
  ON contact_activities(primary_partner_id);
CREATE INDEX IF NOT EXISTS contact_activities_primary_user_id_idx
  ON contact_activities(primary_user_id);
CREATE INDEX IF NOT EXISTS contact_activities_sponsor_id_idx
  ON contact_activities(sponsor_id);
CREATE INDEX IF NOT EXISTS contact_activities_external_message_id_idx
  ON contact_activities(external_message_id);

INSERT INTO contact_activities (
  legacy_interaction_id,
  type,
  direction,
  subject,
  notes,
  occurred_at,
  follow_up_date,
  source,
  external_message_id,
  external_thread_id,
  primary_company_id,
  primary_partner_id,
  primary_user_id,
  sponsor_id,
  created_by,
  created_at,
  updated_at
)
SELECT
  i.id,
  i.type,
  i.direction,
  COALESCE(NULLIF(BTRIM(i.subject), ''), INITCAP(REPLACE(i.type, '_', ' '))),
  i.notes,
  i.contacted_at,
  i.follow_up_date,
  COALESCE(NULLIF(BTRIM(i.source), ''), 'manual'),
  i.external_message_id,
  i.external_thread_id,
  i.company_id,
  i.partner_id,
  i.user_id,
  i.sponsor_id,
  i.user_id,
  i.created_at,
  i.updated_at
FROM interactions i
ON CONFLICT (legacy_interaction_id) DO NOTHING;

INSERT INTO contact_activity_companies (activity_id, company_id)
SELECT ca.id, i.company_id
FROM contact_activities ca
JOIN interactions i ON i.id = ca.legacy_interaction_id
WHERE i.company_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO contact_activity_partners (activity_id, partner_id)
SELECT ca.id, i.partner_id
FROM contact_activities ca
JOIN interactions i ON i.id = ca.legacy_interaction_id
WHERE i.partner_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO contact_activity_attendees (activity_id, user_id)
SELECT ca.id, i.user_id
FROM contact_activities ca
JOIN interactions i ON i.id = ca.legacy_interaction_id
WHERE i.user_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO contact_activity_events (activity_id, event_id)
SELECT ca.id, s.event_id
FROM contact_activities ca
JOIN interactions i ON i.id = ca.legacy_interaction_id
JOIN sponsors s ON s.id = i.sponsor_id
WHERE s.event_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO contact_activities (
  legacy_meeting_note_id,
  type,
  subject,
  content,
  summary,
  occurred_at,
  source,
  source_url,
  original_filename,
  primary_company_id,
  primary_partner_id,
  primary_user_id,
  created_by,
  created_at,
  updated_at
)
SELECT
  mn.id,
  'meeting',
  mn.title,
  mn.content,
  mn.summary,
  mn.meeting_date,
  mn.source,
  mn.source_url,
  mn.original_filename,
  (SELECT mnc.company_id FROM meeting_note_companies mnc WHERE mnc.meeting_note_id = mn.id LIMIT 1),
  (SELECT mnp.partner_id FROM meeting_note_partners mnp WHERE mnp.meeting_note_id = mn.id LIMIT 1),
  COALESCE(
    mn.created_by,
    (SELECT mna.user_id FROM meeting_note_attendees mna WHERE mna.meeting_note_id = mn.id LIMIT 1)
  ),
  mn.created_by,
  mn.created_at,
  mn.updated_at
FROM meeting_notes mn
ON CONFLICT (legacy_meeting_note_id) DO NOTHING;

INSERT INTO contact_activity_companies (activity_id, company_id)
SELECT ca.id, mnc.company_id
FROM contact_activities ca
JOIN meeting_note_companies mnc ON mnc.meeting_note_id = ca.legacy_meeting_note_id
ON CONFLICT DO NOTHING;

INSERT INTO contact_activity_partners (activity_id, partner_id)
SELECT ca.id, mnp.partner_id
FROM contact_activities ca
JOIN meeting_note_partners mnp ON mnp.meeting_note_id = ca.legacy_meeting_note_id
ON CONFLICT DO NOTHING;

INSERT INTO contact_activity_events (activity_id, event_id)
SELECT ca.id, mne.event_id
FROM contact_activities ca
JOIN meeting_note_events mne ON mne.meeting_note_id = ca.legacy_meeting_note_id
ON CONFLICT DO NOTHING;

INSERT INTO contact_activity_attendees (activity_id, user_id)
SELECT ca.id, mna.user_id
FROM contact_activities ca
JOIN meeting_note_attendees mna ON mna.meeting_note_id = ca.legacy_meeting_note_id
ON CONFLICT DO NOTHING;

ALTER TABLE contact_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_activity_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_activity_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_activity_attendees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contact_activities_select_authenticated ON contact_activities;
DROP POLICY IF EXISTS contact_activities_insert_authenticated ON contact_activities;
DROP POLICY IF EXISTS contact_activities_update_authenticated ON contact_activities;
DROP POLICY IF EXISTS contact_activities_delete_authenticated ON contact_activities;
CREATE POLICY contact_activities_select_authenticated ON contact_activities FOR SELECT TO authenticated USING (true);
CREATE POLICY contact_activities_insert_authenticated ON contact_activities FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY contact_activities_update_authenticated ON contact_activities FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY contact_activities_delete_authenticated ON contact_activities FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS contact_activity_companies_select_authenticated ON contact_activity_companies;
DROP POLICY IF EXISTS contact_activity_companies_insert_authenticated ON contact_activity_companies;
DROP POLICY IF EXISTS contact_activity_companies_delete_authenticated ON contact_activity_companies;
CREATE POLICY contact_activity_companies_select_authenticated ON contact_activity_companies FOR SELECT TO authenticated USING (true);
CREATE POLICY contact_activity_companies_insert_authenticated ON contact_activity_companies FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY contact_activity_companies_delete_authenticated ON contact_activity_companies FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS contact_activity_partners_select_authenticated ON contact_activity_partners;
DROP POLICY IF EXISTS contact_activity_partners_insert_authenticated ON contact_activity_partners;
DROP POLICY IF EXISTS contact_activity_partners_delete_authenticated ON contact_activity_partners;
CREATE POLICY contact_activity_partners_select_authenticated ON contact_activity_partners FOR SELECT TO authenticated USING (true);
CREATE POLICY contact_activity_partners_insert_authenticated ON contact_activity_partners FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY contact_activity_partners_delete_authenticated ON contact_activity_partners FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS contact_activity_events_select_authenticated ON contact_activity_events;
DROP POLICY IF EXISTS contact_activity_events_insert_authenticated ON contact_activity_events;
DROP POLICY IF EXISTS contact_activity_events_delete_authenticated ON contact_activity_events;
CREATE POLICY contact_activity_events_select_authenticated ON contact_activity_events FOR SELECT TO authenticated USING (true);
CREATE POLICY contact_activity_events_insert_authenticated ON contact_activity_events FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY contact_activity_events_delete_authenticated ON contact_activity_events FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS contact_activity_attendees_select_authenticated ON contact_activity_attendees;
DROP POLICY IF EXISTS contact_activity_attendees_insert_authenticated ON contact_activity_attendees;
DROP POLICY IF EXISTS contact_activity_attendees_delete_authenticated ON contact_activity_attendees;
CREATE POLICY contact_activity_attendees_select_authenticated ON contact_activity_attendees FOR SELECT TO authenticated USING (true);
CREATE POLICY contact_activity_attendees_insert_authenticated ON contact_activity_attendees FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY contact_activity_attendees_delete_authenticated ON contact_activity_attendees FOR DELETE TO authenticated USING (true);
