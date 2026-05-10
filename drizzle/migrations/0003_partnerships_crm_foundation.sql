-- ---------------------------------------------------------------------------
-- Partnerships CRM foundation
-- ---------------------------------------------------------------------------
-- Company = sponsor/account. Partner = person/contact at a company.
-- Sponsorships are company-level deals for events, with optional contact links.

-- Companies
ALTER TABLE companies ADD COLUMN IF NOT EXISTS website text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS linkedin text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS tier text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE companies ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS is_alumni boolean NOT NULL DEFAULT false;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

-- Contacts
ALTER TABLE partners DROP CONSTRAINT IF EXISTS partners_company_id_companies_id_fk;
ALTER TABLE partners ALTER COLUMN last_name DROP NOT NULL;
ALTER TABLE partners ALTER COLUMN role DROP NOT NULL;
ALTER TABLE partners ALTER COLUMN email DROP NOT NULL;
ALTER TABLE partners ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
ALTER TABLE partners
  ADD CONSTRAINT partners_company_id_companies_id_fk
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE cascade;

CREATE UNIQUE INDEX IF NOT EXISTS partners_one_primary_per_company
  ON partners(company_id)
  WHERE is_primary = true AND archived = false;

-- CRM events
ALTER TABLE events ADD COLUMN IF NOT EXISTS year integer;
ALTER TABLE events ADD COLUMN IF NOT EXISTS outreach_start_date date;
ALTER TABLE events ADD COLUMN IF NOT EXISTS sponsorship_goal integer;
ALTER TABLE events ADD COLUMN IF NOT EXISTS tier_configs jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE events ADD COLUMN IF NOT EXISTS notes text;

-- Cash sponsorships: company-level deal, optional primary contact.
ALTER TABLE sponsors DROP CONSTRAINT IF EXISTS sponsors_partner_id_partners_id_fk;
ALTER TABLE sponsors DROP CONSTRAINT IF EXISTS sponsors_company_id_companies_id_fk;
ALTER TABLE sponsors RENAME COLUMN partner_id TO primary_contact_id;
ALTER TABLE sponsors ALTER COLUMN primary_contact_id DROP NOT NULL;
ALTER TABLE sponsors ALTER COLUMN amount DROP NOT NULL;
ALTER TABLE sponsors ALTER COLUMN tier DROP NOT NULL;
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS event_id uuid NOT NULL;
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS owner_user_id uuid;
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'prospecting';
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS role text;
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS follow_up_date date;
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
ALTER TABLE sponsors
  ADD CONSTRAINT sponsors_company_id_companies_id_fk
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE cascade;
ALTER TABLE sponsors
  ADD CONSTRAINT sponsors_event_id_events_id_fk
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE cascade;
ALTER TABLE sponsors
  ADD CONSTRAINT sponsors_primary_contact_id_partners_id_fk
  FOREIGN KEY (primary_contact_id) REFERENCES partners(id) ON DELETE set null;
ALTER TABLE sponsors
  ADD CONSTRAINT sponsors_owner_user_id_users_id_fk
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE set null;

CREATE TABLE IF NOT EXISTS sponsorship_contacts (
  sponsor_id uuid NOT NULL REFERENCES sponsors(id) ON DELETE cascade,
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE cascade,
  is_primary boolean NOT NULL DEFAULT false,
  notes text,
  CONSTRAINT sponsorship_contacts_sponsor_id_partner_id_pk
    PRIMARY KEY (sponsor_id, partner_id)
);

-- In-kind sponsorships follow the same company/contact model.
ALTER TABLE in_kind_sponsors DROP CONSTRAINT IF EXISTS in_kind_sponsors_partner_id_partners_id_fk;
ALTER TABLE in_kind_sponsors DROP CONSTRAINT IF EXISTS in_kind_sponsors_company_id_companies_id_fk;
ALTER TABLE in_kind_sponsors RENAME COLUMN partner_id TO primary_contact_id;
ALTER TABLE in_kind_sponsors ALTER COLUMN primary_contact_id DROP NOT NULL;
ALTER TABLE in_kind_sponsors ADD COLUMN IF NOT EXISTS event_id uuid;
ALTER TABLE in_kind_sponsors ADD COLUMN IF NOT EXISTS estimated_value integer;
ALTER TABLE in_kind_sponsors ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE in_kind_sponsors
  ADD CONSTRAINT in_kind_sponsors_company_id_companies_id_fk
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE cascade;
ALTER TABLE in_kind_sponsors
  ADD CONSTRAINT in_kind_sponsors_event_id_events_id_fk
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE set null;
ALTER TABLE in_kind_sponsors
  ADD CONSTRAINT in_kind_sponsors_primary_contact_id_partners_id_fk
  FOREIGN KEY (primary_contact_id) REFERENCES partners(id) ON DELETE set null;

-- Company-level event relationships, parallel to contact-level event roles.
CREATE TABLE IF NOT EXISTS company_events (
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE cascade,
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE cascade,
  event_role text NOT NULL,
  CONSTRAINT company_events_company_id_event_id_event_role_pk
    PRIMARY KEY (company_id, event_id, event_role)
);

CREATE TABLE IF NOT EXISTS users_companies (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE cascade,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE cascade,
  CONSTRAINT users_companies_user_id_company_id_pk PRIMARY KEY (user_id, company_id)
);

