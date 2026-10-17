/**
 * Tests for AE KeyframeEase mapping (issue #329)
 *
 * Behaviours: AE3.1, AE3.2
 */
import { describe, expect, it } from 'vitest'
import type { Ease } from '../../../types'
import { EASE_DIMENSIONS, mapEase } from './aeEase'

// ---------------------------------------------------------------------------
// AE3.1 - Standard ease mapping
// ---------------------------------------------------------------------------

describe('AE3.1 - opacity segment ease mapping', () => {
  it('maps [0.16, 1, 0.3, 1] with delta 200 to the expected influence and speed', () => {
    // Opacity 0 to 1 (AE 0 to 100) over 0.5s: delta = (100 - 0) / 0.5 = 200
    const ease: Ease = [0.16, 1, 0.3, 1]
    const delta = 200

    const result = mapEase(ease, delta, 1)

    // Outgoing: influence = x1 * 100 = 16, speed = (y1/x1) * delta = (1/0.16)*200 = 1250
    expect(result.outgoing).toHaveLength(1)
    expect(result.outgoing[0].influence).toBeCloseTo(16, 5)
    expect(result.outgoing[0].speed).toBeCloseTo(1250, 5)

    // Incoming: influence = (1-x2)*100 = 70, speed = ((1-y2)/(1-x2))*delta = (0/0.7)*200 = 0
    expect(result.incoming).toHaveLength(1)
    expect(result.incoming[0].influence).toBeCloseTo(70, 5)
    expect(result.incoming[0].speed).toBeCloseTo(0, 5)
  })
})

// ---------------------------------------------------------------------------
// AE3.2 - Edge cases: clamping
// ---------------------------------------------------------------------------

describe('AE3.2 - clamping edge cases', () => {
  it('clamps x1=0 to influence 0.1, speed uses clamped x1=0.001', () => {
    const ease: Ease = [0, 0.5, 0.5, 1]
    const delta = 100

    const result = mapEase(ease, delta, 1)

    expect(result.outgoing[0].influence).toBeCloseTo(0.1, 5)
    // speed = (y1 / 0.001) * delta = (0.5 / 0.001) * 100 = 50000
    expect(result.outgoing[0].speed).toBeCloseTo(50000, 0)
  })

  it('clamps x2=1 to incoming influence using 1-x2=0.001', () => {
    const ease: Ease = [0.5, 0, 1, 0.5]
    const delta = 100

    const result = mapEase(ease, delta, 1)

    // Incoming: influence = (1-1)*100 clamped to 0.1, speed = ((1-0.5)/0.001)*100 = 50000
    expect(result.incoming[0].influence).toBeCloseTo(0.1, 5)
    expect(result.incoming[0].speed).toBeCloseTo(50000, 0)
  })

  it('clamps x1=1 to influence 100', () => {
    const ease: Ease = [1, 1, 0.5, 0.5]
    const delta = 100

    const result = mapEase(ease, delta, 1)
    expect(result.outgoing[0].influence).toBeCloseTo(100, 5)
  })

  it('produces the correct number of ease objects for multi-dimensional properties', () => {
    const ease: Ease = [0.16, 1, 0.3, 1]
    const delta = 200

    const result3 = mapEase(ease, delta, 3) // Scale
    expect(result3.outgoing).toHaveLength(3)
    expect(result3.incoming).toHaveLength(3)

    const result1 = mapEase(ease, delta, 1) // Opacity
    expect(result1.outgoing).toHaveLength(1)
    expect(result1.incoming).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// EASE_DIMENSIONS
// ---------------------------------------------------------------------------

describe('EASE_DIMENSIONS table', () => {
  it('has Scale = 3', () => {
    expect(EASE_DIMENSIONS['Scale']).toBe(3)
  })

  it('has Position = 1 (unseparated)', () => {
    expect(EASE_DIMENSIONS['Position']).toBe(1)
  })

  it('has Opacity = 1', () => {
    expect(EASE_DIMENSIONS['Opacity']).toBe(1)
  })

  it('has Rotation = 1', () => {
    expect(EASE_DIMENSIONS['Rotation']).toBe(1)
  })

  it('has Fill Color = 1', () => {
    expect(EASE_DIMENSIONS['Fill Color']).toBe(1)
  })

  it('has Rectangle Size = 1', () => {
    expect(EASE_DIMENSIONS['Rectangle Size']).toBe(1)
  })

  it('has Tracking Amount = 1', () => {
    expect(EASE_DIMENSIONS['Tracking Amount']).toBe(1)
  })

  it('has Trim Paths End = 1', () => {
    expect(EASE_DIMENSIONS['Trim Paths End']).toBe(1)
  })

  it('has Trim Paths Offset = 1', () => {
    expect(EASE_DIMENSIONS['Trim Paths Offset']).toBe(1)
  })

  it('has Slider = 1 (counter progress)', () => {
    expect(EASE_DIMENSIONS['Slider']).toBe(1)
  })
})
