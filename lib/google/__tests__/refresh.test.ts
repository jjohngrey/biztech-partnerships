/**
 * Tests for the refresh module.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/google/tokens', () => ({
  storeTokens: vi.fn(),
  fetchTokens: vi.fn(),
  deleteTokens: vi.fn(),
}));

const mockRefreshAccessToken = vi.fn();

vi.mock('googleapis', () => {
  function MockOAuth2(this: { setCredentials: ReturnType<typeof vi.fn>; refreshAccessToken: typeof mockRefreshAccessToken }) {
    this.setCredentials = vi.fn();
    this.refreshAccessToken = mockRefreshAccessToken;
  }
  return {
    google: {
      auth: { OAuth2: MockOAuth2 },
    },
  };
});

import { refreshIfNeeded } from '../refresh';
import { storeTokens, fetchTokens, deleteTokens } from '../tokens';
import { NeedsConsentError } from '../errors';

const mockStoreTokens = vi.mocked(storeTokens);
const mockFetchTokens = vi.mocked(fetchTokens);
const mockDeleteTokens = vi.mocked(deleteTokens);

const BASE_TOKENS = {
  userId: 'user-1',
  accessToken: 'access-old',
  refreshToken: 'refresh-xyz',
  scopes: ['openid', 'email', 'profile'],
  expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GOOGLE_CLIENT_ID = 'test-client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
});

describe('refreshIfNeeded', () => {
  it('returns tokens unchanged when not close to expiry', async () => {
    const result = await refreshIfNeeded(BASE_TOKENS);
    expect(result).toBe(BASE_TOKENS);
    expect(mockRefreshAccessToken).not.toHaveBeenCalled();
  });

  it('refreshes when token expires in 2 minutes', async () => {
    const expiringTokens = { ...BASE_TOKENS, expiresAt: new Date(Date.now() + 2 * 60 * 1000) };
    const freshCredentials = {
      access_token: 'access-new',
      expiry_date: Date.now() + 3600 * 1000,
    };
    const freshTokenRow = { ...expiringTokens, accessToken: 'access-new' };

    mockRefreshAccessToken.mockResolvedValueOnce({ credentials: freshCredentials });
    mockStoreTokens.mockResolvedValueOnce(undefined);
    mockFetchTokens.mockResolvedValueOnce(freshTokenRow);

    const result = await refreshIfNeeded(expiringTokens);
    expect(mockRefreshAccessToken).toHaveBeenCalledOnce();
    expect(mockStoreTokens).toHaveBeenCalledOnce();
    expect(result.accessToken).toBe('access-new');
  });

  it('deletes token row and throws NeedsConsentError on invalid_grant', async () => {
    const expiringTokens = { ...BASE_TOKENS, expiresAt: new Date(0) };
    mockRefreshAccessToken.mockRejectedValueOnce(new Error('invalid_grant'));

    await expect(refreshIfNeeded(expiringTokens)).rejects.toBeInstanceOf(NeedsConsentError);
    expect(mockDeleteTokens).toHaveBeenCalledWith('user-1');
  });

  it('deduplicates concurrent refresh calls — exactly one request to Google', async () => {
    const expiringTokens = { ...BASE_TOKENS, expiresAt: new Date(0) };
    const freshCredentials = { access_token: 'access-new', expiry_date: Date.now() + 3600 * 1000 };
    const freshTokenRow = { ...BASE_TOKENS, accessToken: 'access-new' };

    let resolveRefresh!: (v: unknown) => void;
    const refreshPromise = new Promise((res) => { resolveRefresh = res; });
    mockRefreshAccessToken.mockReturnValueOnce(refreshPromise);
    mockStoreTokens.mockResolvedValue(undefined);
    mockFetchTokens.mockResolvedValue(freshTokenRow);

    // Fire two concurrent calls.
    const p1 = refreshIfNeeded(expiringTokens);
    const p2 = refreshIfNeeded(expiringTokens);

    // Resolve the single underlying refresh.
    resolveRefresh({ credentials: freshCredentials });

    const [r1, r2] = await Promise.all([p1, p2]);

    // Only one refresh call happened.
    expect(mockRefreshAccessToken).toHaveBeenCalledOnce();
    expect(r1.accessToken).toBe('access-new');
    expect(r2.accessToken).toBe('access-new');
  });
});
