/**
 * Token storage — DB reads/writes and encrypt/decrypt for refresh tokens.
 *
 * Refresh tokens are the crown jewel: a leaked one gives indefinite access to
 * the user's Gmail, Drive, and Docs. Rules:
 *   - Encrypted at rest with AES-256-GCM using GOOGLE_TOKEN_ENCRYPTION_KEY.
 *   - Never logged. If you need to debug, log access_token[0..7] and the
 *     refresh token byte length — never the token itself.
 *   - The encryption key lives in env and is never exported from this file.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { eq } from 'drizzle-orm';
import { db, googleOauthTokens } from '@/lib/db';

/**
 * Subset of Google's token response we care about.
 * Matches google-auth-library's Credentials interface without importing it
 * (which would require a direct dependency declaration).
 */
export type GoogleTokenResponse = {
  access_token?: string | null;
  refresh_token?: string | null;
  /** Unix millisecond timestamp when access_token expires. */
  expiry_date?: number | null;
  scope?: string | null;
  token_type?: string | null;
  id_token?: string | null;
};

// ---------------------------------------------------------------------------
// Encryption helpers
// ---------------------------------------------------------------------------

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;   // 96-bit IV — NIST recommended for GCM
const TAG_BYTES = 16;

function getEncryptionKey(): Buffer {
  const raw = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new Error('GOOGLE_TOKEN_ENCRYPTION_KEY env var is not set');
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error(
      `GOOGLE_TOKEN_ENCRYPTION_KEY must be 32 bytes (got ${key.length}). ` +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
    );
  }
  return key;
}

/** Encrypt plaintext → base64(iv || ciphertext || authTag). */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, ciphertext, tag]).toString('base64');
}

/** Decrypt base64(iv || ciphertext || authTag) → plaintext. */
export function decrypt(encoded: string): string {
  const key = getEncryptionKey();
  const buf = Buffer.from(encoded, 'base64');
  const iv = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(buf.length - TAG_BYTES);
  const ciphertext = buf.subarray(IV_BYTES, buf.length - TAG_BYTES);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

// ---------------------------------------------------------------------------
// Stored token shape (what we keep in the DB row)
// ---------------------------------------------------------------------------

export type StoredTokens = {
  userId: string;
  accessToken: string;
  refreshToken: string; // decrypted — never persisted in this form
  scopes: string[];
  expiresAt: Date;
};

// ---------------------------------------------------------------------------
// Public functions
// ---------------------------------------------------------------------------

/** Called from the OAuth callback after a user signs in or grants new scopes. */
export async function storeTokens(
  userId: string,
  tokenResponse: GoogleTokenResponse,
  /** Scopes granted on this response. Pass the full merged set. */
  scopes: string[],
): Promise<void> {
  const accessToken = tokenResponse.access_token;
  const refreshToken = tokenResponse.refresh_token;

  if (!accessToken) throw new Error('storeTokens: access_token is required');
  if (!refreshToken) throw new Error('storeTokens: refresh_token is required');

  const expiresAt = tokenResponse.expiry_date
    ? new Date(tokenResponse.expiry_date)
    : new Date(Date.now() + 3600 * 1000); // default: 1 hour

  await db
    .insert(googleOauthTokens)
    .values({
      userId,
      accessToken,
      refreshTokenEncrypted: encrypt(refreshToken),
      scopes,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: googleOauthTokens.userId,
      set: {
        accessToken,
        refreshTokenEncrypted: encrypt(refreshToken),
        scopes,
        expiresAt,
        updatedAt: new Date(),
      },
    });
}

/** Fetch and decrypt tokens for a user. Returns null if no row exists. */
export async function fetchTokens(userId: string): Promise<StoredTokens | null> {
  const rows = await db
    .select()
    .from(googleOauthTokens)
    .where(eq(googleOauthTokens.userId, userId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    userId: row.userId,
    accessToken: row.accessToken,
    refreshToken: decrypt(row.refreshTokenEncrypted),
    scopes: row.scopes as string[],
    expiresAt: row.expiresAt,
  };
}

/** Delete a user's token row (sign-out or revocation). */
export async function deleteTokens(userId: string): Promise<void> {
  await db.delete(googleOauthTokens).where(eq(googleOauthTokens.userId, userId));
}
