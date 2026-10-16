#!/usr/bin/env -S npx tsx
/**
 * Pre-sample particle points from a runner silhouette PNG (issue #332)
 *
 * This script decodes a PNG file using pngjs, runs the Poisson-disc sampler,
 * and writes the resulting point list as JSON to stdout.
 *
 * Source image: Pictgram running man (public domain)
 *   URL: https://commons.wikimedia.org/wiki/File:Pictgram_running_man.svg
 *   Author: Simon Eugster
 *   Licence: Public domain (CC-PD-Mark)
 *
 * The SVG was rasterised to a 600x786 PNG with ImageMagick before sampling:
 *   magick -background none -resize 600x800 running-man.svg running-man.png
 *
 * Only the sampled points are committed; neither the SVG nor the PNG is
 * committed.
 *
 * The committed Spread map points were generated with:
 *   npx tsx scripts/motion/sample-points.ts running-man.png 42 3
 *   -> 4047 points
 *
 * Usage:
 *   npx tsx scripts/motion/sample-points.ts <input.png> [seed] [minDist]
 *
 * Defaults:
 *   seed = 42
 *   minDist = 3 (pixels)
 *   targetBox = { x: 700, y: 200, w: 1400, h: 1800 } (3840x2160 space)
 */
import { readFileSync } from 'node:fs'
import { PNG } from 'pngjs'
// Import the sampler - uses the same pure function as the runtime
import { samplePoints } from '../../src/features/Motion/internal/sampler'

const inputPath = process.argv[2]
if (!inputPath) {
  console.error(
    'Usage: npx tsx scripts/motion/sample-points.ts <input.png> [seed] [minDist]'
  )
  process.exit(1)
}

const seed = parseInt(process.argv[3] || '42', 10)
const minDistance = parseInt(process.argv[4] || '3', 10)

// Decode PNG
const buffer = readFileSync(inputPath)
const png = PNG.sync.read(buffer)

// Target box in 3840x2160 template space - centred figure
const targetBox = { x: 700, y: 200, w: 1400, h: 1800 }

const points = samplePoints({
  rgba: png.data,
  width: png.width,
  height: png.height,
  minDistance,
  seed,
  targetBox
})

console.error(
  `Sampled ${points.length} points from ${png.width}x${png.height} image ` +
    `(seed=${seed}, minDist=${minDistance})`
)

// Write as JSON to stdout
console.log(JSON.stringify(points))
