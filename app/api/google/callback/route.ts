/**
 * OAuth callback for Google scope escalation.
 *
 * This route is NOT used for initial sign-in (that goes through Supabase at
 * /auth/callback). It handles the second+ OAuth round-trip when a feature
 * needs additional Google scopes beyond what the user originally granted.
 *
 * Flow:
 *   1. Feature calls getAuthedClient with new scopes → gets NeedsConsent back.
 *   2. UI shows consent modal with consentUrl.
 *   3. User approves → Google redirects here with ?code=...&state=...
 *   4. We exchange the code, store the merged tokens, redirect back to the app.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { google } from 'googleapis';
import { verifyState } from '@/lib/google/consent';
import { storeTokens, type GoogleTokenResponse } from '@/lib/google/tokens';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const stateParam = searchParams.get('state');
  const errorParam = searchParams.get('error');

  // User denied consent.
  if (errorParam) {
    return NextResponse.redirect(`${origin}/?google_consent=denied`);
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(`${origin}/?google_consent=error`);
  }

  // Verify CSRF state.
  const payload = verifyState(stateParam);
  if (!payload || typeof payload.userId !== 'string') {
    return NextResponse.redirect(`${origin}/?google_consent=invalid_state`);
  }

  const userId = payload.userId;
  const redirectUri = `${origin}/api/google/callback`;

  // Exchange the code for tokens directly with Google.
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    redirectUri,
  );

  let tokens;
  try {
    const { tokens: t } = await auth.getToken(code);
    tokens = t;
  } catch {
    return NextResponse.redirect(`${origin}/?google_consent=exchange_failed`);
  }

  const googleTokens: GoogleTokenResponse = tokens;

  if (!googleTokens.access_token || !googleTokens.refresh_token) {
    // No refresh token: either include_granted_scopes and prompt=consent weren't
    // set, or this is an unexpected response. Both cases are programmer errors.
    return NextResponse.redirect(`${origin}/?google_consent=missing_token`);
  }

  // tokens.scope is a space-separated string of all granted scopes (merged
  // because we sent include_granted_scopes=true in the consent URL).
  const scopes = tokens.scope ? tokens.scope.split(' ') : [];

  await storeTokens(userId, googleTokens, scopes);

  // Redirect back to wherever the user was. The page should detect the
  // google_consent=granted param and retry the original action.
  const next = typeof payload.next === 'string' ? payload.next : '/';
  return NextResponse.redirect(`${origin}${next}?google_consent=granted`);
}
