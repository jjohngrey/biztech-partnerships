/**
 * Public entry point for the Google OAuth module.
 *
 * Every other part of the app that needs to talk to Google calls
 * getAuthedClient() and gets back a typed client with Drive, Docs, and Gmail.
 *
 * The returned client has a 401-retry proxy built in: if a Google API call
 * returns 401, the module forces a token refresh and retries once. If the
 * second call also returns 401, it means the refresh token is dead. The row
 * is deleted and NeedsConsentError is thrown.
 */

import { google } from 'googleapis';
import type { drive_v3, docs_v1, gmail_v1 } from 'googleapis';
import { fetchTokens, deleteTokens } from './tokens';
import { refreshIfNeeded, forceRefresh } from './refresh';
import { buildConsentUrl } from './consent';
import { hasAllScopes } from './scopes';
import { NeedsConsentError } from './errors';
import type { GoogleScope } from './scopes';
import type { NeedsConsent } from './errors';

export type { NeedsConsent } from './errors';
export type { GoogleScope } from './scopes';
export { NeedsConsentError } from './errors';

export type GoogleClient = {
  drive: drive_v3.Drive;
  docs: docs_v1.Docs;
  gmail: gmail_v1.Gmail;
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get a typed Google API client for the given user, scoped to requiredScopes.
 *
 * Returns NeedsConsent if:
 *   - The user has no stored tokens (first time)
 *   - The stored scopes don't cover requiredScopes
 *
 * Throws NeedsConsentError if the user's refresh token dies mid-session.
 */
export async function getAuthedClient(
  userId: string,
  requiredScopes: GoogleScope[],
): Promise<GoogleClient | NeedsConsent> {
  const defaultRedirectUri = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/api/google/callback`;

  // 1. Look up stored tokens.
  const tokens = await fetchTokens(userId);

  // 2. No row → user hasn't connected yet.
  if (!tokens) {
    return {
      kind: 'needs-consent',
      missingScopes: requiredScopes,
      consentUrl: buildConsentUrl(userId, requiredScopes, defaultRedirectUri),
    };
  }

  // 3. Missing scopes → prompt for incremental consent.
  const missing = requiredScopes.filter((s) => !tokens.scopes.includes(s));
  if (missing.length > 0) {
    return {
      kind: 'needs-consent',
      missingScopes: missing as GoogleScope[],
      consentUrl: buildConsentUrl(userId, missing as GoogleScope[], defaultRedirectUri),
    };
  }

  // 4–5. Refresh if the access token is expiring soon.
  const fresh = await refreshIfNeeded(tokens);

  // 6. Build and return typed clients with retry proxy.
  return buildClientWithRetry(userId, fresh.accessToken, fresh.refreshToken);
}

/**
 * Called when the user signs out or removes the Google integration.
 * Calls Google's revoke endpoint first (best-effort), then deletes the row.
 */
export async function revokeTokens(userId: string): Promise<void> {
  const tokens = await fetchTokens(userId);
  if (!tokens) return;

  // Best-effort revoke — ignore errors (user may have already revoked at Google).
  try {
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID!,
      process.env.GOOGLE_CLIENT_SECRET!,
    );
    auth.setCredentials({ refresh_token: tokens.refreshToken });
    await auth.revokeCredentials();
  } catch {
    // 400 = already revoked, or other error — swallow and proceed.
  }

  await deleteTokens(userId);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function buildOAuth2Client(accessToken: string, refreshToken: string) {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
  );
  auth.setCredentials({ access_token: accessToken, refresh_token: refreshToken });
  return auth;
}

/**
 * Build typed Google API clients wrapped in a per-method 401-retry proxy.
 *
 * Proxy behavior per API call:
 *   1. Make the call.
 *   2. If 401 → force refresh, swap credentials, retry once.
 *   3. If 401 again → delete token row, throw NeedsConsentError.
 *   4. Any other error → rethrow unchanged.
 */
function buildClientWithRetry(
  userId: string,
  accessToken: string,
  refreshToken: string,
): GoogleClient {
  const auth = buildOAuth2Client(accessToken, refreshToken);

  const drive = google.drive({ version: 'v3', auth });
  const docs = google.docs({ version: 'v1', auth });
  const gmail = google.gmail({ version: 'v1', auth });

  return {
    drive: wrapWithRetry(drive, userId, auth) as drive_v3.Drive,
    docs: wrapWithRetry(docs, userId, auth) as docs_v1.Docs,
    gmail: wrapWithRetry(gmail, userId, auth) as gmail_v1.Gmail,
  };
}

/** Deep proxy that intercepts method calls and wraps Promises with 401 retry. */
function wrapWithRetry<T extends object>(
  target: T,
  userId: string,
  auth: InstanceType<typeof google.auth.OAuth2>,
): T {
  return new Proxy(target, {
    get(obj, prop) {
      const value = (obj as Record<string | symbol, unknown>)[prop];

      // Recurse into sub-objects (e.g., drive.files, gmail.users.messages).
      if (typeof value === 'object' && value !== null && !(value instanceof Promise)) {
        return wrapWithRetry(value as object, userId, auth);
      }

      if (typeof value !== 'function') return value;

      // Wrap the function.
      return async (...args: unknown[]) => {
        try {
          return await (value as (...a: unknown[]) => unknown).apply(obj, args);
        } catch (firstErr) {
          if (!is401(firstErr)) throw firstErr;

          // Force refresh and update credentials.
          const currentTokens = await fetchTokens(userId);
          if (!currentTokens) {
            throw new NeedsConsentError([], '');
          }

          let refreshed;
          try {
            refreshed = await forceRefresh(currentTokens);
          } catch (refreshErr) {
            if (refreshErr instanceof NeedsConsentError) throw refreshErr;
            throw firstErr;
          }

          auth.setCredentials({
            access_token: refreshed.accessToken,
            refresh_token: refreshed.refreshToken,
          });

          // Retry once.
          try {
            return await (value as (...a: unknown[]) => unknown).apply(obj, args);
          } catch (secondErr) {
            if (!is401(secondErr)) throw secondErr;
            // Second 401 — refresh token is dead.
            await deleteTokens(userId);
            throw new NeedsConsentError([], '');
          }
        }
      };
    },
  });
}

function is401(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as { response?: { status?: number }; code?: number | string };
  return e.response?.status === 401 || e.code === 401 || e.code === '401';
}

// Re-export storeTokens so the OAuth callback can use it without importing tokens.ts directly.
export { storeTokens } from './tokens';
export { buildConsentUrl } from './consent';
