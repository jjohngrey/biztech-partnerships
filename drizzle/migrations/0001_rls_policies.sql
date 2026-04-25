-- ---------------------------------------------------------------------------
-- Enable RLS on all tables
-- ---------------------------------------------------------------------------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE in_kind_sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE users_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE users_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_note_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_note_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_note_attendees ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- USERS table policies
-- ---------------------------------------------------------------------------
-- SELECT: any authenticated user can read users
CREATE POLICY users_select_authenticated ON users
  FOR SELECT TO authenticated
  USING (true);

-- INSERT: authenticated users can only insert themselves (via auth trigger)
CREATE POLICY users_insert_self ON users
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- UPDATE: users can only update their own record
CREATE POLICY users_update_self ON users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- DELETE: admins only
CREATE POLICY users_delete_admin ON users
  FOR DELETE TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- ---------------------------------------------------------------------------
-- PARTNERS table policies
-- ---------------------------------------------------------------------------
-- SELECT: any authenticated user
CREATE POLICY partners_select_authenticated ON partners
  FOR SELECT TO authenticated
  USING (true);

-- INSERT: any authenticated user
CREATE POLICY partners_insert_authenticated ON partners
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- UPDATE: any authenticated user
CREATE POLICY partners_update_authenticated ON partners
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- DELETE: admin only
CREATE POLICY partners_delete_admin ON partners
  FOR DELETE TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- ---------------------------------------------------------------------------
-- COMPANIES table policies
-- ---------------------------------------------------------------------------
-- SELECT: any authenticated user
CREATE POLICY companies_select_authenticated ON companies
  FOR SELECT TO authenticated
  USING (true);

-- INSERT: any authenticated user
CREATE POLICY companies_insert_authenticated ON companies
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- UPDATE: any authenticated user
CREATE POLICY companies_update_authenticated ON companies
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- DELETE: admin only
CREATE POLICY companies_delete_admin ON companies
  FOR DELETE TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- ---------------------------------------------------------------------------
-- SPONSORS table policies
-- ---------------------------------------------------------------------------
-- SELECT: any authenticated user
CREATE POLICY sponsors_select_authenticated ON sponsors
  FOR SELECT TO authenticated
  USING (true);

-- INSERT: any authenticated user
CREATE POLICY sponsors_insert_authenticated ON sponsors
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- UPDATE: any authenticated user
CREATE POLICY sponsors_update_authenticated ON sponsors
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- DELETE: admin only
CREATE POLICY sponsors_delete_admin ON sponsors
  FOR DELETE TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- ---------------------------------------------------------------------------
-- IN_KIND_SPONSORS table policies
-- ---------------------------------------------------------------------------
-- SELECT: any authenticated user
CREATE POLICY in_kind_sponsors_select_authenticated ON in_kind_sponsors
  FOR SELECT TO authenticated
  USING (true);

-- INSERT: any authenticated user
CREATE POLICY in_kind_sponsors_insert_authenticated ON in_kind_sponsors
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- UPDATE: any authenticated user
CREATE POLICY in_kind_sponsors_update_authenticated ON in_kind_sponsors
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- DELETE: admin only
CREATE POLICY in_kind_sponsors_delete_admin ON in_kind_sponsors
  FOR DELETE TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- ---------------------------------------------------------------------------
-- EVENTS table policies
-- ---------------------------------------------------------------------------
-- SELECT: any authenticated user
CREATE POLICY events_select_authenticated ON events
  FOR SELECT TO authenticated
  USING (true);

-- INSERT: any authenticated user
CREATE POLICY events_insert_authenticated ON events
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- UPDATE: any authenticated user
CREATE POLICY events_update_authenticated ON events
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- DELETE: admin only
CREATE POLICY events_delete_admin ON events
  FOR DELETE TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- ---------------------------------------------------------------------------
-- MEETING_NOTES table policies
-- ---------------------------------------------------------------------------
-- SELECT: any authenticated user
CREATE POLICY meeting_notes_select_authenticated ON meeting_notes
  FOR SELECT TO authenticated
  USING (true);

-- INSERT: any authenticated user (they become creator)
CREATE POLICY meeting_notes_insert_authenticated ON meeting_notes
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

-- UPDATE: creator or admin
CREATE POLICY meeting_notes_update_own ON meeting_notes
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    created_by = auth.uid()
    OR (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- DELETE: creator or admin
CREATE POLICY meeting_notes_delete_own ON meeting_notes
  FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- ---------------------------------------------------------------------------
-- JOIN TABLES (partners_events, users_events, users_partners, etc.)
-- ---------------------------------------------------------------------------
-- SELECT: any authenticated user
CREATE POLICY partners_events_select_authenticated ON partners_events
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY users_events_select_authenticated ON users_events
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY users_partners_select_authenticated ON users_partners
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY meeting_note_partners_select_authenticated ON meeting_note_partners
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY meeting_note_events_select_authenticated ON meeting_note_events
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY meeting_note_attendees_select_authenticated ON meeting_note_attendees
  FOR SELECT TO authenticated
  USING (true);

-- INSERT: any authenticated user
CREATE POLICY partners_events_insert_authenticated ON partners_events
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY users_events_insert_authenticated ON users_events
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY users_partners_insert_authenticated ON users_partners
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY meeting_note_partners_insert_authenticated ON meeting_note_partners
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY meeting_note_events_insert_authenticated ON meeting_note_events
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY meeting_note_attendees_insert_authenticated ON meeting_note_attendees
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- UPDATE: any authenticated user
CREATE POLICY partners_events_update_authenticated ON partners_events
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY users_events_update_authenticated ON users_events
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY users_partners_update_authenticated ON users_partners
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY meeting_note_partners_update_authenticated ON meeting_note_partners
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY meeting_note_events_update_authenticated ON meeting_note_events
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY meeting_note_attendees_update_authenticated ON meeting_note_attendees
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- DELETE: admin only
CREATE POLICY partners_events_delete_admin ON partners_events
  FOR DELETE TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY users_events_delete_admin ON users_events
  FOR DELETE TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY users_partners_delete_admin ON users_partners
  FOR DELETE TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY meeting_note_partners_delete_admin ON meeting_note_partners
  FOR DELETE TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY meeting_note_events_delete_admin ON meeting_note_events
  FOR DELETE TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY meeting_note_attendees_delete_admin ON meeting_note_attendees
  FOR DELETE TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- ---------------------------------------------------------------------------
-- INTERACTIONS table policies
-- ---------------------------------------------------------------------------
-- SELECT: any authenticated user
CREATE POLICY interactions_select_authenticated ON interactions
  FOR SELECT TO authenticated
  USING (true);

-- INSERT: any authenticated user (but user_id must match auth.uid())
CREATE POLICY interactions_insert_authenticated ON interactions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- UPDATE: creator (user_id = auth.uid()) or admin
CREATE POLICY interactions_update_own ON interactions
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    user_id = auth.uid()
    OR (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );

-- DELETE: creator or admin
CREATE POLICY interactions_delete_own ON interactions
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );
