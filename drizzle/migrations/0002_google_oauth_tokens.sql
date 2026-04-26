-- ---------------------------------------------------------------------------
-- google_oauth_tokens
-- Stores Google OAuth tokens for users who have connected their Workspace
-- account for Google API access (Drive, Docs, Gmail).
-- ---------------------------------------------------------------------------
CREATE TABLE google_oauth_tokens (
  user_id uuid PRIMARY KEY
    REFERENCES users(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  -- Refresh token encrypted at rest with AES-GCM.
  -- Stored as base64(iv || ciphertext || auth_tag).
  -- Key comes from GOOGLE_TOKEN_ENCRYPTION_KEY env var.
  refresh_token_encrypted text NOT NULL,
  scopes text[] NOT NULL,
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: only the owning user (or service role) can read their own row.
ALTER TABLE google_oauth_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY tokens_owner_read
  ON google_oauth_tokens FOR SELECT
  USING (user_id = auth.uid());
