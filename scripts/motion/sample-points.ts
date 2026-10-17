#!/usr/bin/env -S npx tsx
/**
 * Pre-sample particle points from a runner photograph (issue #332)
 *
 * Decodes a PNG with pngjs, runs the shared `samplePoints` function with
 * luminance-weighted density, assigns anatomical region labels from the
 * image geometry, and writes the resulting point list as JSON to stdout.
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
import { samplePoints } from '../../src/features/Motion/internal/sampler'

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
// Sample using the shared sampler with luminance-weighted density
// ---------------------------------------------------------------------------

const rawPoints = samplePoints({
  rgba: new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
  width,
  height,
  minDistance: minDist,
  seed,
  targetBox,
  luminanceWeighted: { maxDistance: maxDist }
})

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

function assignRegion(templateY: number): string {
  // Map template Y back to normalised figure Y
  const normY = (templateY - targetBox.y) / targetBox.h
  for (const band of regionBands) {
    if (normY >= band.minY && normY < band.maxY) return band.name
  }
  return 'feet'
}

// Assign regions to each point
const templatePoints = rawPoints.map(p => ({
  ...p,
  region: assignRegion(p.y)
}))

console.error(
  `Sampled ${templatePoints.length} points from ${width}x${height} image ` +
    `(seed=${seed}, minDist=${minDist}, maxDist=${maxDist})`
)

const regionCounts: Record<string, number> = {}
for (const pt of templatePoints) {
  regionCounts[pt.region!] = (regionCounts[pt.region!] || 0) + 1
}
console.error('Regions:', JSON.stringify(regionCounts))

console.log(JSON.stringify(templatePoints))
