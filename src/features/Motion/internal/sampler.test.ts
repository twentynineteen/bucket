/**
 * Sampler tests (issue #332)
 *
 * Behaviours S1.1 - S1.5, plus checkAlpha and luminance-weighted density
 */
import { describe, expect, it } from 'vitest'
import { checkAlpha, samplePoints } from './sampler'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create an RGBA buffer where a callback sets the alpha per pixel. */
function makeAlphaImage(
  w: number,
  h: number,
  alphaFn: (x: number, y: number) => number
): Uint8Array {
  const buf = new Uint8Array(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4
      buf[idx] = 0 // R
      buf[idx + 1] = 0 // G
      buf[idx + 2] = 0 // B
      buf[idx + 3] = alphaFn(x, y) // A
    }
  }
  return buf
}

const TARGET_BOX = { x: 500, y: 300, w: 2000, h: 1600 }

// ---------------------------------------------------------------------------
// S1.1: determinism
// ---------------------------------------------------------------------------

describe('S1.1: sampler determinism', () => {
  const fullAlpha = makeAlphaImage(200, 200, () => 255)

  it('same seed produces identical points', () => {
    const a = samplePoints({
      rgba: fullAlpha,
      width: 200,
      height: 200,
      minDistance: 8,
      seed: 11,
      targetBox: TARGET_BOX
    })
    const b = samplePoints({
      rgba: fullAlpha,
      width: 200,
      height: 200,
      minDistance: 8,
      seed: 11,
      targetBox: TARGET_BOX
    })
    expect(a).toEqual(b)
    expect(a.length).toBeGreaterThan(0)
  })

  it('different seed produces different points', () => {
    const a = samplePoints({
      rgba: fullAlpha,
      width: 200,
      height: 200,
      minDistance: 8,
      seed: 11,
      targetBox: TARGET_BOX
    })
    const b = samplePoints({
      rgba: fullAlpha,
      width: 200,
      height: 200,
      minDistance: 8,
      seed: 12,
      targetBox: TARGET_BOX
    })
    // At least some points should differ
    const aStr = JSON.stringify(a)
    const bStr = JSON.stringify(b)
    expect(aStr).not.toEqual(bStr)
  })
})

// ---------------------------------------------------------------------------
// S1.2: alpha masking
// ---------------------------------------------------------------------------

describe('S1.2: alpha masking', () => {
  it('points only in the opaque (right) half', () => {
    const halfAlpha = makeAlphaImage(200, 200, x => (x >= 100 ? 255 : 0))
    const pts = samplePoints({
      rgba: halfAlpha,
      width: 200,
      height: 200,
      minDistance: 8,
      seed: 42,
      targetBox: TARGET_BOX
    })
    expect(pts.length).toBeGreaterThan(0)
    // In image space, right half is x >= 100 (of 200).
    // Mapped to target box: x >= 500 + (100/200)*2000 = 1500
    const midpoint = TARGET_BOX.x + TARGET_BOX.w / 2
    for (const pt of pts) {
      expect(pt.x).toBeGreaterThanOrEqual(midpoint)
    }
  })
})

// ---------------------------------------------------------------------------
// S1.3: Poisson-disc minimum distance
// ---------------------------------------------------------------------------

describe('S1.3: Poisson-disc minimum distance', () => {
  it('no two points closer than minDistance', () => {
    const fullAlpha = makeAlphaImage(200, 200, () => 255)
    const minDist = 10
    const pts = samplePoints({
      rgba: fullAlpha,
      width: 200,
      height: 200,
      minDistance: minDist,
      seed: 99,
      targetBox: TARGET_BOX
    })
    expect(pts.length).toBeGreaterThan(10)

    // The minimum distance is in image space; points are in template space.
    // Scale factor: targetBox.w / width = 2000 / 200 = 10
    const scaleX = TARGET_BOX.w / 200
    const scaleY = TARGET_BOX.h / 200
    const minDistTemplate = minDist * Math.min(scaleX, scaleY)

    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x
        const dy = pts[i].y - pts[j].y
        const d = Math.sqrt(dx * dx + dy * dy)
        expect(d).toBeGreaterThanOrEqual(minDistTemplate * 0.95) // small tolerance for rounding
      }
    }
  })
})

