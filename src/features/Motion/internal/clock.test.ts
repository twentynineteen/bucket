/**
 * Test clock tests (issue #328)
 *
 * Behaviour E7.1
 */
import { afterEach, describe, expect, it } from 'vitest'
import { readTestClock } from './clock'

/** Typed accessor for the global test clock property. */
const clockWindow = window as Window & { __BUCKET_MOTION_CLOCK__?: unknown }

describe('E7.1 test clock override', () => {
  afterEach(() => {
    delete clockWindow.__BUCKET_MOTION_CLOCK__
  })

  it('returns the numeric value when set', () => {
    clockWindow.__BUCKET_MOTION_CLOCK__ = 1.25
    expect(readTestClock()).toBe(1.25)
  })

  it('returns null when unset', () => {
    expect(readTestClock()).toBeNull()
  })

  it('returns null when set to a non-finite number', () => {
    clockWindow.__BUCKET_MOTION_CLOCK__ = NaN
    expect(readTestClock()).toBeNull()

    clockWindow.__BUCKET_MOTION_CLOCK__ = Infinity
    expect(readTestClock()).toBeNull()
  })

  it('returns null when set to a non-number', () => {
    clockWindow.__BUCKET_MOTION_CLOCK__ = 'hello'
    expect(readTestClock()).toBeNull()
  })

  it('returns 0 when set to 0 (a valid finite number)', () => {
    clockWindow.__BUCKET_MOTION_CLOCK__ = 0
    expect(readTestClock()).toBe(0)
  })
})
