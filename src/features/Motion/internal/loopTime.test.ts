/**
 * Loop time tests (issue #335)
 */
import { describe, expect, it } from 'vitest'
import { loopTime } from './loopTime'

describe('loopTime', () => {
  const DURATION = 4 // 4 second template

  // P3.1: basic loop cycle
  it('p3_1_returns_template_time_during_playback', () => {
    // elapsed 1.5s -> template time 1.5s (inside the animation)
    expect(loopTime(1.5, DURATION)).toBeCloseTo(1.5)
  })

  it('p3_1_returns_null_during_gap', () => {
    // elapsed 4.2s: duration is 4s, so 4.2 is inside the 0.5s gap
    expect(loopTime(4.2, DURATION)).toBeNull()
  })

  it('p3_1_loops_after_gap', () => {
    // period = 4 + 0.5 = 4.5s
    // elapsed 4.6s -> 4.6 - 4.5 = 0.1s into the next loop
    expect(loopTime(4.6, DURATION)).toBeCloseTo(0.1)
  })

  // P3.2: hold extends the period
  it('p3_2_hold_extends_period', () => {
    // With hold=2 longer, duration becomes 6, period = 6.5
    const extendedDuration = DURATION + 2 // 6s
    // elapsed 5.5 is still inside the animation (< 6)
    expect(loopTime(5.5, extendedDuration)).toBeCloseTo(5.5)

    // elapsed 6.2 is in the gap (6 < 6.2 < 6.5)
    expect(loopTime(6.2, extendedDuration)).toBeNull()

    // elapsed 6.8 -> 6.8 - 6.5 = 0.3s into next loop
    expect(loopTime(6.8, extendedDuration)).toBeCloseTo(0.3)
  })

  it('handles_elapsed_zero', () => {
    expect(loopTime(0, DURATION)).toBeCloseTo(0)
  })

  it('handles_elapsed_at_exact_duration', () => {
    // Right at the boundary of animation/gap. Duration=4, so t=4 is just at the gap start.
    // This should return null since t >= duration means we're in the gap.
    expect(loopTime(DURATION, DURATION)).toBeNull()
  })
})
