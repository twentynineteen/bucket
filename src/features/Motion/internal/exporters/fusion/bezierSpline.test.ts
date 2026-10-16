/**
 * BezierSpline keyframe conversion tests (issue #330)
 *
 * RES3.1: specific segment conversion at 50 fps
 * RES3.2: specific segment conversion at 25 fps
 */
import { describe, expect, it } from 'vitest'
import type { Keyframe } from '../../../types'
import { computeLH, computeRH, toFusionKeyframes } from './bezierSpline'

// ---------------------------------------------------------------------------
// RES3.1
// ---------------------------------------------------------------------------

describe('RES3.1: segment (0s,0) to (0.5s,1) at 50fps with [0.16,1,0.3,1]', () => {
  const keyframes: Keyframe<number>[] = [
    { t: 0, value: 0, ease: [0.16, 1, 0.3, 1] },
    { t: 0.5, value: 1 }
  ]

  it('maps to frames 0 and 25', () => {
    const result = toFusionKeyframes(keyframes, 50)
    expect(result[0].frame).toBe(0)
    expect(result[1].frame).toBe(25)
  })

  it('first key RH is (4, 1)', () => {
    // RH = (t0 + x1*dt, v0 + y1*dv) = (0 + 0.16*25, 0 + 1*1) = (4, 1)
    const result = toFusionKeyframes(keyframes, 50)
    expect(result[0].rh).toBeDefined()
    expect(result[0].rh!.time).toBe(4)
    expect(result[0].rh!.value).toBe(1)
  })

  it('second key LH is (7.5, 1)', () => {
    // LH = (t1 - (1-x2)*dt, v1 - (1-y2)*dv) = (25 - 0.7*25, 1 - 0*1) = (7.5, 1)
    const result = toFusionKeyframes(keyframes, 50)
    expect(result[1].lh).toBeDefined()
    expect(result[1].lh!.time).toBe(7.5)
    expect(result[1].lh!.value).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// RES3.2
// ---------------------------------------------------------------------------

describe('RES3.2: segment (1s,10) to (2s,30) at 25fps with [0.25,0.1,0.25,1]', () => {
  const keyframes: Keyframe<number>[] = [
    { t: 1, value: 10, ease: [0.25, 0.1, 0.25, 1] },
    { t: 2, value: 30 }
  ]

  it('maps to frames 25 and 50', () => {
    const result = toFusionKeyframes(keyframes, 25)
    expect(result[0].frame).toBe(25)
    expect(result[1].frame).toBe(50)
  })

  it('first key RH is (31.25, 12)', () => {
    // RH = (t0 + x1*dt, v0 + y1*dv) = (25 + 0.25*25, 10 + 0.1*20) = (31.25, 12)
    const result = toFusionKeyframes(keyframes, 25)
    expect(result[0].rh).toBeDefined()
    expect(result[0].rh!.time).toBe(31.25)
    expect(result[0].rh!.value).toBe(12)
  })

  it('second key LH is (31.25, 30)', () => {
    // LH = (t1 - (1-x2)*dt, v1 - (1-y2)*dv) = (50 - 0.75*25, 30 - 0*20) = (31.25, 30)
    const result = toFusionKeyframes(keyframes, 25)
    expect(result[1].lh).toBeDefined()
    expect(result[1].lh!.time).toBe(31.25)
    expect(result[1].lh!.value).toBe(30)
  })
})

// ---------------------------------------------------------------------------
// Standalone handle computation
// ---------------------------------------------------------------------------

describe('computeRH / computeLH', () => {
  it('computes RH for RES3.1 example', () => {
    const rh = computeRH(0, 0, 25, 1, [0.16, 1, 0.3, 1])
    expect(rh.time).toBe(4)
    expect(rh.value).toBe(1)
  })

  it('computes LH for RES3.1 example', () => {
    const lh = computeLH(0, 0, 25, 1, [0.16, 1, 0.3, 1])
    expect(lh.time).toBe(7.5)
    expect(lh.value).toBe(1)
  })
})
