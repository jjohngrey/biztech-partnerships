/**
 * Tests for getAuthedClient.
 *
 * To run: install vitest (`pnpm add -D vitest`) and add to package.json:
 *   "test": "vitest"
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies before importing the module under test
// ---------------------------------------------------------------------------

vi.mock('@/lib/google/tokens', () => ({
  fetchTokens: vi.fn(),
  deleteTokens: vi.fn(),
  storeTokens: vi.fn(),
}));

vi.mock('@/lib/google/refresh', () => ({
  refreshIfNeeded: vi.fn(),
  forceRefresh: vi.fn(),
}));

vi.mock('@/lib/google/consent', () => ({
  buildConsentUrl: vi.fn().mockReturnValue('https://accounts.google.com/mock-consent'),
  verifyState: vi.fn(),
  signState: vi.fn(),
}));

vi.mock('googleapis', () => {
  function MockOAuth2() {
    return { setCredentials: vi.fn(), revokeCredentials: vi.fn().mockResolvedValue({}) };
  }
  return {
    google: {
      auth: { OAuth2: MockOAuth2 },
      drive: vi.fn().mockReturnValue({ files: { list: vi.fn() } }),
      docs: vi.fn().mockReturnValue({ documents: { get: vi.fn() } }),
      gmail: vi.fn().mockReturnValue({ users: { messages: { send: vi.fn() } } }),
    },
  };
});

import { getAuthedClient } from '../client';
import { fetchTokens } from '../tokens';
import { refreshIfNeeded } from '../refresh';

const mockFetchTokens = vi.mocked(fetchTokens);
const mockRefreshIfNeeded = vi.mocked(refreshIfNeeded);

const VALID_TOKENS = {
  userId: 'user-1',
  accessToken: 'access-abc',
  refreshToken: 'refresh-xyz',
  scopes: ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/drive.file'],
  expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GOOGLE_CLIENT_ID = 'test-client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
  process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';
});

describe('getAuthedClient', () => {
  it('returns NeedsConsent when no token row exists', async () => {
    mockFetchTokens.mockResolvedValue(null);

    const result = await getAuthedClient('user-1', ['openid']);
    expect(result).toMatchObject({ kind: 'needs-consent' });
  });

  it('returns NeedsConsent when required scope is missing', async () => {
    mockFetchTokens.mockResolvedValue({
      ...VALID_TOKENS,
      scopes: ['openid', 'email', 'profile'],
    });
    mockRefreshIfNeeded.mockResolvedValue({ ...VALID_TOKENS, scopes: ['openid', 'email', 'profile'] });

    const result = await getAuthedClient('user-1', ['https://www.googleapis.com/auth/gmail.send']);
    expect(result).toMatchObject({
      kind: 'needs-consent',
      missingScopes: ['https://www.googleapis.com/auth/gmail.send'],
    });
    // Should not attempt a refresh when scopes are missing.
    expect(mockRefreshIfNeeded).not.toHaveBeenCalled();
  });

  it('returns a client without refreshing when token is fresh and scopes are present', async () => {
    mockFetchTokens.mockResolvedValue(VALID_TOKENS);
    mockRefreshIfNeeded.mockResolvedValue(VALID_TOKENS);

    const result = await getAuthedClient('user-1', ['https://www.googleapis.com/auth/drive.file']);
    expect(result).not.toMatchObject({ kind: 'needs-consent' });
    expect('drive' in (result as object)).toBe(true);
  });

  it('triggers refresh when token expires in 2 minutes', async () => {
    const expiringTokens = { ...VALID_TOKENS, expiresAt: new Date(Date.now() + 2 * 60 * 1000) };
    const freshTokens = { ...VALID_TOKENS, accessToken: 'fresh-access', expiresAt: new Date(Date.now() + 60 * 60 * 1000) };

    mockFetchTokens.mockResolvedValue(expiringTokens);
    mockRefreshIfNeeded.mockResolvedValue(freshTokens);

    await getAuthedClient('user-1', ['https://www.googleapis.com/auth/drive.file']);
    expect(mockRefreshIfNeeded).toHaveBeenCalledWith(expiringTokens);
  });

  it('triggers refresh when token is already expired', async () => {
    const expiredTokens = { ...VALID_TOKENS, expiresAt: new Date(Date.now() - 1000) };
    mockFetchTokens.mockResolvedValue(expiredTokens);
    mockRefreshIfNeeded.mockResolvedValue({ ...VALID_TOKENS });

    await getAuthedClient('user-1', ['https://www.googleapis.com/auth/drive.file']);
    expect(mockRefreshIfNeeded).toHaveBeenCalled();
  });
});
