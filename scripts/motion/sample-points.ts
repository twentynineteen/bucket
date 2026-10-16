#!/usr/bin/env -S npx tsx
/**
 * Pre-sample particle points from a runner photograph (issue #332)
 *
 * Decodes a PNG with pngjs, runs a luminance-weighted Poisson-disc sampler,
 * assigns anatomical region labels from the image geometry, and writes the
 * resulting point list as JSON to stdout.
 *
 * Source image: Eadweard Muybridge, "Animal Locomotion" Plate 62 frame 3
 *   "Running at full speed" (1884-1886)
 *   URL: https://commons.wikimedia.org/wiki/File:Nude_man_running_at_full_speed_(rbm-QP301M8-1887-062a~3).jpg
 *   Author: Eadweard Muybridge (1830-1904)
 *   Licence: Public domain (PD-US, published 1887, copyright expired)
 *   Categories on Commons: PD US, Images from USC Digital Library
 *
 * The photograph was cropped and processed into a 520x780 RGBA PNG with the
 * figure isolated by threshold. Luminance from the original grayscale is used
 * to weight point density: darker areas (shadows) get denser points,
 * lighter areas (highlights) get sparser points.
 *
 * Only the sampled points are committed; neither the source JPEG nor
 * the processed PNG is committed.
 *
 * The committed Spread map points were generated with:
 *   npx tsx scripts/motion/sample-points.ts muybridge-rgba.png 42 2 6
 *   -> ~4500 points
 *
 * Usage:
 *   npx tsx scripts/motion/sample-points.ts <input.png> [seed] [minDist] [maxDist]
 *
 * Defaults:
 *   seed = 42
 *   minDist = 2 (pixels, used for darkest areas)
 *   maxDist = 6 (pixels, used for brightest areas)
 *   targetBox = { x: 600, y: 200, w: 1600, h: 1700 } (3840x2160 space)
 */
import { readFileSync } from 'node:fs'
import { PNG } from 'pngjs'
import { createRng } from '../../src/features/Motion/internal/random'

const inputPath = process.argv[2]
if (!inputPath) {
  console.error(
    'Usage: npx tsx scripts/motion/sample-points.ts <input.png> [seed] [minDist] [maxDist]'
  )
  process.exit(1)
}

const seed = parseInt(process.argv[3] || '42', 10)
const minDist = parseFloat(process.argv[4] || '2')
const maxDist = parseFloat(process.argv[5] || '6')

// Decode PNG
const buffer = readFileSync(inputPath)
const png = PNG.sync.read(buffer)
const { width, height, data } = png

// Target box in 3840x2160 template space
const targetBox = { x: 600, y: 200, w: 1600, h: 1700 }

// ---------------------------------------------------------------------------
// Luminance-weighted Poisson-disc sampling
// ---------------------------------------------------------------------------

/** Get luminance (0-1, 0=black, 1=white) at a pixel. */
function luminance(px: number, py: number): number {
  if (px < 0 || py < 0 || px >= width || py >= height) return 1
  const idx = (py * width + px) * 4
  return data[idx] / 255
}

/** Is the pixel opaque? */
function isOpaque(px: number, py: number): boolean {
  if (px < 0 || py < 0 || px >= width || py >= height) return false
  const idx = (py * width + px) * 4 + 3
  return data[idx] > 128
}

/** Minimum distance at a point, based on luminance. Dark = dense = small. */
function minDistAt(px: number, py: number): number {
  const lum = luminance(Math.floor(px), Math.floor(py))
  return minDist + lum * (maxDist - minDist)
}

// Bridson's algorithm with variable radius
const rng = createRng(seed)
const cellSize = minDist / Math.SQRT2
const gridW = Math.ceil(width / cellSize)
const gridH = Math.ceil(height / cellSize)
const grid: (number | null)[] = new Array(gridW * gridH).fill(null)

const points: { x: number; y: number }[] = []
const active: number[] = []
const k = 30

// Find start point
let startX = -1
let startY = -1
for (let attempt = 0; attempt < width * height; attempt++) {
  const cx = Math.floor(rng() * width)
  const cy = Math.floor(rng() * height)
  if (isOpaque(cx, cy)) {
    startX = cx
    startY = cy
    break
  }
}

