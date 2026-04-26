/**
 * Consent URL construction and CSRF state signing.
 *
 * Used for scope escalation: when a feature needs new Google permissions,
 * call buildConsentUrl to get a URL, then redirect the user there.
 * After they approve, Google calls /api/google/callback with a code.
 *
 * IMPORTANT: pass `include_granted_scopes=true` so the resulting token covers
 * the user's previously-granted scopes too. Without it, the new token only
 * covers the newly-requested scopes and the user loses Drive/Docs access.
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { google } from 'googleapis';
import type { GoogleScope } from './scopes';

// ---------------------------------------------------------------------------
// CSRF state helpers
// ---------------------------------------------------------------------------

function getStateSecret(): string {
  const secret = process.env.GOOGLE_STATE_SECRET ?? process.env.GOOGLE_CLIENT_SECRET;
  if (!secret) throw new Error('GOOGLE_STATE_SECRET or GOOGLE_CLIENT_SECRET env var is required');
  return secret;
}

export function signState(payload: Record<string, unknown>): string {
  const body = JSON.stringify(payload);
  const sig = createHmac('sha256', getStateSecret()).update(body).digest('hex');
  return Buffer.from(JSON.stringify({ body, sig })).toString('base64url');
}

export function verifyState(state: string): Record<string, unknown> | null {
  try {
    const { body, sig } = JSON.parse(Buffer.from(state, 'base64url').toString('utf8')) as {
      body: string;
      sig: string;
    };
    const expected = createHmac('sha256', getStateSecret()).update(body).digest('hex');
    const valid = timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
    if (!valid) return null;
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Consent URL
// ---------------------------------------------------------------------------

/**
 * Build the URL that sends the user to Google to grant the requested scopes.
 *
 * @param userId     The user we are escalating scopes for (embedded in state).
 * @param scopes     ONLY the scopes being newly requested. Google merges the
 *                   rest via include_granted_scopes=true.
 * @param redirectUri The URI Google should redirect to after consent.
 */
export function buildConsentUrl(
  userId: string,
  scopes: GoogleScope[],
  redirectUri: string,
): string {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    redirectUri,
  );

  return auth.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',           // always re-issue a refresh token on scope escalation
    include_granted_scopes: true, // merge with existing scopes server-side
    scope: scopes,
    state: signState({ userId }),
  });
}