-- Communications / interactions can attach to a company, contact, and/or deal.
ALTER TABLE interactions DROP CONSTRAINT IF EXISTS interactions_partner_id_partners_id_fk;
ALTER TABLE interactions ADD COLUMN IF NOT EXISTS company_id uuid NOT NULL;
ALTER TABLE interactions ALTER COLUMN partner_id DROP NOT NULL;
ALTER TABLE interactions ADD COLUMN IF NOT EXISTS sponsor_id uuid;
ALTER TABLE interactions ADD COLUMN IF NOT EXISTS direction text;
ALTER TABLE interactions ADD COLUMN IF NOT EXISTS subject text;
ALTER TABLE interactions ADD COLUMN IF NOT EXISTS follow_up_date date;
ALTER TABLE interactions ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE interactions ADD COLUMN IF NOT EXISTS external_message_id text;
ALTER TABLE interactions ADD COLUMN IF NOT EXISTS external_thread_id text;
ALTER TABLE interactions ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE interactions
  ADD CONSTRAINT interactions_company_id_companies_id_fk
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE cascade;
ALTER TABLE interactions
  ADD CONSTRAINT interactions_partner_id_partners_id_fk
  FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE set null;
ALTER TABLE interactions
  ADD CONSTRAINT interactions_sponsor_id_sponsors_id_fk
  FOREIGN KEY (sponsor_id) REFERENCES sponsors(id) ON DELETE set null;

-- Link-only document records for v1.
CREATE TABLE IF NOT EXISTS partner_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE cascade,
  partner_id uuid REFERENCES partners(id) ON DELETE set null,
  event_id uuid REFERENCES events(id) ON DELETE set null,
  sponsor_id uuid REFERENCES sponsors(id) ON DELETE set null,
  title text NOT NULL,
  type text NOT NULL DEFAULT 'general',
  status text NOT NULL DEFAULT 'draft',
  url text NOT NULL,
  file_name text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Meeting notes can tag companies directly, plus optional contacts.
ALTER TABLE meeting_notes ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE meeting_notes ADD COLUMN IF NOT EXISTS original_filename text;

CREATE TABLE IF NOT EXISTS meeting_note_companies (
  meeting_note_id uuid NOT NULL REFERENCES meeting_notes(id) ON DELETE cascade,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE cascade,
  CONSTRAINT meeting_note_companies_meeting_note_id_company_id_pk
    PRIMARY KEY (meeting_note_id, company_id)
);

-- Email ops / mail merge.
CREATE TABLE IF NOT EXISTS email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  description text,
  subject_template text NOT NULL,
  body_template text NOT NULL,
  archived boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES users(id) ON DELETE set null,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE TABLE IF NOT EXISTS email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  template_id uuid REFERENCES email_templates(id) ON DELETE set null,
  event_id uuid REFERENCES events(id) ON DELETE set null,
  sender_user_id uuid REFERENCES users(id) ON DELETE set null,
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE TABLE IF NOT EXISTS email_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  campaign_id uuid NOT NULL REFERENCES email_campaigns(id) ON DELETE cascade,
  company_id uuid REFERENCES companies(id) ON DELETE set null,
  partner_id uuid REFERENCES partners(id) ON DELETE set null,
  recipient_email text NOT NULL,
  status text NOT NULL,
  error text,
  external_message_id text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for new tables.
ALTER TABLE sponsorship_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE users_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_note_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY sponsorship_contacts_select_authenticated ON sponsorship_contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY sponsorship_contacts_insert_authenticated ON sponsorship_contacts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY sponsorship_contacts_update_authenticated ON sponsorship_contacts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY sponsorship_contacts_delete_admin ON sponsorship_contacts FOR DELETE TO authenticated USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY company_events_select_authenticated ON company_events FOR SELECT TO authenticated USING (true);
CREATE POLICY company_events_insert_authenticated ON company_events FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY company_events_update_authenticated ON company_events FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY company_events_delete_admin ON company_events FOR DELETE TO authenticated USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY users_companies_select_authenticated ON users_companies FOR SELECT TO authenticated USING (true);
CREATE POLICY users_companies_insert_authenticated ON users_companies FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY users_companies_update_authenticated ON users_companies FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY users_companies_delete_admin ON users_companies FOR DELETE TO authenticated USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY partner_documents_select_authenticated ON partner_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY partner_documents_insert_authenticated ON partner_documents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY partner_documents_update_authenticated ON partner_documents FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY partner_documents_delete_admin ON partner_documents FOR DELETE TO authenticated USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY meeting_note_companies_select_authenticated ON meeting_note_companies FOR SELECT TO authenticated USING (true);
CREATE POLICY meeting_note_companies_insert_authenticated ON meeting_note_companies FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY meeting_note_companies_update_authenticated ON meeting_note_companies FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY meeting_note_companies_delete_admin ON meeting_note_companies FOR DELETE TO authenticated USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY email_templates_select_authenticated ON email_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY email_templates_insert_authenticated ON email_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY email_templates_update_authenticated ON email_templates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY email_templates_delete_own ON email_templates FOR DELETE TO authenticated USING (created_by = auth.uid() OR (SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY email_campaigns_select_authenticated ON email_campaigns FOR SELECT TO authenticated USING (true);
CREATE POLICY email_campaigns_insert_authenticated ON email_campaigns FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY email_campaigns_update_authenticated ON email_campaigns FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY email_campaigns_delete_own ON email_campaigns FOR DELETE TO authenticated USING (sender_user_id = auth.uid() OR (SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY email_sends_select_authenticated ON email_sends FOR SELECT TO authenticated USING (true);
CREATE POLICY email_sends_insert_authenticated ON email_sends FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY email_sends_update_authenticated ON email_sends FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY email_sends_delete_admin ON email_sends FOR DELETE TO authenticated USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');
