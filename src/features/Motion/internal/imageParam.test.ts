/**
 * imageParam tests - pure applyImageParam function
 *
 * Ar3: the image param key must come from layer.imageParam, not hard-coded.
 * Each image-driven layer re-samples with its own seed.
 */
import { describe, expect, it } from 'vitest'
import type { MotionTemplate, ParticlesLayer } from '../types'
import { applyImageParam, fitInsideBox, type DecodedImage } from './imageParam'

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
  it('ar3_uses_layer_imageParam_as_value_key_not_hard_coded_image', () => {
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

  it('ar3_each_layer_resamples_with_its_own_seed', () => {
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

  it('ar3_non_particle_layers_are_unchanged', () => {
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

  it('ar3_particle_layer_without_imageParam_is_unchanged', () => {
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

  it('ar3_resampled_points_carry_no_region', () => {
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

  it('ar3_caps_points_at_maximum', () => {
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

describe('fitInsideBox', () => {
  it('sk10_landscape_image_fits_width_preserving_aspect_ratio', () => {
    // 4:1 landscape image into a 2000x1600 box
    const box = fitInsideBox(400, 100, { x: 500, y: 300, w: 2000, h: 1600 })

    // Should fit to the width (2000), so height = 2000 / 4 = 500
    expect(box.w).toBeCloseTo(2000, 0)
    expect(box.h).toBeCloseTo(500, 0)

    // Centred vertically: y offset = 300 + (1600 - 500) / 2 = 850
    expect(box.y).toBeCloseTo(850, 0)
    expect(box.x).toBeCloseTo(500, 0)
  })

  it('sk10_portrait_image_fits_height_preserving_aspect_ratio', () => {
    // 1:4 portrait image into a 2000x1600 box
    const box = fitInsideBox(100, 400, { x: 500, y: 300, w: 2000, h: 1600 })

    // Should fit to the height (1600), so width = 1600 / 4 = 400
    expect(box.h).toBeCloseTo(1600, 0)
    expect(box.w).toBeCloseTo(400, 0)

    // Centred horizontally: x offset = 500 + (2000 - 400) / 2 = 1300
    expect(box.x).toBeCloseTo(1300, 0)
    expect(box.y).toBeCloseTo(300, 0)
  })

  it('sk10_square_image_into_wider_box', () => {
    // Square into a 2000x1000 box
    const box = fitInsideBox(100, 100, { x: 0, y: 0, w: 2000, h: 1000 })

    // Should fit to height (1000), width also 1000
    expect(box.h).toBeCloseTo(1000, 0)
    expect(box.w).toBeCloseTo(1000, 0)
    expect(box.x).toBeCloseTo(500, 0) // centred
    expect(box.y).toBeCloseTo(0, 0)
  })
})
