-- ---------------------------------------------------------------------------
-- BizTech operating years + user assignments
-- ---------------------------------------------------------------------------
-- Directors/members rotate through BizTech operating years (e.g. "24/25",
-- "25/26"). Years live in their own table so adding a new year is a row insert
-- instead of a schema migration. users_years is a plain N:M join.

CREATE TABLE IF NOT EXISTS years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  label text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users_years (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE cascade,
  year_id uuid NOT NULL REFERENCES years(id) ON DELETE cascade,
  CONSTRAINT users_years_user_id_year_id_pk PRIMARY KEY (user_id, year_id)
);

-- Seed the known operating years. ON CONFLICT keeps re-runs idempotent.
INSERT INTO years (label) VALUES ('24/25'), ('25/26'), ('26/27')
  ON CONFLICT (label) DO NOTHING;

-- ---------------------------------------------------------------------------
-- RLS — match the policies on the other join tables (see 0001_rls_policies.sql)
-- ---------------------------------------------------------------------------
ALTER TABLE years ENABLE ROW LEVEL SECURITY;
ALTER TABLE users_years ENABLE ROW LEVEL SECURITY;

CREATE POLICY years_select_authenticated ON years
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY years_insert_admin ON years
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY years_update_admin ON years
  FOR UPDATE TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY years_delete_admin ON years
  FOR DELETE TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY users_years_select_authenticated ON users_years
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY users_years_insert_authenticated ON users_years
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY users_years_update_authenticated ON users_years
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY users_years_delete_admin ON users_years
  FOR DELETE TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- ---------------------------------------------------------------------------
-- Seed users_years assignments
-- ---------------------------------------------------------------------------
-- Match users by first name (case-insensitive), narrowing on last name only
-- where multiple people share a first name. Rows where no matching user row
-- exists yet are silently skipped — re-running this migration after the
-- missing users sign in will fill them in.

INSERT INTO users_years (user_id, year_id)
SELECT u.id, y.id
FROM (VALUES
  ('daniel',  'lee',   '24/25'),
  ('daniel',  'tong',  '25/26'),
  ('daniel',  'zhang', '25/26'),
  ('daniel',  'zhang', '26/27'),
  ('dhristy', NULL,    '24/25'),
  ('dhristy', NULL,    '25/26'),
  ('dhristy', NULL,    '26/27'),
  ('elijah',  NULL,    '25/26'),
  ('elijah',  NULL,    '26/27'),
  ('emily',   'han',   '24/25'),
  ('ethan',   NULL,    '24/25'),
  ('gautham', NULL,    '24/25'),
  ('gautham', NULL,    '25/26'),
  ('gautham', NULL,    '26/27'),
  ('isaac',   NULL,    '24/25'),
  ('isaac',   NULL,    '25/26'),
  ('isaac',   NULL,    '26/27'),
  ('helen',   NULL,    '26/27'),
  ('jack',    NULL,    '25/26'),
  ('jack',    NULL,    '26/27'),
  ('jay',     'park',  '24/25'),
  ('jay',     'park',  '25/26'),
  ('jay',     'park',  '26/27'),
  ('jeremy',  NULL,    '24/25'),
  ('jeremy',  NULL,    '25/26'),
  ('jimmy',   NULL,    '25/26'),
  ('jimmy',   NULL,    '26/27'),
  ('joaquin', NULL,    '24/25'),
  ('joaquin', NULL,    '25/26'),
  ('john',    NULL,    '24/25'),
  ('john',    NULL,    '25/26'),
  ('john',    NULL,    '26/27'),
  ('keenan',  NULL,    '26/27'),
  ('madison', NULL,    '26/27'),
  ('pauline', NULL,    '24/25'),
  ('pauline', NULL,    '25/26'),
  ('pauline', NULL,    '26/27'),
  ('vi',      NULL,    '26/27')
) AS a(first_name, last_name, year_label)
JOIN users u
  ON LOWER(u.first_name) = a.first_name
 AND (a.last_name IS NULL OR LOWER(u.last_name) = a.last_name)
JOIN years y ON y.label = a.year_label
ON CONFLICT DO NOTHING;
