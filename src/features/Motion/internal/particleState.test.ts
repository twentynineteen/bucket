/**
 * Particle state evaluator tests (issue #328)
 *
 * Behaviours E6.1-E6.6
 */
import { describe, expect, it } from 'vitest'
import type { ParticlesLayer } from '../types'
import { computeParticleState } from './particleState'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build N test points, some with regions. */
function makePoints(n: number): ParticlesLayer['points'] {
  return Array.from({ length: n }, (_, i) => ({
    x: 100 + i * 10,
    y: 200 + i * 5,
    ...(i % 5 === 0 ? { region: 'uk' } : {}),
    ...(i % 7 === 0 && i % 5 !== 0 ? { region: 'fr' } : {})
  }))
}

const regionFills = { uk: '#ff0000', fr: '#0000ff' }
const baseFill = '#888888'

/** Duration of the template for particle tests. */
const duration = 4
const inEnd = 1
const outStart = 3

// ---------------------------------------------------------------------------
// E6.1 - Determinism and seed sensitivity
// ---------------------------------------------------------------------------

describe('E6.1 determinism and seed sensitivity', () => {
  const points = makePoints(500)

  it('same seed produces identical state at same t', () => {
    const a = computeParticleState({
      points,
      seed: 7,
      assembleStart: 0,
      assembleEnd: inEnd,
      t: 0.4,
      duration,
      outStart,
      baseFill,
      regionFills,
      pointRadius: 4
    })
    const b = computeParticleState({
      points,
      seed: 7,
      assembleStart: 0,
      assembleEnd: inEnd,
      t: 0.4,
      duration,
      outStart,
      baseFill,
      regionFills,
      pointRadius: 4
    })
    expect(a).toEqual(b)
  })

  it('different seed produces at least 90% different positions', () => {
    const a = computeParticleState({
      points,
      seed: 7,
      assembleStart: 0,
      assembleEnd: inEnd,
      t: 0.4,
      duration,
      outStart,
      baseFill,
      regionFills,
      pointRadius: 4
    })
    const b = computeParticleState({
      points,
      seed: 8,
      assembleStart: 0,
      assembleEnd: inEnd,
      t: 0.4,
      duration,
      outStart,
      baseFill,
      regionFills,
      pointRadius: 4
    })
    let different = 0
    for (let i = 0; i < a.length; i++) {
      if (Math.abs(a[i].x - b[i].x) > 0.001 || Math.abs(a[i].y - b[i].y) > 0.001) {
        different++
      }
    }
    expect(different / points.length).toBeGreaterThanOrEqual(0.9)
  })
})

// ---------------------------------------------------------------------------
// E6.2 - Assembly complete
// ---------------------------------------------------------------------------

describe('E6.2 after assembly every point is at target', () => {
  const points = makePoints(100)

  it('every point is within 1e-6 of its target after assembleEnd', () => {
    const state = computeParticleState({
      points,
      seed: 42,
      assembleStart: 0,
      assembleEnd: inEnd,
      t: inEnd + 0.5, // well past assembleEnd, still in hold
      duration,
      outStart,
      baseFill,
      regionFills,
      pointRadius: 4
    })
    for (let i = 0; i < points.length; i++) {
      expect(Math.abs(state[i].x - points[i].x)).toBeLessThan(1e-6)
      expect(Math.abs(state[i].y - points[i].y)).toBeLessThan(1e-6)
    }
  })
})

// ---------------------------------------------------------------------------
// E6.3 - Scattered at t=0
// ---------------------------------------------------------------------------

describe('E6.3 scattered at t=0', () => {
  const points = makePoints(200)

  it('no more than 1% of points are within 1px of target at t=0', () => {
    const state = computeParticleState({
      points,
      seed: 42,
      assembleStart: 0,
      assembleEnd: inEnd,
      t: 0,
      duration,
      outStart,
      baseFill,
      regionFills,
      pointRadius: 4
    })
    let nearTarget = 0
    for (let i = 0; i < points.length; i++) {
      const dx = state[i].x - points[i].x
      const dy = state[i].y - points[i].y
      if (Math.sqrt(dx * dx + dy * dy) < 1) {
        nearTarget++
      }
    }
    expect(nearTarget / points.length).toBeLessThanOrEqual(0.01)
  })
})

// ---------------------------------------------------------------------------
// E6.4 - Per-point delays (not global)
// ---------------------------------------------------------------------------

