/**
 * Contract tests for @shared/lib barrel
 *
 * Verifies export shape and behavioral contracts for query infrastructure.
 * Note: Imports from specific sub-modules to avoid Tauri runtime dependencies
 * in query-client-config and prefetch-strategies.
 */

import { describe, expect, test } from 'vitest'

// Import from sub-modules that don't require Tauri runtime
import {
  queryKeys,
  invalidationRules,
  createQueryKey,
  isQueryKeyMatch,
  getInvalidationQueries,
  validateQueryKey,
  createPaginatedQueryKey,
  createTimeRangeQueryKey,
  createUserScopedQueryKey
} from '@shared/lib/query-keys'

import {
  QUERY_PROFILES,
  createQueryOptions,
  createMutationOptions,
  retryStrategies,
  shouldRetry,
  getRetryDelay,
  inferErrorType,
  createQueryError,
  calculateProgress
} from '@shared/lib/query-utils'

describe('@shared/lib barrel contract', () => {
  describe('shape: all expected exports exist', () => {
    test('query-keys exports', () => {
      expect(queryKeys).toBeDefined()
      expect(invalidationRules).toBeDefined()
      expect(createQueryKey).toBeTypeOf('function')
      expect(isQueryKeyMatch).toBeTypeOf('function')
      expect(getInvalidationQueries).toBeTypeOf('function')
      expect(validateQueryKey).toBeTypeOf('function')
      expect(createPaginatedQueryKey).toBeTypeOf('function')
      expect(createTimeRangeQueryKey).toBeTypeOf('function')
      expect(createUserScopedQueryKey).toBeTypeOf('function')
    })

    test('query-utils exports', () => {
      expect(QUERY_PROFILES).toBeDefined()
      expect(createQueryOptions).toBeTypeOf('function')
      expect(createMutationOptions).toBeTypeOf('function')
      expect(retryStrategies).toBeDefined()
      expect(shouldRetry).toBeTypeOf('function')
      expect(getRetryDelay).toBeTypeOf('function')
      expect(inferErrorType).toBeTypeOf('function')
      expect(createQueryError).toBeTypeOf('function')
      expect(calculateProgress).toBeTypeOf('function')
    })

    // Note: barrel index.ts cannot be tested directly because it re-exports
    // query-client-config.ts which depends on @tauri-apps/plugin-store (native runtime).
    // Shape verification is done via sub-module imports above.
  })

  describe('behavior: query-keys factory', () => {
    test('produces expected key structures for all domains', () => {
      expect(queryKeys.projects.all).toEqual(['projects'])
      expect(queryKeys.projects.lists()).toEqual(['projects', 'list'])
      expect(queryKeys.projects.detail('123')).toEqual(['projects', 'detail', '123'])
      expect(queryKeys.sprout.all).toEqual(['sprout'])
      expect(queryKeys.trello.card('abc')).toEqual(['trello', 'card', 'abc'])
      expect(queryKeys.user.profile()).toEqual(['user', 'profile'])
      expect(queryKeys.settings.apiKeys()).toEqual(['settings', 'api-keys'])
      expect(queryKeys.files.tree('/path')).toEqual(['files', 'tree', '/path'])
      expect(queryKeys.camera.all).toEqual(['camera'])
      expect(queryKeys.images.all).toEqual(['images'])
      expect(queryKeys.upload.all).toEqual(['upload'])
    })

    test('invalidationRules is a non-empty array with valid entries', () => {
      expect(Array.isArray(invalidationRules)).toBe(true)
      expect(invalidationRules.length).toBeGreaterThan(0)
      invalidationRules.forEach((rule) => {
        expect(rule).toHaveProperty('trigger')
        expect(rule).toHaveProperty('invalidates')
        expect(rule).toHaveProperty('strategy')
        expect(['exact', 'prefix', 'predicate']).toContain(rule.strategy)
      })
    })

    test('createQueryKey returns the key as-is', () => {
      const key = ['projects', 'list'] as const
      expect(createQueryKey(key)).toBe(key)
    })

    test('isQueryKeyMatch handles exact strategy', () => {
      expect(isQueryKeyMatch(['projects', 'list'], ['projects', 'list'], 'exact')).toBe(
        true
      )
      expect(isQueryKeyMatch(['projects', 'list'], ['projects'], 'exact')).toBe(false)
    })

    test('isQueryKeyMatch handles prefix strategy', () => {
      expect(isQueryKeyMatch(['projects', 'list'], ['projects'], 'prefix')).toBe(true)
      expect(isQueryKeyMatch(['projects'], ['projects', 'list'], 'prefix')).toBe(false)
    })

    test('validateQueryKey validates structure', () => {
      expect(validateQueryKey(['projects', 'list'])).toBe(true)
      expect(validateQueryKey(['projects', 'list', '123'])).toBe(true)
      expect(validateQueryKey(['invalid-domain', 'list'])).toBe(false)
      expect(validateQueryKey([])).toBe(false)
      expect(validateQueryKey(['projects'])).toBe(false)
    })

    test('getInvalidationQueries returns matching rules', () => {
      const queries = getInvalidationQueries(['projects', 'create'])
      expect(Array.isArray(queries)).toBe(true)
    })

    test('createPaginatedQueryKey extends base key', () => {
      const key = createPaginatedQueryKey(['projects', 'list'], 1, 20)
      expect(key.length).toBeGreaterThan(2)
    })

    test('createTimeRangeQueryKey extends base key', () => {
      const key = createTimeRangeQueryKey(
        ['projects', 'list'],
        '2024-01-01',
        '2024-12-31'
      )
      expect(key.length).toBeGreaterThan(2)
    })

    test('createUserScopedQueryKey extends base key with user', () => {
      const key = createUserScopedQueryKey(['projects', 'list'], 'user1')
      expect(key).toContain('user')
      expect(key).toContain('user1')
    })
  })

  describe('behavior: query-utils', () => {
    test('QUERY_PROFILES has expected profiles', () => {
      expect(QUERY_PROFILES).toHaveProperty('STATIC')
      expect(QUERY_PROFILES).toHaveProperty('DYNAMIC')
      expect(QUERY_PROFILES).toHaveProperty('REALTIME')
      expect(QUERY_PROFILES).toHaveProperty('EXTERNAL')
      expect(QUERY_PROFILES.REALTIME.staleTime).toBeLessThan(
        QUERY_PROFILES.STATIC.staleTime
      )
    })

    test('inferErrorType categorizes errors correctly', () => {
      expect(inferErrorType('network connection failed')).toBe('network')
      expect(inferErrorType('request timeout')).toBe('timeout')
      expect(inferErrorType('unauthorized access')).toBe('authentication')
      expect(inferErrorType('server internal error')).toBe('server')
      expect(inferErrorType('validation failed')).toBe('validation')
      expect(inferErrorType('system error')).toBe('system')
      expect(inferErrorType('something random')).toBe('unknown')
    })

    test('createQueryError returns well-formed error object', () => {
      const error = createQueryError('test error', 'network', 500)
      expect(error).toEqual({
        type: 'network',
        message: 'test error',
        code: 500,
        retryable: true,
        context: undefined
      })
    })

    test('createQueryError marks validation errors as non-retryable', () => {
      const error = createQueryError('invalid input', 'validation')
      expect(error.retryable).toBe(false)
    })

    test('calculateProgress computes correct percentages', () => {
      expect(calculateProgress(5, 10)).toEqual({
        total: 10,
        completed: 5,
        percentage: 50
      })
      expect(calculateProgress(0, 10)).toEqual({ total: 10, completed: 0, percentage: 0 })
      expect(calculateProgress(10, 10)).toEqual({
        total: 10,
        completed: 10,
        percentage: 100
      })
      expect(calculateProgress(0, 0)).toEqual({ total: 0, completed: 0, percentage: 0 })
    })

    test('retryStrategies has expected strategies', () => {
      expect(retryStrategies).toHaveProperty('network')
      expect(retryStrategies).toHaveProperty('server')
      expect(retryStrategies).toHaveProperty('validation')
      expect(retryStrategies).toHaveProperty('auth')
      expect(retryStrategies).toHaveProperty('trello')
      expect(retryStrategies).toHaveProperty('sprout')
      expect(retryStrategies.network.attempts).toBeGreaterThan(0)
      expect(retryStrategies.validation.attempts).toBe(0)
    })

    test('shouldRetry respects strategy limits', () => {
      const networkError = new Error('network failure')
      networkError.name = 'NetworkError'
      expect(shouldRetry(networkError, 0, 'network')).toBe(true)
      expect(shouldRetry(new Error('random'), 0, 'validation')).toBe(false)
    })
  })
})
