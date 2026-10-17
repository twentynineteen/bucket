/**
 * Cubic-bezier solver tests (issue #328)
 *
 * Behaviours E1.1, E1.2, E1.3
 */
import { describe, expect, it } from 'vitest'
import { solveCubicBezier } from './bezier'

// ---------------------------------------------------------------------------
// Reference: 200-step bisection on the parametric cubic
// ---------------------------------------------------------------------------

/**
 * Slow reference solver: parametric bisection with 200 steps.
 * Given control points [x1, y1, x2, y2], solve for y at a given x.
 */
function referenceSolve(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x: number
): number {
  // Parametric cubic: B(t) = 3(1-t)^2 t P1 + 3(1-t) t^2 P2 + t^3
  const bx = (t: number) => 3 * (1 - t) ** 2 * t * x1 + 3 * (1 - t) * t ** 2 * x2 + t ** 3
  const by = (t: number) => 3 * (1 - t) ** 2 * t * y1 + 3 * (1 - t) * t ** 2 * y2 + t ** 3

  let lo = 0
  let hi = 1
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    if (bx(mid) < x) lo = mid
    else hi = mid
  }
  return by((lo + hi) / 2)
}

// ---------------------------------------------------------------------------
// E1.1 - Linear ease
// ---------------------------------------------------------------------------

describe('E1.1 linear ease', () => {
  const linear: [number, number, number, number] = [0, 0, 1, 1]

  it('y equals x at 0.25, 0.5 and 0.9 within 1e-9', () => {
    for (const x of [0.25, 0.5, 0.9]) {
      expect(solveCubicBezier(linear, x)).toBeCloseTo(x, 9)
    }
  })

  it('y is exactly 0 at x=0 and exactly 1 at x=1', () => {
    expect(solveCubicBezier(linear, 0)).toBe(0)
    expect(solveCubicBezier(linear, 1)).toBe(1)
  })

  it('endpoints are exact for any ease with x1,x2 in [0,1]', () => {
    const eases: [number, number, number, number][] = [
      [0.16, 1, 0.3, 1],
      [0.25, 0.1, 0.25, 1],
      [0.42, 0, 0.58, 1],
      [0, 0, 1, 1]
    ]
    for (const ease of eases) {
      expect(solveCubicBezier(ease, 0)).toBe(0)
      expect(solveCubicBezier(ease, 1)).toBe(1)
    }
  })
})

// ---------------------------------------------------------------------------
// E1.2 - Known ease against bisection reference
// ---------------------------------------------------------------------------

describe('E1.2 ease-out reference', () => {
  const ease: [number, number, number, number] = [0.16, 1, 0.3, 1]

  it('matches 200-step bisection at 101 evenly spaced x values within 1e-7', () => {
    for (let i = 0; i <= 100; i++) {
      const x = i / 100
      const expected = referenceSolve(0.16, 1, 0.3, 1, x)
      const actual = solveCubicBezier(ease, x)
      expect(Math.abs(actual - expected)).toBeLessThan(1e-7)
    }
  })
})

// ---------------------------------------------------------------------------
// E1.3 - Overshooting ease
// ---------------------------------------------------------------------------

describe('E1.3 overshooting ease', () => {
  it('maximum y is greater than 1', () => {
    const ease: [number, number, number, number] = [0.34, 1.56, 0.64, 1]
    let maxY = -Infinity
    for (let i = 0; i <= 1000; i++) {
      const x = i / 1000
      maxY = Math.max(maxY, solveCubicBezier(ease, x))
    }
    expect(maxY).toBeGreaterThan(1)
  })
})
