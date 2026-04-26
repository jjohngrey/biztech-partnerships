/**
 * Tests for buildConsentUrl and CSRF state helpers.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { signState, verifyState, buildConsentUrl } from '../consent';

beforeEach(() => {
  process.env.GOOGLE_CLIENT_ID = 'test-client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
  process.env.GOOGLE_STATE_SECRET = 'test-state-secret';
});

describe('signState / verifyState', () => {
  it('round-trips a payload', () => {
    const payload = { userId: 'user-1', next: '/dashboard' };
    const state = signState(payload);
    const result = verifyState(state);
    expect(result).toEqual(payload);
  });

  it('returns null for a tampered state', () => {
    const state = signState({ userId: 'user-1' });
    // Flip a character in the middle.
    const tampered = state.slice(0, 10) + 'X' + state.slice(11);
    expect(verifyState(tampered)).toBeNull();
  });

  it('returns null for garbage input', () => {
    expect(verifyState('not-valid-base64url')).toBeNull();
    expect(verifyState('')).toBeNull();
  });
});

describe('buildConsentUrl', () => {
  it('includes required OAuth params', () => {
    const url = buildConsentUrl(
      'user-1',
      ['https://www.googleapis.com/auth/gmail.send'],
      'http://localhost:3000/api/google/callback',
    );

    expect(url).toContain('accounts.google.com');
    expect(url).toContain('access_type=offline');
    expect(url).toContain('prompt=consent');
    expect(url).toContain('include_granted_scopes=true');
    expect(url).toContain(encodeURIComponent('https://www.googleapis.com/auth/gmail.send'));
    expect(url).toContain('state=');
  });

  it('embeds userId in the CSRF state', () => {
    const url = buildConsentUrl(
      'user-42',
      ['openid'],
      'http://localhost:3000/api/google/callback',
    );
    const params = new URL(url).searchParams;
    const state = params.get('state')!;
    const payload = verifyState(state);
    expect(payload?.userId).toBe('user-42');
  });
});
