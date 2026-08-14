/**
 * Contract tests for @shared/constants barrel
 *
 * Verifies export shape and behavioral contracts for timing,
 * animation, and project constants.
 */

import { describe, expect, test } from 'vitest'

import {
  // Timing
  SECONDS,
  MINUTES,
  HOURS,
  TIMEOUTS,
  RETRY,
  CACHE,
  REFRESH,
  LIMITS,
  getBackoffDelay,
  // Animations
  STEP_CARD_ANIMATION,
  FILE_LIST_ANIMATION,
  BUTTON_ANIMATIONS,
  BAKER_ANIMATIONS,
  // Project
  PROJECT_LIMITS
} from '@shared/constants'

describe('@shared/constants barrel contract', () => {
  describe('shape: all expected exports exist', () => {
    test('timing unit helpers', () => {
      expect(SECONDS).toBeDefined()
      expect(MINUTES).toBeDefined()
      expect(HOURS).toBeDefined()
    })

    test('timing constant objects', () => {
      expect(TIMEOUTS).toBeDefined()
      expect(RETRY).toBeDefined()
      expect(CACHE).toBeDefined()
      expect(REFRESH).toBeDefined()
      expect(LIMITS).toBeDefined()
    })

    test('timing helper function', () => {
      expect(getBackoffDelay).toBeTypeOf('function')
    })

    // Only the four animation exports a component reads. Twelve more were removed
    // under issue #219; this test was the only reader of four of them, which is how
    // dead exports came to look covered.
    test('animation constant objects', () => {
      expect(STEP_CARD_ANIMATION).toBeDefined()
      expect(FILE_LIST_ANIMATION).toBeDefined()
      expect(BUTTON_ANIMATIONS).toBeDefined()
      expect(BAKER_ANIMATIONS).toBeDefined()
    })

    test('project constant objects', () => {
      expect(PROJECT_LIMITS).toBeDefined()
    })
  })

  describe('behavior: timing constants have correct values', () => {
    test('time unit conversions are correct', () => {
      expect(SECONDS).toBe(1000)
      expect(MINUTES).toBe(60 * 1000)
      expect(HOURS).toBe(60 * 60 * 1000)
    })

    test('all timing values are positive numbers', () => {
      Object.entries(TIMEOUTS).forEach(([key, value]) => {
        expect(value, `TIMEOUTS.${key}`).toBeGreaterThan(0)
      })
      Object.entries(RETRY).forEach(([key, value]) => {
        expect(value, `RETRY.${key}`).toBeGreaterThan(0)
      })
      Object.entries(CACHE).forEach(([key, value]) => {
        expect(typeof value, `CACHE.${key}`).toBe('number')
        expect(value, `CACHE.${key}`).toBeGreaterThanOrEqual(0)
      })
    })

    test('RETRY has expected properties', () => {
      expect(RETRY).toHaveProperty('MAX_DELAY_DEFAULT')
      expect(RETRY).toHaveProperty('MAX_DELAY_MUTATION')
      expect(RETRY).toHaveProperty('BASE_DELAY')
      expect(RETRY).toHaveProperty('DEFAULT_ATTEMPTS')
      expect(RETRY.DEFAULT_ATTEMPTS).toBeGreaterThan(0)
    })

    test('CACHE has standard duration tiers', () => {
      expect(CACHE.REALTIME).toBe(0)
      expect(CACHE.SHORT).toBeLessThan(CACHE.BRIEF)
      expect(CACHE.BRIEF).toBeLessThan(CACHE.QUICK)
      expect(CACHE.QUICK).toBeLessThan(CACHE.STANDARD)
      expect(CACHE.STANDARD).toBeLessThan(CACHE.MEDIUM)
      expect(CACHE.MEDIUM).toBeLessThan(CACHE.LONG)
      expect(CACHE.LONG).toBeLessThan(CACHE.EXTENDED)
      expect(CACHE.EXTENDED).toBeLessThan(CACHE.PERSISTENT)
    })

    test('LIMITS has expected validation bounds', () => {
      expect(LIMITS.URL_MAX_LENGTH).toBeGreaterThan(0)
      expect(LIMITS.FILE_MAX_SIZE).toBeGreaterThan(0)
      expect(LIMITS.BATCH_MAX_FILES).toBeGreaterThan(0)
    })

    test('getBackoffDelay returns increasing delays', () => {
      const delay0 = getBackoffDelay(0)
      const delay1 = getBackoffDelay(1)
      const delay2 = getBackoffDelay(2)
      expect(delay1).toBeGreaterThan(delay0)
      expect(delay2).toBeGreaterThan(delay1)
    })

    test('getBackoffDelay respects max delay', () => {
      const maxDelay = 5000
      const delay = getBackoffDelay(100, maxDelay)
      expect(delay).toBeLessThanOrEqual(maxDelay)
    })
  })

  describe('behavior: animation constants have correct shapes', () => {
    test('STEP_CARD_ANIMATION has expected properties', () => {
      expect(STEP_CARD_ANIMATION).toHaveProperty('collapsedHeight')
      expect(STEP_CARD_ANIMATION).toHaveProperty('expandedHeight')
      expect(STEP_CARD_ANIMATION).toHaveProperty('duration')
      expect(STEP_CARD_ANIMATION).toHaveProperty('easing')
    })

    test('FILE_LIST_ANIMATION has stagger variants', () => {
      expect(FILE_LIST_ANIMATION).toHaveProperty('container')
      expect(FILE_LIST_ANIMATION).toHaveProperty('item')
      expect(FILE_LIST_ANIMATION).toHaveProperty('staggerDelay')
      expect(FILE_LIST_ANIMATION.staggerDelay).toBeGreaterThan(0)
    })

    // The two keys ProjectListPanel reads. `projectRow` and `detailPanel` went with
    // the other unread keys under issue #219.
    test('BAKER_ANIMATIONS has project-specific animations', () => {
      expect(BAKER_ANIMATIONS).toHaveProperty('projectList')
      expect(BAKER_ANIMATIONS).toHaveProperty('statusBadge')
    })
  })

  describe('behavior: project constants have correct values', () => {
    test('PROJECT_LIMITS has camera constraints', () => {
      // 0 cameras is a legitimate project (podcast/audio-only) — see issue #138
      expect(PROJECT_LIMITS.MIN_CAMERAS).toBe(0)
      expect(PROJECT_LIMITS.MAX_CAMERAS).toBeGreaterThan(PROJECT_LIMITS.MIN_CAMERAS)
      expect(PROJECT_LIMITS.DEFAULT_CAMERAS).toBeGreaterThanOrEqual(1)
      expect(PROJECT_LIMITS.DEFAULT_CAMERAS).toBeLessThanOrEqual(
        PROJECT_LIMITS.MAX_CAMERAS
      )
    })
  })
})
