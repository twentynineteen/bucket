import {
  calculateProgress,
  createQueryError,
  hasErrorType,
  inferErrorType,
  isAuthError,
  isRateLimited,
  retryStrategies,
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

    it('normalises uppercase types to the lowercase union (#240)', () => {
      // Every call site historically passed UPPERCASE ('AUTHENTICATION',
      // 'SERVER', etc.) but the validTypes array is lowercase, so the
      // explicit-type branch was never taken.
      expect(createQueryError('API key missing', 'AUTHENTICATION').type).toBe(
        'authentication'
      )
      expect(createQueryError('Internal error', 'SERVER').type).toBe('server')
      expect(createQueryError('Timed out', 'TIMEOUT').type).toBe('timeout')
      expect(createQueryError('Bad input', 'VALIDATION').type).toBe('validation')
      expect(createQueryError('IPC error', 'SYSTEM').type).toBe('system')
      expect(createQueryError('Offline', 'NETWORK').type).toBe('network')
      expect(createQueryError('Hmm', 'UNKNOWN').type).toBe('unknown')
      expect(createQueryError('Draw failed', 'CANVAS').type).toBe('canvas')
      expect(createQueryError('Keys missing', 'SETTINGS').type).toBe('settings')
    })

    it('falls through to inferErrorType for unrecognised type strings', () => {
      // Strings like 'SYSTEM_INFO', 'SETTINGS_LOAD', 'DRAW_OPERATION' are not
      // members of the QueryError['type'] union even after lowercasing. They
      // reach inferErrorType which does its best with substring matching.
      const sysInfo = createQueryError('Failed to get app version', 'SYSTEM_INFO')
      expect(sysInfo.type).toBe('system') // inferred from 'app version'

      const settingsLoad = createQueryError(
        'Failed to load API keys: permission denied',
        'SETTINGS_LOAD'
      )
      expect(settingsLoad.type).toBe('unknown') // no matching substring
    })
  })

  describe('hasErrorType', () => {
    it('returns true when the error has a matching type field', () => {
      const error = createQueryError('API key missing', 'authentication')
      expect(hasErrorType(error, 'authentication')).toBe(true)
    })

    it('returns false for a plain Error without a type field', () => {
      expect(hasErrorType(new Error('something broke'), 'authentication')).toBe(false)
    })

    it('returns false for a bare string', () => {
      expect(hasErrorType('auth failure', 'authentication')).toBe(false)
    })

    it('returns false when the type does not match', () => {
      const error = createQueryError('server error', 'server')
      expect(hasErrorType(error, 'authentication')).toBe(false)
    })
  })

  // #240: the auth strategy could never fire because its condition grepped the
  // error message for 'auth', while createQueryError stores the category in a
  // typed field and never in the message.
  describe('auth strategy fires for typed errors (#240)', () => {
    it('fires for a type-authentication error whose message has no auth substring', () => {
      // The exact shape raised by useTrelloBoard: 'API key or token missing'
      // contains no 'auth' substring, so the pre-#240 condition was false.
      const error = createQueryError('API key or token missing', 'authentication')
      expect(shouldRetry(error, 0, 'auth')).toBe(true)
    })

    it('fires for an UPPERCASE type string (normalised by createQueryError)', () => {
      const error = createQueryError('API key or token missing', 'AUTHENTICATION')
      expect(shouldRetry(error, 0, 'auth')).toBe(true)
    })

    it('still fires for a plain message containing auth', () => {
      // Fallback path: untyped errors are matched by message as before.
      expect(shouldRetry('auth token expired', 0, 'auth')).toBe(true)
    })

    it('does not fire for an error with a different type', () => {
      const error = createQueryError('server crashed', 'server')
      expect(shouldRetry(error, 0, 'auth')).toBe(false)
    })

    it('reads the typed field, not the message', () => {
      // The condition must check the type, not the message. An error with type
      // 'system' whose message coincidentally contains 'auth' must NOT match.
      const error = { type: 'system', message: 'auth proxy restart', retryable: false }
      expect(retryStrategies.auth.condition(error)).toBe(false)
    })
  })

  describe('system strategy fires for typed errors (#240)', () => {
    it('fires for a type-system error whose message has no system substring', () => {
      const error = createQueryError('Failed to fetch username: IPC error', 'system')
      expect(shouldRetry(error, 0, 'system')).toBe(true)
    })

    it('still fires for a plain message containing system', () => {
      expect(shouldRetry('system configuration error', 0, 'system')).toBe(true)
    })
  })

  describe('server strategy fires for typed errors (#240)', () => {
    it('fires for a type-server error whose message has no server substring', () => {
      const error = createQueryError('Internal processing failed', 'server')
      expect(shouldRetry(error, 0, 'server')).toBe(true)
    })

    it('still checks httpStatus first', () => {
      expect(shouldRetry({ status: 503, message: 'bad gateway' }, 0, 'server')).toBe(true)
    })
  })

  // #252: the canvas strategy could never fire because its condition grepped the
  // error message for 'canvas' or 'render', while usePosterframeAutoRedraw throws
  // 'Failed to draw posterframe: ...' which contains neither substring. The typed
  // field was 'DRAW_OPERATION', not a union member, so it resolved to 'unknown'.
  describe('canvas strategy fires for typed errors (#252)', () => {
    it('fires for a type-canvas error whose message has no canvas/render substring', () => {
      // The exact shape raised by usePosterframeAutoRedraw after the fix:
      // 'Failed to draw posterframe: ...' contains neither 'canvas' nor 'render'.
      const error = createQueryError('Failed to draw posterframe: timeout', 'canvas')
      expect(shouldRetry(error, 0, 'canvas')).toBe(true)
    })

    it('fires for an UPPERCASE type string (normalised by createQueryError)', () => {
      const error = createQueryError('Failed to draw posterframe: timeout', 'CANVAS')
      expect(shouldRetry(error, 0, 'canvas')).toBe(true)
    })

    it('still fires for a plain message containing canvas', () => {
      // Fallback path: untyped errors are matched by message as before.
      expect(shouldRetry('canvas context lost', 0, 'canvas')).toBe(true)
    })

    it('still fires for a plain message containing render', () => {
      expect(shouldRetry('render pipeline failed', 0, 'canvas')).toBe(true)
    })

    it('does not fire for an error with a different type', () => {
      const error = createQueryError('server crashed', 'server')
      expect(shouldRetry(error, 0, 'canvas')).toBe(false)
    })

    it('reads the typed field, not the message', () => {
      // An error with type 'server' whose message coincidentally contains
      // 'canvas' must NOT match the canvas strategy.
      const error = { type: 'server', message: 'canvas proxy down', retryable: false }
      expect(retryStrategies.canvas.condition(error)).toBe(false)
    })

    it('respects the attempt budget (2 attempts)', () => {
      const error = createQueryError('Failed to draw posterframe: timeout', 'canvas')
      expect(shouldRetry(error, 0, 'canvas')).toBe(true)
      expect(shouldRetry(error, 1, 'canvas')).toBe(true)
      expect(shouldRetry(error, 2, 'canvas')).toBe(false)
    })
  })

  // #253: the settings strategy could never fire because its condition grepped the
  // error message for 'read' or 'parse', while both consumers throw
  // 'Failed to load API keys: ...' which contains neither substring. The typed
  // field was 'SETTINGS_LOAD', not a union member, so it resolved to 'unknown'.
  describe('settings strategy fires for typed errors (#253)', () => {
    it('fires for a type-settings error whose message has no read/parse substring', () => {
      // The exact shape raised by SettingsPage and prefetchApiKeys after the fix:
      // 'Failed to load API keys: ...' contains neither 'read' nor 'parse'.
      const error = createQueryError(
        'Failed to load API keys: permission denied',
        'settings'
      )
      expect(shouldRetry(error, 0, 'settings')).toBe(true)
    })

    it('fires for an UPPERCASE type string (normalised by createQueryError)', () => {
      const error = createQueryError(
        'Failed to load API keys: permission denied',
        'SETTINGS'
      )
      expect(shouldRetry(error, 0, 'settings')).toBe(true)
    })

    it('still fires for a plain message containing read', () => {
      // Fallback path: untyped errors are matched by message as before.
      expect(shouldRetry('failed to read config file', 0, 'settings')).toBe(true)
    })

    it('still fires for a plain message containing parse', () => {
      expect(shouldRetry('could not parse JSON', 0, 'settings')).toBe(true)
    })

    it('does not fire for an error with a different type', () => {
      const error = createQueryError('network down', 'network')
      expect(shouldRetry(error, 0, 'settings')).toBe(false)
    })

    it('reads the typed field, not the message', () => {
      // An error with type 'network' whose message coincidentally contains
      // 'read' must NOT match the settings strategy.
      const error = {
        type: 'network',
        message: 'read timeout on socket',
        retryable: false
      }
      expect(retryStrategies.settings.condition(error)).toBe(false)
    })

    it('respects the attempt budget (1 attempt)', () => {
      const error = createQueryError(
        'Failed to load API keys: permission denied',
        'settings'
      )
      expect(shouldRetry(error, 0, 'settings')).toBe(true)
      expect(shouldRetry(error, 1, 'settings')).toBe(false)
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
