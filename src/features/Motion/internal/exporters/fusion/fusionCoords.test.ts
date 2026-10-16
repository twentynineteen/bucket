/**
 * Coordinate conversion tests (issue #330)
 *
 * RES4.1: image-space coordinate conversion
 * RES4.2: size conversion (relative to width)
 * RES4.3: rotation negation
 * RES5.3: both coordinate families place (1920, 1080) at frame centre
 */
import { describe, expect, it } from 'vitest'
import {
  toFusionRotation,
  toFusionSize,
  toImageCoords,
  toShapeCoords
} from './fusionCoords'

const W = 3840
const H = 2160

// ---------------------------------------------------------------------------
// RES4.1: image-space coordinate conversion
// ---------------------------------------------------------------------------

describe('RES4.1: image-space coordinates', () => {
  it('converts (1920, 1080) to (0.5, 0.5)', () => {
    const { x, y } = toImageCoords(1920, 1080, W, H)
    expect(x).toBe(0.5)
    expect(y).toBe(0.5)
  })

  it('converts (0, 0) to (0, 1)', () => {
    const { x, y } = toImageCoords(0, 0, W, H)
    expect(x).toBe(0)
    expect(y).toBe(1)
  })

  it('converts (3840, 2160) to (1, 0)', () => {
    const { x, y } = toImageCoords(3840, 2160, W, H)
    expect(x).toBe(1)
    expect(y).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// RES4.2: size conversion
// ---------------------------------------------------------------------------

describe('RES4.2: size conversion', () => {
  it('converts 960px width to 0.25', () => {
    expect(toFusionSize(960, W)).toBe(0.25)
  })

  it('converts 540px height to 0.140625', () => {
    expect(toFusionSize(540, W)).toBe(0.140625)
  })
})

// ---------------------------------------------------------------------------
// RES4.3: rotation negation
// ---------------------------------------------------------------------------

describe('RES4.3: rotation negation', () => {
  it('converts 30 degrees to -30', () => {
    expect(toFusionRotation(30)).toBe(-30)
  })
})

// ---------------------------------------------------------------------------
// RES5.3: both families place (1920, 1080) at frame centre
// ---------------------------------------------------------------------------

describe('RES5.3: both families at frame centre', () => {
  it('image coords of (1920, 1080) are (0.5, 0.5) - frame centre', () => {
    const img = toImageCoords(1920, 1080, W, H)
    expect(img.x).toBe(0.5)
    expect(img.y).toBe(0.5)
  })

  it('shape coords of (1920, 1080) are (0, 0) - frame centre', () => {
    const shape = toShapeCoords(1920, 1080, W, H)
    expect(shape.x).toBe(0)
    expect(shape.y).toBe(0)
  })
})
