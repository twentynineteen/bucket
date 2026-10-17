/**
 * imageParam tests - pure applyImageParam function
 *
 * The image param key must come from layer.imageParam, not hard-coded.
 * Each image-driven layer re-samples with its own seed.
 */
import { describe, expect, it } from 'vitest'
import type { MotionTemplate, ParticlesLayer } from '../types'
import { applyImageParam, thinEvenly, type DecodedImage } from './imageParam'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create an RGBA buffer where all pixels are opaque. */
function makeOpaqueImage(w: number, h: number): DecodedImage {
  const rgba = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < w * h; i++) {
    rgba[i * 4 + 3] = 255 // fully opaque
  }
  return { rgba, width: w, height: h }
}

function baseTemplate(
  overrides?: Partial<MotionTemplate>
): Omit<MotionTemplate, 'layers' | 'params'> {
  return {
    schemaVersion: 1,
    id: 'test',
    version: '1.0.0',
    name: 'Test',
    description: 'Test',
    category: 'data',
    status: 'stable',
    tags: [],
    fonts: [],
    duration: 4,
    inEnd: 1,
    outStart: 3,
    ...overrides
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('applyImageParam', () => {
  it('uses layer.imageParam as value key, not hard-coded "image"', () => {
    // A template whose image param is called "logo", not "image"
    const template: MotionTemplate = {
      ...baseTemplate(),
      params: {
        logo: { kind: 'image', label: 'Logo image' }
      },
      layers: [
        {
          kind: 'particles',
          id: 'scatter',
          anchor: { x: 0, y: 0 },
          points: [
            { x: 100, y: 200 },
            { x: 300, y: 400 }
          ],
          seed: 42,
          assembleStart: 0,
          assembleEnd: 1,
          baseFill: '#888',
          regionFills: {},
          pointRadius: 4,
          imageParam: 'logo'
        }
      ]
    }

    const decoded = makeOpaqueImage(100, 100)
    const result = applyImageParam(template, {}, decoded, '/path/to/logo.png')

    // The value must be keyed by "logo", not "image"
    expect(result.values).toHaveProperty('logo')
    expect(result.values).not.toHaveProperty('image')
    expect(result.values.logo).toEqual({ pickedPath: '/path/to/logo.png' })
  })

  it('each layer resamples with its own seed', () => {
    const template: MotionTemplate = {
      ...baseTemplate(),
      params: {
        image: { kind: 'image', label: 'Image' }
      },
      layers: [
        {
          kind: 'particles',
          id: 'layer-a',
          anchor: { x: 0, y: 0 },
          points: [
            { x: 100, y: 200 },
            { x: 300, y: 400 }
          ],
          seed: 11,
          assembleStart: 0,
          assembleEnd: 1,
          baseFill: '#888',
          regionFills: {},
          pointRadius: 4,
          imageParam: 'image'
        },
        {
          kind: 'particles',
          id: 'layer-b',
          anchor: { x: 0, y: 0 },
          points: [
            { x: 100, y: 200 },
            { x: 300, y: 400 }
          ],
          seed: 99,
          assembleStart: 0,
          assembleEnd: 1,
          baseFill: '#aaa',
          regionFills: {},
          pointRadius: 4,
          imageParam: 'image'
        }
      ]
    }

    const decoded = makeOpaqueImage(100, 100)
    const result = applyImageParam(template, {}, decoded, '/img.png')

    const layerA = result.template.layers[0] as ParticlesLayer
    const layerB = result.template.layers[1] as ParticlesLayer

    // Both should have points
    expect(layerA.points.length).toBeGreaterThan(0)
    expect(layerB.points.length).toBeGreaterThan(0)

    // Points should differ because seeds differ
    expect(JSON.stringify(layerA.points)).not.toEqual(JSON.stringify(layerB.points))
  })

  it('non-particle layers are unchanged', () => {
    const template: MotionTemplate = {
      ...baseTemplate(),
      params: {
        image: { kind: 'image', label: 'Image' }
      },
      layers: [
        {
          kind: 'rect',
          id: 'bg',
          anchor: { x: 0, y: 0 },
          width: 3840,
          height: 2160,
          fill: '#000',
          radius: 0
        },
        {
          kind: 'particles',
          id: 'scatter',
          anchor: { x: 0, y: 0 },
          points: [{ x: 100, y: 200 }],
          seed: 42,
          assembleStart: 0,
          assembleEnd: 1,
          baseFill: '#888',
          regionFills: {},
          pointRadius: 4,
          imageParam: 'image'
        }
      ]
    }

    const decoded = makeOpaqueImage(100, 100)
    const result = applyImageParam(template, {}, decoded, '/img.png')

    // The rect layer should be untouched
    expect(result.template.layers[0]).toBe(template.layers[0])
  })

  it('particle layer without imageParam is unchanged', () => {
    const template: MotionTemplate = {
      ...baseTemplate(),
      params: {},
      layers: [
        {
          kind: 'particles',
          id: 'scatter',
          anchor: { x: 0, y: 0 },
          points: [{ x: 100, y: 200 }],
          seed: 42,
          assembleStart: 0,
          assembleEnd: 1,
          baseFill: '#888',
          regionFills: {},
          pointRadius: 4
          // no imageParam
        }
      ]
    }

    const decoded = makeOpaqueImage(100, 100)
    const result = applyImageParam(template, {}, decoded, '/img.png')

    // Should be the same object reference (no resampling)
    expect(result.template.layers[0]).toBe(template.layers[0])
  })

  it('resampled points carry no region', () => {
    const template: MotionTemplate = {
      ...baseTemplate(),
      params: {
        image: { kind: 'image', label: 'Image' }
      },
      layers: [
        {
          kind: 'particles',
          id: 'scatter',
          anchor: { x: 0, y: 0 },
          points: [
            { x: 100, y: 200, region: 'uk' },
            { x: 300, y: 400, region: 'fr' }
          ],
          seed: 42,
          assembleStart: 0,
          assembleEnd: 1,
          baseFill: '#888',
          regionFills: { uk: '#f00', fr: '#00f' },
          pointRadius: 4,
          imageParam: 'image'
        }
      ]
    }

    const decoded = makeOpaqueImage(200, 200)
    const result = applyImageParam(template, {}, decoded, '/img.png')
    const layer = result.template.layers[0] as ParticlesLayer

    // All resampled points should have no region
    for (const pt of layer.points) {
      expect(pt.region).toBeUndefined()
    }
  })

  it('recurses into groups to find nested particle layers', () => {
    const template: MotionTemplate = {
      ...baseTemplate(),
      params: {
        image: { kind: 'image', label: 'Image' }
      },
      layers: [
        {
          kind: 'group',
          id: 'container',
          anchor: { x: 0, y: 0 },
          children: [
            {
              kind: 'particles',
              id: 'nested-scatter',
              anchor: { x: 0, y: 0 },
              points: [
                { x: 100, y: 200 },
                { x: 300, y: 400 }
              ],
              seed: 42,
              assembleStart: 0,
              assembleEnd: 1,
              baseFill: '#888',
              regionFills: {},
              pointRadius: 4,
              imageParam: 'image'
            }
          ]
        }
      ]
    }

    const decoded = makeOpaqueImage(100, 100)
    const result = applyImageParam(template, {}, decoded, '/img.png')

    // The nested particle layer should have been re-sampled
    const group = result.template.layers[0]
    expect(group.kind).toBe('group')
    if (group.kind === 'group') {
      const nested = group.children[0] as ParticlesLayer
      expect(nested.points.length).toBeGreaterThan(0)
      // The value should be set
      expect(result.values).toHaveProperty('image')
    }
  })

  it('caps points by thinning evenly rather than slicing', () => {
    // Use a very large image that would produce many points
    const decoded = makeOpaqueImage(2000, 2000)
    const template: MotionTemplate = {
      ...baseTemplate(),
      params: {
        image: { kind: 'image', label: 'Image' }
      },
      layers: [
        {
          kind: 'particles',
          id: 'scatter',
          anchor: { x: 0, y: 0 },
          points: [
            { x: 0, y: 0 },
            { x: 3840, y: 2160 }
          ],
          seed: 42,
          assembleStart: 0,
          assembleEnd: 1,
          baseFill: '#888',
          regionFills: {},
          pointRadius: 4,
          imageParam: 'image'
        }
      ]
    }

    const result = applyImageParam(template, {}, decoded, '/img.png')
    const layer = result.template.layers[0] as ParticlesLayer

    // Should not exceed the cap
    expect(layer.points.length).toBeLessThanOrEqual(8000)
    expect(layer.points.length).toBeGreaterThan(0)
  })
})

describe('aspect-ratio fitting via applyImageParam', () => {
  it('landscape image points stay within the layer bounding box', () => {
    // A wide image (4:1) fitted into a box defined by two points.
    // The fitting logic preserves aspect ratio, so points should not
    // exceed the bounding box of the layer's built-in points.
    const template: MotionTemplate = {
      ...baseTemplate(),
      params: {
        image: { kind: 'image', label: 'Image' }
      },
      layers: [
        {
          kind: 'particles',
          id: 'scatter',
          anchor: { x: 0, y: 0 },
          points: [
            { x: 500, y: 300 },
            { x: 2500, y: 1900 }
          ],
          seed: 42,
          assembleStart: 0,
          assembleEnd: 1,
          baseFill: '#888',
          regionFills: {},
          pointRadius: 4,
          imageParam: 'image'
        }
      ]
    }

    // 400x100 landscape image
    const decoded = makeOpaqueImage(400, 100)
    const result = applyImageParam(template, {}, decoded, '/img.png')
    const layer = result.template.layers[0] as ParticlesLayer

    // All re-sampled points should fall within the bounding box
    for (const pt of layer.points) {
      expect(pt.x).toBeGreaterThanOrEqual(500)
      expect(pt.x).toBeLessThanOrEqual(2500)
      expect(pt.y).toBeGreaterThanOrEqual(300)
      expect(pt.y).toBeLessThanOrEqual(1900)
    }
  })

  it('portrait image points cluster in a narrow vertical band', () => {
    const template: MotionTemplate = {
      ...baseTemplate(),
      params: {
        image: { kind: 'image', label: 'Image' }
      },
      layers: [
        {
          kind: 'particles',
          id: 'scatter',
          anchor: { x: 0, y: 0 },
          points: [
            { x: 0, y: 0 },
            { x: 2000, y: 1600 }
          ],
          seed: 42,
          assembleStart: 0,
          assembleEnd: 1,
          baseFill: '#888',
          regionFills: {},
          pointRadius: 4,
          imageParam: 'image'
        }
      ]
    }

    // 100x400 portrait image - should fit to height, so x range narrows
    const decoded = makeOpaqueImage(100, 400)
    const result = applyImageParam(template, {}, decoded, '/img.png')
    const layer = result.template.layers[0] as ParticlesLayer

    // With a 1:4 portrait fitted into a 2000x1600 box, width = 400.
    // Points should cluster in the centre 400px of the 2000-wide box.
    const xs = layer.points.map(p => p.x)
    const xMin = Math.min(...xs)
    const xMax = Math.max(...xs)
    expect(xMax - xMin).toBeLessThan(1000) // well under the full 2000 width
  })
})

// ---------------------------------------------------------------------------
// thinEvenly - direct test of the thinning function
// ---------------------------------------------------------------------------

describe('thinEvenly', () => {
  it('returns the input unchanged when count is within the cap', () => {
    const points = [1, 2, 3, 4, 5]
    expect(thinEvenly(points, 10)).toBe(points)
  })

  it('keeps the first and last points', () => {
    const points = Array.from({ length: 100 }, (_, i) => i)
    const thinned = thinEvenly(points, 10)
    expect(thinned[0]).toBe(0)
    expect(thinned[thinned.length - 1]).toBe(99)
  })

  it('returns exactly maxCount points', () => {
    const points = Array.from({ length: 100 }, (_, i) => i)
    const thinned = thinEvenly(points, 10)
    expect(thinned).toHaveLength(10)
  })

  it('selects points with uniform index spacing', () => {
    const points = Array.from({ length: 100 }, (_, i) => i)
    const thinned = thinEvenly(points, 10)

    // The indices of the selected points (their values equal their original indices)
    const indices = thinned as number[]

    // Check spacing is uniform: differences between consecutive selected indices
    const diffs = []
    for (let i = 1; i < indices.length; i++) {
      diffs.push(indices[i] - indices[i - 1])
    }
    // All diffs should be the same (or differ by at most 1 due to rounding)
    const minDiff = Math.min(...diffs)
    const maxDiff = Math.max(...diffs)
    expect(maxDiff - minDiff).toBeLessThanOrEqual(1)
  })

  it('thins a large input to a small cap', () => {
    const points = Array.from({ length: 10000 }, (_, i) => ({ x: i, y: i }))
    const thinned = thinEvenly(points, 50)
    expect(thinned).toHaveLength(50)
    expect(thinned[0]).toBe(points[0])
    expect(thinned[thinned.length - 1]).toBe(points[9999])
  })
})
