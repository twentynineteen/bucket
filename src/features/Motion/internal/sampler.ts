/**
 * Poisson-disc point sampler for particle layers (issue #332)
 *
 * Samples points from an alpha image using Bridson's Poisson-disc algorithm
 * with a seeded PRNG. The same seed always produces the same point list,
 * and different seeds produce different lists.
 *
 * Used by:
 * - `scripts/motion/sample-points.ts` to pre-sample built-in templates
 * - The runtime image param (canvas ImageData) to re-sample a user's PNG
 */
import { createRng } from './random'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SamplerInput {
  /** RGBA pixel buffer, 4 bytes per pixel, row-major. */
  rgba: Uint8Array | Uint8ClampedArray
  /** Image width in pixels. */
  width: number
  /** Image height in pixels. */
  height: number
  /** Minimum distance between points in pixels. */
  minDistance: number
  /** PRNG seed for deterministic output. */
  seed: number
  /**
   * Target bounding box in template space (3840x2160).
   * Sampled points are mapped from image space into this box.
   */
  targetBox: { x: number; y: number; w: number; h: number }
}

export interface SampledPoint {
  x: number
  y: number
  region?: string
}

/** Internal state for the Poisson-disc grid. */
interface GridState {
  grid: (number | null)[]
  gridW: number
  gridH: number
  cellSize: number
  minDistSq: number
  pointsImg: { x: number; y: number }[]
}

/** Image descriptor passed to alpha checks. */
interface ImageDesc {
  rgba: Uint8Array | Uint8ClampedArray
  width: number
  height: number
}

// ---------------------------------------------------------------------------
// Alpha check
// ---------------------------------------------------------------------------

/** Return true when the pixel at (px, py) has alpha > 128. */
function isOpaque(img: ImageDesc, px: number, py: number): boolean {
  if (px < 0 || py < 0 || px >= img.width || py >= img.height) return false
  const idx = (py * img.width + px) * 4 + 3 // alpha channel
  return img.rgba[idx] > 128
}

// ---------------------------------------------------------------------------
// Grid neighbourhood check
// ---------------------------------------------------------------------------

/** Check whether a candidate point is too close to any existing point. */
function isTooClose(nx: number, ny: number, gs: GridState): boolean {
  const gx = Math.floor(nx / gs.cellSize)
  const gy = Math.floor(ny / gs.cellSize)
  for (let dy = -2; dy <= 2; dy++) {
    const ggy = gy + dy
    if (ggy < 0 || ggy >= gs.gridH) continue
    for (let dx = -2; dx <= 2; dx++) {
      const ggx = gx + dx
      if (ggx < 0 || ggx >= gs.gridW) continue
      const neighbour = gs.grid[ggy * gs.gridW + ggx]
      if (neighbour === null) continue
      const op = gs.pointsImg[neighbour]
      const ddx = op.x - nx
      const ddy = op.y - ny
      if (ddx * ddx + ddy * ddy < gs.minDistSq) return true
    }
  }
  return false
}

// ---------------------------------------------------------------------------
// Start point finder
// ---------------------------------------------------------------------------

/** Find the first opaque pixel using the seeded RNG. Returns null if none. */
function findStartPoint(
  rng: () => number,
  img: ImageDesc
): { x: number; y: number } | null {
  const maxAttempts = img.width * img.height
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const cx = Math.floor(rng() * img.width)
    const cy = Math.floor(rng() * img.height)
    if (isOpaque(img, cx, cy)) {
      return { x: cx, y: cy }
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Candidate testing
// ---------------------------------------------------------------------------

/** Try one candidate around an active point. Returns the new point or null. */
function tryCandidate(
  px: number,
  py: number,
  rng: () => number,
  minDistance: number,
  img: ImageDesc,
  gs: GridState
): { x: number; y: number } | null {
  const angle = rng() * Math.PI * 2
  const dist = minDistance + rng() * minDistance
  const nx = px + Math.cos(angle) * dist
  const ny = py + Math.sin(angle) * dist
  const nxi = Math.floor(nx)
  const nyi = Math.floor(ny)

  if (!isOpaque(img, nxi, nyi)) return null

  const gx = Math.floor(nx / gs.cellSize)
  const gy = Math.floor(ny / gs.cellSize)
  if (gx < 0 || gy < 0 || gx >= gs.gridW || gy >= gs.gridH) return null
  if (isTooClose(nx, ny, gs)) return null
  return { x: nx, y: ny }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Sample points from an RGBA alpha image using Poisson-disc distribution.
 *
 * Returns an empty array for a fully transparent image (no error).
 * Deterministic: same input always yields the same output.
 */
export function samplePoints(input: SamplerInput): SampledPoint[] {
  const { rgba, width, height, minDistance, seed, targetBox } = input

  if (width <= 0 || height <= 0 || minDistance <= 0) return []

  const rng = createRng(seed)
  const cellSize = minDistance / Math.SQRT2
  const img: ImageDesc = { rgba, width, height }
  const gs: GridState = {
    grid: new Array(Math.ceil(width / cellSize) * Math.ceil(height / cellSize)).fill(
      null
    ),
    gridW: Math.ceil(width / cellSize),
    gridH: Math.ceil(height / cellSize),
    cellSize,
    minDistSq: minDistance * minDistance,
    pointsImg: []
  }

  const active: number[] = []
  const k = 30 // candidates per active point

  const start = findStartPoint(rng, img)
  if (!start) return []

  addPoint(start.x, start.y, gs, active)

  while (active.length > 0) {
    const activeIdx = Math.floor(rng() * active.length)
    const pIdx = active[activeIdx]
    const { x: px, y: py } = gs.pointsImg[pIdx]
    let found = false

    for (let i = 0; i < k; i++) {
      const pt = tryCandidate(px, py, rng, minDistance, img, gs)
      if (pt) {
        addPoint(pt.x, pt.y, gs, active)
        found = true
      }
    }

    if (!found) {
      active.splice(activeIdx, 1)
    }
  }

  // Map from image space to template space
  return gs.pointsImg.map(p => ({
    x: Math.round(targetBox.x + (p.x / width) * targetBox.w),
    y: Math.round(targetBox.y + (p.y / height) * targetBox.h)
  }))
}

/** Insert a new point into the grid and active list. */
function addPoint(x: number, y: number, gs: GridState, active: number[]): void {
  const idx = gs.pointsImg.length
  gs.pointsImg.push({ x, y })
  active.push(idx)
  const gx = Math.floor(x / gs.cellSize)
  const gy = Math.floor(y / gs.cellSize)
  if (gx >= 0 && gy >= 0 && gx < gs.gridW && gy < gs.gridH) {
    gs.grid[gy * gs.gridW + gx] = idx
  }
}
