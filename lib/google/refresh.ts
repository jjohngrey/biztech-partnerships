/**
 * Token refresh with per-user in-flight deduplication.
 *
 * When many requests for the same user hit at once and the token is expired,
 * this module ensures exactly one refresh call goes to Google. Concurrent
 * requests share the same Promise; the result is written to the DB once and
 * returned to all waiters.
 *
 * On Vercel this only deduplicates within a single function invocation, which
 * is good enough at BizTech's scale.
 */

import { google } from 'googleapis';
import { storeTokens, fetchTokens, deleteTokens, type StoredTokens } from './tokens';
import { NeedsConsentError } from './errors';
import type { GoogleScope } from './scopes';

// 5-minute safety buffer — ensures a "valid" token doesn't expire mid-flight.
const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

/** In-flight refresh promises keyed by userId. */
const inflight = new Map<string, Promise<StoredTokens>>();

function buildOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
  );
}

/**
 * Returns fresh tokens for a user. Refreshes if within the 5-minute buffer.
 * Deduplicates concurrent refresh calls for the same user.
 */
export async function refreshIfNeeded(tokens: StoredTokens): Promise<StoredTokens> {
  const needsRefresh = tokens.expiresAt.getTime() - Date.now() < EXPIRY_BUFFER_MS;
  if (!needsRefresh) return tokens;

  const existing = inflight.get(tokens.userId);
  if (existing) return existing;

  const promise = doRefresh(tokens).finally(() => {
    inflight.delete(tokens.userId);
  });

  inflight.set(tokens.userId, promise);
  return promise;
}

async function doRefresh(tokens: StoredTokens): Promise<StoredTokens> {
  const auth = buildOAuth2Client();
  auth.setCredentials({ refresh_token: tokens.refreshToken });

  let newCredentials;
  try {
    const { credentials } = await auth.refreshAccessToken();
    newCredentials = credentials;
  } catch (err) {
    // invalid_grant means the refresh token is dead (user revoked, token rotated).
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('invalid_grant') || msg.includes('Token has been expired or revoked')) {
      await deleteTokens(tokens.userId);
      throw new NeedsConsentError([] as GoogleScope[], '');
    }
    throw err;
  }

  // Preserve the existing refresh_token if Google didn't rotate it.
  const refreshToken = newCredentials.refresh_token ?? tokens.refreshToken;
  const mergedCredentials = { ...newCredentials, refresh_token: refreshToken };

  await storeTokens(tokens.userId, mergedCredentials, tokens.scopes);

  const updated = await fetchTokens(tokens.userId);
  if (!updated) throw new Error('refreshIfNeeded: token row missing after store');
  return updated;
}

/**
 * Force a refresh regardless of expiry (called after a 401 API response).
 * Deletes the token row and throws NeedsConsentError if refresh fails.
 */
export async function forceRefresh(tokens: StoredTokens): Promise<StoredTokens> {
  // Mark as expired so refreshIfNeeded always refreshes.
  const expiredTokens: StoredTokens = {
    ...tokens,
    expiresAt: new Date(0),
  };
  return refreshIfNeeded(expiredTokens);
}
