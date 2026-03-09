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
  ProgressTracker,
  UserFeedbackService,
  createCacheInvalidationService,
  getCacheService,
  initializeCacheService,
  useCacheInvalidation,
  type FeedbackOptions,
  type NotificationAction,
  type NotificationConfig,
  type ProgressFilter,
  type ProgressSubscription,
  type ProgressSummary,
  type ProgressUpdate,
  type UserPrompt
} from '../index'

// Mock logger to prevent console output during tests
vi.mock('@shared/utils/logger', () => ({
  logger: {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    info: vi.fn()
  }
}))

describe('Services Barrel Exports - Shape', () => {
  it('exports ProgressTracker as a class constructor', () => {
    expect(typeof ProgressTracker).toBe('function')
    expect(new ProgressTracker()).toBeInstanceOf(ProgressTracker)
  })

  it('exports UserFeedbackService as a class constructor', () => {
    expect(typeof UserFeedbackService).toBe('function')
    const tracker = new ProgressTracker()
    expect(new UserFeedbackService(tracker)).toBeInstanceOf(UserFeedbackService)
  })

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

  it('exports all expected type interfaces (compile-time check)', () => {
    // These are type-only exports; this test verifies the barrel
    // re-exports them without error at import time.
    // The imports at the top of this file serve as the actual check.
    const typeCheckFn = (): void => {
      const _update: ProgressUpdate = {} as ProgressUpdate
      const _sub: ProgressSubscription = {} as ProgressSubscription
      const _filter: ProgressFilter = {} as ProgressFilter
      const _summary: ProgressSummary = {} as ProgressSummary
      const _opts: FeedbackOptions = {} as FeedbackOptions
      const _prompt: UserPrompt = {} as UserPrompt
      const _notif: NotificationConfig = {} as NotificationConfig
      const _action: NotificationAction = {} as NotificationAction
      void [_update, _sub, _filter, _summary, _opts, _prompt, _notif, _action]
    }
    expect(typeCheckFn).not.toThrow()
  })
})

describe('ProgressTracker - Behavior', () => {
  let tracker: ProgressTracker

  beforeEach(() => {
    tracker = new ProgressTracker()
  })

  it('can start tracking', () => {
    expect(() => tracker.startTracking()).not.toThrow()
  })

  it('can update progress and get summary', () => {
    tracker.startTracking()
    tracker.updateProgress({
      phase: 'initialization',
      step: 'start',
      message: 'Starting...',
      progress: 50,
      total: 100
    })

    const summary = tracker.getProgressSummary()
    expect(summary).toHaveProperty('totalPhases')
    expect(summary).toHaveProperty('overallProgress')
    expect(summary).toHaveProperty('currentMessage')
    expect(summary.currentMessage).toBe('Starting...')
  })

  it('can subscribe and unsubscribe', () => {
    const callback = vi.fn()
    const subId = tracker.subscribe(callback)

    expect(typeof subId).toBe('string')
    expect(() => tracker.unsubscribe(subId)).not.toThrow()
  })

  it('notifies subscribers on progress update', () => {
    const callback = vi.fn()
    tracker.subscribe(callback)
    tracker.startTracking()

    tracker.updateProgress({
      phase: 'initialization',
      step: 'test',
      message: 'Test update'
    })

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: 'initialization',
        message: 'Test update'
      })
    )
  })

  it('getProgressHistory returns array of updates', () => {
    tracker.startTracking()
    tracker.updateProgress({
      phase: 'initialization',
      step: 'a',
      message: 'First'
    })
    tracker.updateProgress({
      phase: 'initialization',
      step: 'b',
      message: 'Second'
    })

    const history = tracker.getProgressHistory()
    expect(history).toHaveLength(2)
    expect(history[0].message).toBe('First')
    expect(history[1].message).toBe('Second')
  })
})

describe('UserFeedbackService - Behavior', () => {
  let tracker: ProgressTracker
  let service: UserFeedbackService

  beforeEach(() => {
    tracker = new ProgressTracker()
    service = new UserFeedbackService(tracker, { quietMode: true })
  })

  it('can export logs', () => {
    const logs = service.exportLogs()
    expect(Array.isArray(logs)).toBe(true)
  })

  it('can clear logs', () => {
    expect(() => service.clearLogs()).not.toThrow()
  })

  it('can update options', () => {
    expect(() => service.updateOptions({ verboseMode: true })).not.toThrow()
  })

  it('can prompt user (returns default value)', async () => {
    const result = await service.promptUser({
      id: 'test-prompt',
      message: 'Test?',
      type: 'confirmation',
      defaultValue: 'yes'
    })
    expect(result).toBe('yes')
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