if (startX < 0) {
  console.error('No opaque pixels found')
  process.exit(1)
}

addPoint(startX, startY)

while (active.length > 0) {
  const activeIdx = Math.floor(rng() * active.length)
  const pIdx = active[activeIdx]
  const { x: px, y: py } = points[pIdx]
  const localMinDist = minDistAt(px, py)
  let found = false

  for (let i = 0; i < k; i++) {
    const candidate = generateCandidate(px, py, localMinDist)
    if (candidate) {
      addPoint(candidate.x, candidate.y)
      found = true
    }
  }

  if (!found) {
    active.splice(activeIdx, 1)
  }
}

function generateCandidate(
  px: number,
  py: number,
  localMinDist: number
): { x: number; y: number } | null {
  const angle = rng() * Math.PI * 2
  const dist = localMinDist + rng() * localMinDist
  const nx = px + Math.cos(angle) * dist
  const ny = py + Math.sin(angle) * dist

  if (!isOpaque(Math.floor(nx), Math.floor(ny))) return null

  const candidateMinDist = minDistAt(nx, ny)
  const checkDist = Math.min(localMinDist, candidateMinDist)

  const gx = Math.floor(nx / cellSize)
  const gy = Math.floor(ny / cellSize)
  if (gx < 0 || gy < 0 || gx >= gridW || gy >= gridH) return null

  if (hasNeighbourWithin(nx, ny, gx, gy, checkDist)) return null
  return { x: nx, y: ny }
}

function hasNeighbourWithin(
  nx: number,
  ny: number,
  gx: number,
  gy: number,
  checkDist: number
): boolean {
  const checkRange = Math.ceil(checkDist / cellSize) + 1
  const checkDistSq = checkDist * checkDist
  for (let dy = -checkRange; dy <= checkRange; dy++) {
    const ggy = gy + dy
    if (ggy < 0 || ggy >= gridH) continue
    for (let dx = -checkRange; dx <= checkRange; dx++) {
      const ggx = gx + dx
      if (ggx < 0 || ggx >= gridW) continue
      const neighbour = grid[ggy * gridW + ggx]
      if (neighbour === null) continue
      const op = points[neighbour]
      const ddx = op.x - nx
      const ddy = op.y - ny
      if (ddx * ddx + ddy * ddy < checkDistSq) return true
    }
  }
  return false
}

function addPoint(x: number, y: number) {
  const idx = points.length
  points.push({ x, y })
  active.push(idx)
  const gx = Math.floor(x / cellSize)
  const gy = Math.floor(y / cellSize)
  if (gx >= 0 && gy >= 0 && gx < gridW && gy < gridH) {
    grid[gy * gridW + gx] = idx
  }
}

// ---------------------------------------------------------------------------
// Region assignment based on figure geometry
// ---------------------------------------------------------------------------

const regionBands: { name: string; minY: number; maxY: number }[] = [
  { name: 'head', minY: 0, maxY: 0.15 },
  { name: 'upper-body', minY: 0.15, maxY: 0.38 },
  { name: 'hips', minY: 0.38, maxY: 0.48 },
  { name: 'thighs', minY: 0.48, maxY: 0.62 },
  { name: 'knees', minY: 0.62, maxY: 0.7 },
  { name: 'calves', minY: 0.7, maxY: 0.85 },
  { name: 'feet', minY: 0.85, maxY: 1.0 }
]

function assignRegion(py: number): string {
  const normY = py / height
  for (const band of regionBands) {
    if (normY >= band.minY && normY < band.maxY) return band.name
  }
  return 'feet'
}

// Map to template space and assign regions
const templatePoints = points.map(p => ({
  x: Math.round(targetBox.x + (p.x / width) * targetBox.w),
  y: Math.round(targetBox.y + (p.y / height) * targetBox.h),
  region: assignRegion(p.y)
}))

console.error(
  `Sampled ${templatePoints.length} points from ${width}x${height} image ` +
    `(seed=${seed}, minDist=${minDist}, maxDist=${maxDist})`
)

const regionCounts: Record<string, number> = {}
for (const pt of templatePoints) {
  regionCounts[pt.region] = (regionCounts[pt.region] || 0) + 1
}
console.error('Regions:', JSON.stringify(regionCounts))

console.log(JSON.stringify(templatePoints))