describe('E6.4 per-point delays during assembly', () => {
  const points = makePoints(200)

  it('some points have arrived and some have not at mid-assembly', () => {
    const midAssembly = (0 + inEnd) / 2
    const state = computeParticleState({
      points,
      seed: 42,
      assembleStart: 0,
      assembleEnd: inEnd,
      t: midAssembly,
      duration,
      outStart,
      baseFill,
      regionFills,
      pointRadius: 4
    })
    // Measure distances from target
    const distances = points.map((pt, i) => {
      const dx = state[i].x - pt.x
      const dy = state[i].y - pt.y
      return Math.sqrt(dx * dx + dy * dy)
    })
    // With per-point delays, distances should vary: some close, some far.
    // A global delay would give identical distances for identical scatter offsets.
    const close = distances.filter(d => d < 200).length
    const far = distances.filter(d => d >= 200).length
    // Both close and far groups must be nonzero (per-point, not one global delay)
    expect(close).toBeGreaterThan(0)
    expect(far).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// E6.5 - Region tint
// ---------------------------------------------------------------------------

describe('E6.5 region colours', () => {
  const points: ParticlesLayer['points'] = [
    { x: 100, y: 200, region: 'uk' },
    { x: 300, y: 400, region: 'fr' },
    { x: 500, y: 600 } // untagged
  ]

  it('tagged points take region colour, untagged take baseFill', () => {
    const state = computeParticleState({
      points,
      seed: 42,
      assembleStart: 0,
      assembleEnd: 1,
      t: 1.5, // assembled, hold phase
      duration: 4,
      outStart: 3,
      baseFill: '#888888',
      regionFills: { uk: '#ff0000', fr: '#0000ff' },
      pointRadius: 4
    })
    expect(state[0].fill).toBe('#ff0000')
    expect(state[1].fill).toBe('#0000ff')
    expect(state[2].fill).toBe('#888888')
  })
})

// ---------------------------------------------------------------------------
// E6.6 - Out phase reversal
// ---------------------------------------------------------------------------

describe('E6.6 out phase reversal', () => {
  const points = makePoints(200)

  it('at outStart every point is on target', () => {
    const state = computeParticleState({
      points,
      seed: 42,
      assembleStart: 0,
      assembleEnd: inEnd,
      t: outStart,
      duration,
      outStart,
      baseFill,
      regionFills,
      pointRadius: 4
    })
    for (let i = 0; i < points.length; i++) {
      expect(Math.abs(state[i].x - points[i].x)).toBeLessThan(1e-6)
      expect(Math.abs(state[i].y - points[i].y)).toBeLessThan(1e-6)
    }
  })

  it('opacity is still 1 at outStart + 0.7 * outDuration', () => {
    const outDuration = duration - outStart
    const t = outStart + 0.7 * outDuration
    const state = computeParticleState({
      points,
      seed: 42,
      assembleStart: 0,
      assembleEnd: inEnd,
      t,
      duration,
      outStart,
      baseFill,
      regionFills,
      pointRadius: 4
    })
    // At this point all points should still have opacity 1
    // (fade starts at 70% of out duration)
    for (const p of state) {
      expect(p.opacity).toBeCloseTo(1, 5)
    }
  })

  it('opacity falls to 0 by duration', () => {
    const state = computeParticleState({
      points,
      seed: 42,
      assembleStart: 0,
      assembleEnd: inEnd,
      t: duration,
      duration,
      outStart,
      baseFill,
      regionFills,
      pointRadius: 4
    })
    for (const p of state) {
      expect(p.opacity).toBeCloseTo(0, 5)
    }
  })

  it('points scatter outward during out phase (same seeded delays)', () => {
    const outDuration = duration - outStart
    const midOut = outStart + outDuration * 0.5
    const state = computeParticleState({
      points,
      seed: 42,
      assembleStart: 0,
      assembleEnd: inEnd,
      t: midOut,
      duration,
      outStart,
      baseFill,
      regionFills,
      pointRadius: 4
    })
    let scattered = 0
    for (let i = 0; i < points.length; i++) {
      const dx = state[i].x - points[i].x
      const dy = state[i].y - points[i].y
      if (Math.sqrt(dx * dx + dy * dy) > 1) {
        scattered++
      }
    }
    // Most points should have started scattering
    expect(scattered).toBeGreaterThan(0)
  })
})
