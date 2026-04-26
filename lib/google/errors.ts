import type { GoogleScope } from './scopes';

// ---------------------------------------------------------------------------
// Error taxonomy
// ---------------------------------------------------------------------------

export type NeedsConsent = {
  kind: 'needs-consent';
  missingScopes: GoogleScope[];
  consentUrl: string;
};

export type InsufficientScope = {
  kind: 'insufficient-scope';
};

export type RateLimited = {
  kind: 'rate-limited';
};

export type TransientError = {
  kind: 'transient-error';
  message: string;
};

export type PermanentError = {
  kind: 'permanent-error';
  message: string;
};

export type GoogleError =
  | NeedsConsent
  | InsufficientScope
  | RateLimited
  | TransientError
  | PermanentError;

// Thrown by the withRetry proxy when a second 401 occurs (refresh token dead).
export class NeedsConsentError extends Error {
  readonly kind = 'needs-consent' as const;
  constructor(
    public readonly missingScopes: GoogleScope[],
    public readonly consentUrl: string,
  ) {
    super('Google consent required');
    this.name = 'NeedsConsentError';
  }
}

// ---------------------------------------------------------------------------
// Classify a raw error from googleapis / fetch
// ---------------------------------------------------------------------------

interface GaxiosLike {
  response?: { status?: number; data?: unknown };
  message?: string;
}

function isGaxiosError(err: unknown): err is GaxiosLike {
  return (
    typeof err === 'object' &&
    err !== null &&
    'response' in err &&
    typeof (err as GaxiosLike).response === 'object'
  );
}

function getStatus(err: GaxiosLike): number | undefined {
  return err.response?.status;
}

function isOAuthError(err: unknown, code: string): boolean {
  if (!isGaxiosError(err)) return false;
  const data = err.response?.data;
  if (typeof data === 'object' && data !== null) {
    return (
      (data as Record<string, unknown>).error === code ||
      (data as Record<string, unknown>).error_description === code
    );
  }
  return false;
}

export function classifyError(err: unknown): GoogleError {
  if (isGaxiosError(err)) {
    const status = getStatus(err);

    if (status === 401 || isOAuthError(err, 'invalid_grant')) {
      // Caller should surface NeedsConsent; we return a sentinel here.
      // The refresh/retry logic throws NeedsConsentError directly.
      return { kind: 'needs-consent', missingScopes: [], consentUrl: '' };
    }

    if (status === 403) {
      const data = err.response?.data;
      const message =
        typeof data === 'object' && data !== null
          ? String((data as Record<string, unknown>).message ?? '')
          : '';
      if (message.toLowerCase().includes('quota') || message.toLowerCase().includes('rate')) {
        return { kind: 'rate-limited' };
      }
      if (message.toLowerCase().includes('scope') || message.toLowerCase().includes('permission')) {
        return { kind: 'insufficient-scope' };
      }
      return { kind: 'rate-limited' };
    }

    if (status === 429) {
      return { kind: 'rate-limited' };
    }

    if (status !== undefined && status >= 500) {
      return { kind: 'transient-error', message: err.message ?? 'Server error' };
    }

    if (status !== undefined && status >= 400) {
      return { kind: 'permanent-error', message: err.message ?? 'Client error' };
    }
  }

  // Network failures, timeouts, etc.
  if (err instanceof Error && (err.message.includes('ECONNRESET') || err.message.includes('ETIMEDOUT') || err.message.includes('fetch failed'))) {
    return { kind: 'transient-error', message: err.message };
  }

  return { kind: 'permanent-error', message: err instanceof Error ? err.message : String(err) };
}
