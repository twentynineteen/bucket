/**
 * Cubic-bezier solver (issue #328)
 *
 * Solves y = f(x) for a cubic-bezier curve defined by [x1, y1, x2, y2].
 * Uses Newton-Raphson with a bisection fallback for robustness.
 *
 * The implementation mirrors the algorithm used by CSS transitions:
 * for a given x, find the parametric t on the x curve, then evaluate
 * the y curve at that t.
 */
import type { Ease } from '../types'

const EPSILON = 1e-10
const MAX_ITERATIONS = 20

/**
 * Evaluate the cubic-bezier x(t) or y(t) for a single axis.
 * B(t) = 3(1-t)^2 t P + 3(1-t) t^2 Q + t^3
 * where P and Q are the control points for that axis.
 */
function cubicBezier(p1: number, p2: number, t: number): number {
  const t1 = 1 - t
  return 3 * t1 * t1 * t * p1 + 3 * t1 * t * t * p2 + t * t * t
}

/**
 * Derivative of the cubic-bezier for a single axis.
 * B'(t) = 3(1-t)^2 P + 6(1-t)t(Q-P) + 3t^2(1-Q)
 *       = 3(1-t)^2 P1 + 6(1-t)t P2 - 6(1-t)t P1 + 3t^2(1-P2)
 */
function cubicBezierDerivative(p1: number, p2: number, t: number): number {
  const t1 = 1 - t
  return 3 * t1 * t1 * p1 + 6 * t1 * t * (p2 - p1) + 3 * t * t * (1 - p2)
}

/**
 * Find the parametric t for a given x using Newton-Raphson with bisection fallback.
 */
function findT(x1: number, x2: number, x: number): number {
  // Quick boundary check
  if (x <= 0) return 0
  if (x >= 1) return 1

  // Initial guess
  let t = x

  // Newton-Raphson iterations
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const xEst = cubicBezier(x1, x2, t) - x
    if (Math.abs(xEst) < EPSILON) return t

    const dx = cubicBezierDerivative(x1, x2, t)
    if (Math.abs(dx) < EPSILON) break

    t -= xEst / dx
  }

  // Bisection fallback if Newton-Raphson did not converge
  let lo = 0
  let hi = 1
  t = x
  for (let i = 0; i < 64; i++) {
    const xEst = cubicBezier(x1, x2, t) - x
    if (Math.abs(xEst) < EPSILON) return t
    if (xEst > 0) hi = t
    else lo = t
    t = (lo + hi) / 2
  }
  return t
}

/**
 * Solve the cubic-bezier curve for a given x.
 *
 * @param ease - [x1, y1, x2, y2] control points
 * @param x - the input x value in [0, 1]
 * @returns the y value (may exceed [0, 1] for overshooting curves)
 */
export function solveCubicBezier(ease: Ease, x: number): number {
  // Exact endpoints
  if (x <= 0) return 0
  if (x >= 1) return 1

  const [x1, y1, x2, y2] = ease
  const t = findT(x1, x2, x)
  return cubicBezier(y1, y2, t)
}
