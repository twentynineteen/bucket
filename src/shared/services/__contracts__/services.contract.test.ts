/**
 * Services Contract Tests
 *
 * Verifies the shape and behavior of the shared services barrel exports.
 * These tests lock down the public API so downstream consumers
 * can rely on stable exports.
 */

import { QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  CacheInvalidationService,
  createCacheInvalidationService,
  getCacheService,
  initializeCacheService,
  useCacheInvalidation
} from '../index'

// Mock logger to prevent console output during tests
vi.mock('@shared/utils/logger', () => ({
  logger: {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    info: vi.fn()
  },
  createNamespacedLogger: vi.fn(() => ({
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    info: vi.fn()
  }))
}))

describe('Services Barrel Exports - Shape', () => {
  it('exports CacheInvalidationService as a class constructor', () => {
    expect(typeof CacheInvalidationService).toBe('function')
    const qc = new QueryClient()
    expect(new CacheInvalidationService(qc)).toBeInstanceOf(CacheInvalidationService)
  })

  it('exports createCacheInvalidationService as a factory function', () => {
    expect(typeof createCacheInvalidationService).toBe('function')
  })

  it('exports initializeCacheService as a function', () => {
    expect(typeof initializeCacheService).toBe('function')
  })

  it('exports getCacheService as a function', () => {
    expect(typeof getCacheService).toBe('function')
  })

  it('exports useCacheInvalidation as a function', () => {
    expect(typeof useCacheInvalidation).toBe('function')
  })
})

describe('CacheInvalidationService - Behavior', () => {
  let queryClient: QueryClient
  let service: CacheInvalidationService

  beforeEach(() => {
    queryClient = new QueryClient()
    service = new CacheInvalidationService(queryClient)
  })

  afterEach(() => {
    queryClient.clear()
  })

  it('createCacheInvalidationService returns an instance', () => {
    const created = createCacheInvalidationService(queryClient)
    expect(created).toBeInstanceOf(CacheInvalidationService)
  })

  it('can get cache stats', () => {
    const stats = service.getCacheStats()
    expect(stats).toHaveProperty('totalQueries')
    expect(stats).toHaveProperty('activeQueries')
    expect(stats).toHaveProperty('staleQueries')
    expect(stats).toHaveProperty('cacheSize')
  })

  it('can invalidate user data without throwing', async () => {
    await expect(service.invalidateUserData()).resolves.not.toThrow()
  })

  it('can invalidate settings without throwing', async () => {
    await expect(service.invalidateSettings()).resolves.not.toThrow()
  })

  it('can clear all cache', async () => {
    await expect(service.clearAllCache()).resolves.not.toThrow()
  })

  it('initializeCacheService and getCacheService work together', () => {
    const globalService = initializeCacheService(queryClient)
    expect(globalService).toBeInstanceOf(CacheInvalidationService)

    const retrieved = getCacheService()
    expect(retrieved).toBe(globalService)
  })
})