// ---------------------------------------------------------------------------
// S1.4: target box mapping
// ---------------------------------------------------------------------------

describe('S1.4: target box mapping', () => {
  it('all points lie inside the target box', () => {
    const fullAlpha = makeAlphaImage(200, 200, () => 255)
    const box = { x: 800, y: 400, w: 1600, h: 1200 }
    const pts = samplePoints({
      rgba: fullAlpha,
      width: 200,
      height: 200,
      minDistance: 8,
      seed: 7,
      targetBox: box
    })
    expect(pts.length).toBeGreaterThan(0)
    for (const pt of pts) {
      expect(pt.x).toBeGreaterThanOrEqual(box.x)
      expect(pt.x).toBeLessThanOrEqual(box.x + box.w)
      expect(pt.y).toBeGreaterThanOrEqual(box.y)
      expect(pt.y).toBeLessThanOrEqual(box.y + box.h)
    }
  })
})

// ---------------------------------------------------------------------------
// S1.5: fully transparent image
// ---------------------------------------------------------------------------

describe('S1.5: fully transparent image', () => {
  it('returns empty array without throwing', () => {
    const transparent = makeAlphaImage(200, 200, () => 0)
    const pts = samplePoints({
      rgba: transparent,
      width: 200,
      height: 200,
      minDistance: 8,
      seed: 1,
      targetBox: TARGET_BOX
    })
    expect(pts).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// checkAlpha
// ---------------------------------------------------------------------------

describe('checkAlpha', () => {
  it('detects both opaque and transparent pixels', () => {
    const img = makeAlphaImage(10, 10, x => (x < 5 ? 0 : 255))
    const result = checkAlpha(img, 10, 10)
    expect(result.hasOpaque).toBe(true)
    expect(result.hasTransparent).toBe(true)
  })

  it('fully opaque image has no transparent pixels', () => {
    const img = makeAlphaImage(10, 10, () => 255)
    const result = checkAlpha(img, 10, 10)
    expect(result.hasOpaque).toBe(true)
    expect(result.hasTransparent).toBe(false)
  })

  it('fully transparent image has no opaque pixels', () => {
    const img = makeAlphaImage(10, 10, () => 0)
    const result = checkAlpha(img, 10, 10)
    expect(result.hasOpaque).toBe(false)
    expect(result.hasTransparent).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Luminance-weighted sampling
// ---------------------------------------------------------------------------

describe('luminance-weighted sampling', () => {
  it('produces deterministic output', () => {
    const img = makeAlphaImage(100, 100, () => 255)
    // Set some luminance variation via R channel
    for (let y = 0; y < 100; y++) {
      for (let x = 0; x < 100; x++) {
        img[(y * 100 + x) * 4] = Math.floor((x / 100) * 255)
      }
    }
    const a = samplePoints({
      rgba: img,
      width: 100,
      height: 100,
      minDistance: 4,
      seed: 42,
      targetBox: TARGET_BOX,
      luminanceWeighted: { maxDistance: 12 }
    })
    const b = samplePoints({
      rgba: img,
      width: 100,
      height: 100,
      minDistance: 4,
      seed: 42,
      targetBox: TARGET_BOX,
      luminanceWeighted: { maxDistance: 12 }
    })
    expect(a).toEqual(b)
    expect(a.length).toBeGreaterThan(0)
  })

  it('dark areas get denser points than bright areas', () => {
    // Left half dark (R=0), right half bright (R=255), all opaque
    const img = makeAlphaImage(200, 100, () => 255)
    for (let y = 0; y < 100; y++) {
      for (let x = 0; x < 200; x++) {
        img[(y * 200 + x) * 4] = x < 100 ? 0 : 255
      }
    }
    const pts = samplePoints({
      rgba: img,
      width: 200,
      height: 100,
      minDistance: 3,
      seed: 42,
      targetBox: { x: 0, y: 0, w: 2000, h: 1000 },
      luminanceWeighted: { maxDistance: 10 }
    })
    const midX = 1000
    const leftCount = pts.filter(p => p.x < midX).length
    const rightCount = pts.filter(p => p.x >= midX).length
    // Dark (left) half should have more points than bright (right) half
    expect(leftCount).toBeGreaterThan(rightCount)
  })
})
