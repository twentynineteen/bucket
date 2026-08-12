import {
  calculateProgress,
  createQueryError,
  inferErrorType,
  isAuthError,
  isRateLimited,
  shouldRetry,
  shouldRetryRequest
} from '@shared/lib/query-utils'
import { describe, expect, it } from 'vitest'

describe('Query Utils', () => {
  // Tauri commands returning `Err(String)` reject with a bare string, so every
  // predicate below is fed one. Anything gated on `instanceof Error` misses the
  // entire backend, which is the defect in #156.
  describe('isRateLimited', () => {
    it('recognises a bare-string 429 from a Tauri command', () => {
      expect(
        isRateLimited(
          'Sprout rate limit reached (HTTP 429). Try again in 30 seconds. The limit is 200 requests per minute across your whole account.'
        )
      ).toBe(true)
    })

    it('recognises a rate limit named in prose without a status code', () => {
      expect(isRateLimited('Too many requests')).toBe(true)
    })

    it('reads a numeric status field, not only the message', () => {
      // `PosterFrameError` rejects with `{ status, message }`, so the status
      // never appears in the message text. Reading only the text would
      // reproduce #156 one layer down.
      expect(isRateLimited({ status: 429, message: 'Rate limited by Sprout' })).toBe(true)
    })

    it('does not treat other failures as rate limits', () => {
      expect(isRateLimited('Sprout returned HTTP 503 Service Unavailable')).toBe(false)
      expect(isRateLimited(new Error('Connection reset'))).toBe(false)
      expect(isRateLimited({ status: 500, message: 'Sprout is unwell' })).toBe(false)
    })
  })

  describe('isAuthError', () => {
    it('recognises bare-string 401 and 403 rejections', () => {
      expect(
        isAuthError(
          'Sprout rejected the folder request: HTTP 401 — check your Sprout Video API key in Settings.'
        )
      ).toBe(true)
      expect(
        isAuthError('Sprout rejected the folder request: HTTP 403 — forbidden')
      ).toBe(true)
    })

    it('does not treat a server error as an auth failure', () => {
      expect(isAuthError('Sprout returned HTTP 500')).toBe(false)
    })
  })

  describe('shouldRetryRequest', () => {
    // The three acceptance criteria of #156.
    it('never retries a bare-string 429', () => {
      const error = 'Sprout rate limit reached (HTTP 429).'
      expect(shouldRetryRequest(error, 0)).toBe(false)
    })

    it('never retries a bare-string 401 or 403', () => {
      expect(shouldRetryRequest('Sprout rejected the request: HTTP 401', 0)).toBe(false)
      expect(shouldRetryRequest('Sprout rejected the request: HTTP 403', 0)).toBe(false)
    })

    it('retries a bare-string 503', () => {
      expect(shouldRetryRequest('Sprout returned HTTP 503', 0)).toBe(true)
    })

    it('retries a 5xx whose message happens to contain the digit 4', () => {
      // The old predicate blocked this: `message.includes('4')` matched the
      // character, not the status.
      expect(shouldRetryRequest('HTTP 500 — timed out after 4 seconds', 0)).toBe(true)
    })

    it('never retries a rate limit or auth failure named only in prose', () => {
      // No status code to fall back on, so these depend on the named guards
      // rather than the generic 4xx branch.
      expect(shouldRetryRequest('Too many requests', 0)).toBe(false)
      expect(shouldRetryRequest('Unauthorized', 0)).toBe(false)
      expect(shouldRetryRequest('Sprout rate limit reached', 0)).toBe(false)
    })

    it('retries transport failures that name no status', () => {
      expect(shouldRetryRequest('Connection reset', 0)).toBe(true)
      expect(shouldRetryRequest(new Error('Failed to create HTTP client'), 0)).toBe(true)
    })

    it('does not retry a 4xx that is neither auth nor rate limit', () => {
      expect(
        shouldRetryRequest('Sprout rejected the upload: HTTP 413 — too large', 0)
      ).toBe(false)
    })

    it('reads a numeric status field on a structured rejection', () => {
      // The shape `PosterFrameError` rejects with.
      expect(shouldRetryRequest({ status: 413, message: 'Image too large' }, 0)).toBe(
        false
      )
      expect(shouldRetryRequest({ status: 503, message: 'Sprout is unwell' }, 0)).toBe(
        true
      )
      expect(shouldRetryRequest({ status: null, message: 'Connection reset' }, 0)).toBe(
        true
      )
    })

    it('stops once the attempt budget is spent', () => {
      expect(shouldRetryRequest('HTTP 503', 2)).toBe(true)
      expect(shouldRetryRequest('HTTP 503', 3)).toBe(false)
    })

    it('honours an explicit attempt budget', () => {
      expect(shouldRetryRequest('HTTP 503', 1, 2)).toBe(true)
      expect(shouldRetryRequest('HTTP 503', 2, 2)).toBe(false)
    })

    it('refuses a rate limit even when attempts remain', () => {
      expect(shouldRetryRequest('HTTP 429', 0, 10)).toBe(false)
    })
  })

  describe('shouldRetry', () => {
    it('does not throw on a bare-string rejection', () => {
      // Every strategy condition read `error.message`, which is undefined on a
      // string -- so `.includes()` threw inside React Query's retryer.
      expect(() =>
        shouldRetry('Failed to load network config', 0, 'external')
      ).not.toThrow()
    })

    it('classifies a bare-string network failure as retryable', () => {
      expect(shouldRetry('network request failed', 0, 'external')).toBe(true)
    })

    it('never retries a rate limit, whatever the strategy says', () => {
      expect(shouldRetry('Sprout rate limit reached (HTTP 429).', 0, 'external')).toBe(
        false
      )
      expect(shouldRetry('Sprout rate limit reached (HTTP 429).', 0, 'trello')).toBe(
        false
      )
    })
  })

  describe('inferErrorType', () => {
    it('should infer network errors correctly', () => {
      expect(inferErrorType('Network connection failed')).toBe('network')
      expect(inferErrorType('Connection timeout')).toBe('network')
    })

    it('should infer authentication errors correctly', () => {
      expect(inferErrorType('Unauthorized access')).toBe('authentication')
      expect(inferErrorType('Auth token expired')).toBe('authentication')
    })

    it('should infer system errors correctly', () => {
      expect(inferErrorType('Failed to get app version')).toBe('system')
      expect(inferErrorType('System configuration error')).toBe('system')
    })

    it('should default to unknown for unrecognized patterns', () => {
      expect(inferErrorType('Something weird happened')).toBe('unknown')
    })
  })

  describe('createQueryError', () => {
    it('should create error with inferred type', () => {
      const error = createQueryError('Network connection failed')

      expect(error.type).toBe('network')
      expect(error.message).toBe('Network connection failed')
      expect(error.retryable).toBe(true)
    })

    it('should create error with explicit type', () => {
      const error = createQueryError('Custom error', 'validation')

      expect(error.type).toBe('validation')
      expect(error.message).toBe('Custom error')
      expect(error.retryable).toBe(false)
    })

    it('should handle non-retryable error types', () => {
      const error = createQueryError('Bad request', 'validation')
      expect(error.retryable).toBe(false)
    })

    it('should handle retryable error types', () => {
      const error = createQueryError('Server error', 'server')
      expect(error.retryable).toBe(true)
    })
  })

  describe('calculateProgress', () => {
    it('should calculate progress correctly', () => {
      const progress = calculateProgress(25, 100)

      expect(progress.completed).toBe(25)
      expect(progress.total).toBe(100)
      expect(progress.percentage).toBe(25)
    })

    it('should handle zero total', () => {
      const progress = calculateProgress(0, 0)
      expect(progress.percentage).toBe(0)
    })

    it('should handle completion', () => {
      const progress = calculateProgress(100, 100)
      expect(progress.percentage).toBe(100)
    })

    it('should round percentage correctly', () => {
      const progress = calculateProgress(33, 100)
      expect(progress.percentage).toBe(33)
    })
  })
})
