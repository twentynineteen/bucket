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

// ---------------------------------------------------------------------------
// Alpha check
// ---------------------------------------------------------------------------

/** Return true when the pixel at (px, py) has alpha > 128. */
function isOpaque(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  px: number,
  py: number,
  height: number
): boolean {
  if (px < 0 || py < 0 || px >= width || py >= height) return false
  const idx = (py * width + px) * 4 + 3 // alpha channel
  return rgba[idx] > 128
}

// ---------------------------------------------------------------------------
// Grid neighbourhood check
// ---------------------------------------------------------------------------

/** Check whether a candidate point is too close to any existing point. */
function isTooClose(
  nx: number,
  ny: number,
  gx: number,
  gy: number,
  grid: (number | null)[],
  gridW: number,
  gridH: number,
  pointsImg: { x: number; y: number }[],
  minDistSq: number
): boolean {
  for (let dy = -2; dy <= 2; dy++) {
    const ggy = gy + dy
    if (ggy < 0 || ggy >= gridH) continue
    for (let dx = -2; dx <= 2; dx++) {
      const ggx = gx + dx
      if (ggx < 0 || ggx >= gridW) continue
      const neighbour = grid[ggy * gridW + ggx]
      if (neighbour === null) continue
      const op = pointsImg[neighbour]
      const ddx = op.x - nx
      const ddy = op.y - ny
      if (ddx * ddx + ddy * ddy < minDistSq) return true
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
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number
): { x: number; y: number } | null {
  const maxAttempts = width * height
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const cx = Math.floor(rng() * width)
    const cy = Math.floor(rng() * height)
    if (isOpaque(rgba, width, cx, cy, height)) {
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
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  cellSize: number,
  grid: (number | null)[],
  gridW: number,
  gridH: number,
  pointsImg: { x: number; y: number }[],
  minDistSq: number
): { x: number; y: number } | null {
  const angle = rng() * Math.PI * 2
  const dist = minDistance + rng() * minDistance
  const nx = px + Math.cos(angle) * dist
  const ny = py + Math.sin(angle) * dist
  const nxi = Math.floor(nx)
  const nyi = Math.floor(ny)

  if (!isOpaque(rgba, width, nxi, nyi, height)) return null

  const gx = Math.floor(nx / cellSize)
  const gy = Math.floor(ny / cellSize)
  if (gx < 0 || gy < 0 || gx >= gridW || gy >= gridH) return null
  if (isTooClose(nx, ny, gx, gy, grid, gridW, gridH, pointsImg, minDistSq)) {
    return null
  }
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
  const gridW = Math.ceil(width / cellSize)
  const gridH = Math.ceil(height / cellSize)
  const grid: (number | null)[] = new Array(gridW * gridH).fill(null)
  const minDistSq = minDistance * minDistance

  const pointsImg: { x: number; y: number }[] = []
  const active: number[] = []
  const k = 30 // candidates per active point

  const start = findStartPoint(rng, rgba, width, height)
  if (!start) return []

  addPoint(start.x, start.y)

  while (active.length > 0) {
    const activeIdx = Math.floor(rng() * active.length)
    const pIdx = active[activeIdx]
    const { x: px, y: py } = pointsImg[pIdx]
    let found = false

    for (let i = 0; i < k; i++) {
      const pt = tryCandidate(
        px,
        py,
        rng,
        minDistance,
        rgba,
        width,
        height,
        cellSize,
        grid,
        gridW,
        gridH,
        pointsImg,
        minDistSq
      )
      if (pt) {
        addPoint(pt.x, pt.y)
        found = true
      }
    }

    if (!found) {
      active.splice(activeIdx, 1)
    }
  }

  // Map from image space to template space
  return pointsImg.map(p => ({
    x: Math.round(targetBox.x + (p.x / width) * targetBox.w),
    y: Math.round(targetBox.y + (p.y / height) * targetBox.h)
  }))

  function addPoint(x: number, y: number) {
    const idx = pointsImg.length
    pointsImg.push({ x, y })
    active.push(idx)
    const gx = Math.floor(x / cellSize)
    const gy = Math.floor(y / cellSize)
    if (gx >= 0 && gy >= 0 && gx < gridW && gy < gridH) {
      grid[gy * gridW + gx] = idx
    }
  }
}
