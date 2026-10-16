/**
 * Particle state evaluator (issue #328)
 *
 * Computes the visual state of every particle point at a given time.
 * Uses seeded noise for per-point scatter offsets and assembly delays,
 * reproducing the same animation deterministically for any seed.
 *
 * Phases:
 *   [assembleStart, assembleEnd] - scatter -> assemble (per-point delays)
 *   [assembleEnd, outStart]      - hold (every point on target)
 *   [outStart, duration]         - reverse assembly + opacity fade in last 30%
 */
import type { ParticlesLayer } from '../types'
import { createRng } from './random'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParticlePointState {
  x: number
  y: number
  fill: string
  opacity: number
}

export interface ParticleStateInput {
  points: ParticlesLayer['points']
  seed: number
  assembleStart: number
  assembleEnd: number
  t: number
  duration: number
  outStart: number
  baseFill: string
  regionFills: Record<string, string>
  pointRadius: number
}

// ---------------------------------------------------------------------------
// Easing helpers
// ---------------------------------------------------------------------------

/** Ease-out cubic: fast start, slow end. Used during assembly. */
function easeOut(t: number): number {
  const t1 = 1 - t
  return 1 - t1 * t1 * t1
}

/** Ease-in cubic: slow start, fast end. Used during disassembly (out). */
function easeIn(t: number): number {
  return t * t * t
}

// ---------------------------------------------------------------------------
// Scatter generation
// ---------------------------------------------------------------------------

/** Maximum scatter distance from the point's target (in template coords). */
const SCATTER_RANGE = 2000

/**
 * Pre-compute per-point scatter offsets and assembly delays from the seed.
 * Each point gets:
 *   - dx, dy: scatter offset from target
 *   - delay: normalised delay in [0, 1) that staggers assembly
 */
function generatePointData(
  points: ParticlesLayer['points'],
  seed: number
): { dx: number; dy: number; delay: number }[] {
  const rng = createRng(seed)
  return points.map(() => {
    const angle = rng() * Math.PI * 2
    const dist = SCATTER_RANGE * (0.3 + 0.7 * rng())
    return {
      dx: Math.cos(angle) * dist,
      dy: Math.sin(angle) * dist,
      delay: rng()
    }
  })
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute the visual state of every particle at time `t`.
 *
 * Pure function: given the same inputs, always returns the same output.
 */
export function computeParticleState(input: ParticleStateInput): ParticlePointState[] {
  const {
    points,
    seed,
    assembleStart,
    assembleEnd,
    t,
    duration,
    outStart,
    baseFill,
    regionFills
  } = input

  const data = generatePointData(points, seed)
  const assembleDuration = assembleEnd - assembleStart
  const outDuration = duration - outStart

  return points.map((pt, i) => {
    const { dx, dy, delay } = data[i]

    // Resolve fill colour from region
    const fill = pt.region && regionFills[pt.region] ? regionFills[pt.region] : baseFill

    // -----------------------------------------------------------------------
    // Phase: before assembly
    // -----------------------------------------------------------------------
    if (t <= assembleStart) {
      return {
        x: pt.x + dx,
        y: pt.y + dy,
        fill,
        opacity: 1
      }
    }

    // -----------------------------------------------------------------------
    // Phase: assembly (scatter -> target)
    // -----------------------------------------------------------------------
    if (t < assembleEnd) {
      // Per-point progress: each point's effective start is staggered by delay
      const rawProgress = (t - assembleStart) / assembleDuration
      // The point starts moving when rawProgress reaches its delay
      const pointProgress = Math.max(
        0,
        Math.min(1, (rawProgress - delay * 0.6) / (1 - delay * 0.6))
      )
      const eased = easeOut(pointProgress)
      return {
        x: pt.x + dx * (1 - eased),
        y: pt.y + dy * (1 - eased),
        fill,
        opacity: 1
      }
    }

    // -----------------------------------------------------------------------
    // Phase: hold (assembled, waiting for out)
    // -----------------------------------------------------------------------
    if (t < outStart) {
      return {
        x: pt.x,
        y: pt.y,
        fill,
        opacity: 1
      }
    }

    // -----------------------------------------------------------------------
    // Phase: out (reverse assembly + opacity fade in last 30%)
    // -----------------------------------------------------------------------
    if (outDuration <= 0) {
      return { x: pt.x, y: pt.y, fill, opacity: 0 }
    }

    const outRawProgress = Math.min(1, (t - outStart) / outDuration)
    // Per-point progress: reverse uses the same delays
    const outPointProgress = Math.max(
      0,
      Math.min(1, (outRawProgress - delay * 0.6) / (1 - delay * 0.6))
    )
    const outEased = easeIn(outPointProgress)

    // Opacity fades in the last 30% of out phase
    const FADE_THRESHOLD = 0.7
    let opacity: number
    if (outRawProgress <= FADE_THRESHOLD) {
      opacity = 1
    } else {
      opacity = Math.max(0, 1 - (outRawProgress - FADE_THRESHOLD) / (1 - FADE_THRESHOLD))
    }

    return {
      x: pt.x + dx * outEased,
      y: pt.y + dy * outEased,
      fill,
      opacity
    }
  })
}
