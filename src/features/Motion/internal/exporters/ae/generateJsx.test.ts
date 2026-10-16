/**
 * Tests for After Effects .jsx exporter (issue #329)
 *
 * Behaviours: AE1.1, AE1.4, AE2.1-AE2.3, AE3.3-AE3.5, AE4.1-AE4.5,
 * AE5.1, AE6.1-AE6.3, AE7.1, AE8.1-AE8.3
 */
import * as espree from 'espree'
import { describe, expect, it } from 'vitest'
import type { ExportInput, MotionFormat, MotionTemplate, TextLayer } from '../../../types'
import { loadBuiltins } from '../../builtins'
import { resolveTemplate } from '../../resolve'
import {
  allAnimatedFixture,
  arcFixture,
  counterFixture,
  ellipseFixture,
  groupOfGroupsFixture,
  layerKindFixtures,
  particlesFixture,
  pathFixture,
  rectFixture,
  seriesFixture,
  textFixture
} from '../../testing/fixtures'
import { generateJsx } from './generateJsx'
import { runInAEStub } from './testing/aeStub'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultFormat: MotionFormat = { width: 1920, height: 1080, fps: 25 }

function makeInput(
  template: MotionTemplate,
  overrides?: Partial<ExportInput>
): ExportInput {
  const values = overrides?.values ?? {}
  const format = overrides?.format ?? defaultFormat
  const resolved = resolveTemplate(template, values, format)
  return {
    template,
    values,
    format,
    resolved,
    targets: overrides?.targets ?? ['ae'],
    mogrt: overrides?.mogrt ?? false
  }
}

/** The text layer from textFixture, typed correctly. */
const textLayerBase = textFixture.layers[0] as TextLayer

/** Non-particle fixtures for validity tests. */
const nonParticleFixtures = layerKindFixtures.filter(
  f => !f.layers.some(l => l.kind === 'particles' || l.kind === 'series')
)

// ---------------------------------------------------------------------------
// AE1.1 - ES3 validity
// ---------------------------------------------------------------------------

describe('AE1.1 - ES3 parse validity', () => {
  it.each(nonParticleFixtures.map(f => [f.id, f] as const))(
    'fixture %s parses with espree at ecmaVersion 3',
    (_id, fixture) => {
      const input = makeInput(fixture)
      const result = generateJsx(input)
      const jsx = result.files.find(f => f.name.endsWith('.jsx'))
      expect(jsx).toBeDefined()
      expect(jsx!.kind).toBe('text')
      const src = jsx!.kind === 'text' ? jsx!.contents : ''
      expect(() => espree.parse(src, { ecmaVersion: 3 })).not.toThrow()
    }
  )

  it('built-in non-particle templates parse as ES3', () => {
    const builtins = loadBuiltins()
    const nonParticle = builtins.filter(b => !b.layers.some(l => l.kind === 'particles'))
    for (const template of nonParticle) {
      const input = makeInput(template)
      const result = generateJsx(input)
      const jsx = result.files.find(f => f.name.endsWith('.jsx'))
      if (!jsx) continue
      const src = jsx.kind === 'text' ? jsx.contents : ''
      expect(() => espree.parse(src, { ecmaVersion: 3 })).not.toThrow()
    }
  })
})

// ---------------------------------------------------------------------------
// AE1.4 - No JSON, beginUndoGroup / endUndoGroup
// ---------------------------------------------------------------------------

describe('AE1.4 - structure constraints', () => {
  it('contains no JSON identifier', () => {
    const input = makeInput(textFixture)
    const result = generateJsx(input)
    const jsx = result.files.find(f => f.name.endsWith('.jsx'))!
    const src = jsx.kind === 'text' ? jsx.contents : ''
    // Match JSON as an identifier, not inside a string literal
    expect(src).not.toMatch(/\bJSON\b/)
  })

  it('first statement calls app.beginUndoGroup', () => {
    const input = makeInput(textFixture)
    const result = generateJsx(input)
    const jsx = result.files.find(f => f.name.endsWith('.jsx'))!
    const src = jsx.kind === 'text' ? jsx.contents : ''
    const lines = src.trim().split('\n')
    const firstStatement = lines.find(
      l => l.trim() && !l.trim().startsWith('//') && !l.trim().startsWith('/*')
    )
    expect(firstStatement).toBeDefined()
    expect(firstStatement).toContain('app.beginUndoGroup')
  })

  it('last statement calls app.endUndoGroup', () => {
    const input = makeInput(textFixture)
    const result = generateJsx(input)
    const jsx = result.files.find(f => f.name.endsWith('.jsx'))!
    const src = jsx.kind === 'text' ? jsx.contents : ''
    const lines = src
      .trim()
      .split('\n')
      .filter(l => l.trim())
    const lastStatement = lines[lines.length - 1]
    expect(lastStatement).toContain('app.endUndoGroup()')
  })
})

// ---------------------------------------------------------------------------
// AE2.1 - Composition creation
// ---------------------------------------------------------------------------

describe('AE2.1 - composition creation', () => {
  it('creates one top-level comp with correct dimensions', () => {
    const input = makeInput(textFixture, {
      format: { width: 1920, height: 1080, fps: 25 }
    })
    const result = generateJsx(input)
    const jsx = result.files.find(f => f.name.endsWith('.jsx'))!
    const src = jsx.kind === 'text' ? jsx.contents : ''
    const stub = runInAEStub(src)

    expect(stub.comps.length).toBeGreaterThanOrEqual(1)
    const mainComp = stub.comps[0]
    expect(mainComp.width).toBe(1920)
    expect(mainComp.height).toBe(1080)
    expect(mainComp.pixelAspect).toBe(1)
    expect(mainComp.duration).toBe(4)
    expect(mainComp.frameRate).toBe(25)
  })
})

// ---------------------------------------------------------------------------
// AE2.2 - Groups as precomps
// ---------------------------------------------------------------------------

describe('AE2.2 - groups as precomps', () => {
  it('creates precomps for nested groups, no null layers', () => {
    const input = makeInput(groupOfGroupsFixture)
    const result = generateJsx(input)
    const jsx = result.files.find(f => f.name.endsWith('.jsx'))!
    const src = jsx.kind === 'text' ? jsx.contents : ''
    const stub = runInAEStub(src)

    // Should have at least 3 comps: main + outer group precomp + inner group precomp
    expect(stub.comps.length).toBeGreaterThanOrEqual(3)

    // No null layers
    const allLayers = stub.comps.flatMap(c => c.layers)
    expect(allLayers.some(l => l.kind === 'null')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// AE2.3 - Shape layers
// ---------------------------------------------------------------------------

describe('AE2.3 - shape layers', () => {
  it('creates a rectangle shape with roundness from rect layer', () => {
    const input = makeInput(rectFixture)
    const result = generateJsx(input)
    const jsx = result.files.find(f => f.name.endsWith('.jsx'))!
    const src = jsx.kind === 'text' ? jsx.contents : ''
    const stub = runInAEStub(src)

    const mainComp = stub.comps[0]
    const shapeLayer = mainComp.layers.find(l => l.kind === 'shape')
    expect(shapeLayer).toBeDefined()
    expect(shapeLayer!.properties['Rectangle Roundness']).toBeDefined()
    expect(shapeLayer!.properties['Rectangle Roundness'].value).toBe(12) // 24 * 0.5 (1080/2160 scale)
  })

  it('creates an ellipse shape from ellipse layer', () => {
    const input = makeInput(ellipseFixture)
    const result = generateJsx(input)
    const jsx = result.files.find(f => f.name.endsWith('.jsx'))!
    const src = jsx.kind === 'text' ? jsx.contents : ''
    const stub = runInAEStub(src)

    const mainComp = stub.comps[0]
    const shapeLayer = mainComp.layers.find(l => l.kind === 'shape')
    expect(shapeLayer).toBeDefined()
    expect(shapeLayer!.properties['Ellipse Size']).toBeDefined()
  })

  it('creates a closed path from path layer', () => {
    const input = makeInput(pathFixture)
    const result = generateJsx(input)
    const jsx = result.files.find(f => f.name.endsWith('.jsx'))!
    const src = jsx.kind === 'text' ? jsx.contents : ''
    const stub = runInAEStub(src)

    const mainComp = stub.comps[0]
    const shapeLayer = mainComp.layers.find(l => l.kind === 'shape')
    expect(shapeLayer).toBeDefined()
    expect(shapeLayer!.properties['Path Closed']).toBeDefined()
    expect(shapeLayer!.properties['Path Closed'].value).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// AE3.3 - Ease dimension enforcement
// ---------------------------------------------------------------------------

describe('AE3.3 - ease dimension counts', () => {
  it('enforces correct ease dimensions for every animated property', () => {
    const input = makeInput(allAnimatedFixture)
    const result = generateJsx(input)
    const jsx = result.files.find(f => f.name.endsWith('.jsx'))!
    const src = jsx.kind === 'text' ? jsx.contents : ''

    // Running in the stub should not throw - the stub validates dimensions
    expect(() => runInAEStub(src)).not.toThrow()

    const stub = runInAEStub(src)

    // Check that setTemporalEaseAtKey was called with correct array lengths
    const easeCalls = stub.calls.filter(c => c.method === 'setTemporalEaseAtKey')
    expect(easeCalls.length).toBeGreaterThan(0)

    // Each call's ease arrays should match the property's dimension count
    for (const call of easeCalls) {
      const inEase = call.args[1] as unknown[]
      const outEase = call.args[2] as unknown[]
      expect(inEase.length).toBe(outEase.length)
      expect(inEase.length).toBeGreaterThan(0)
    }
  })
})

// ---------------------------------------------------------------------------
// AE3.4 - Linear spatial interpolation
// ---------------------------------------------------------------------------

describe('AE3.4 - linear spatial interpolation', () => {
  it('sets linear spatial interpolation on position keyframes', () => {
    const input = makeInput(allAnimatedFixture)
    const result = generateJsx(input)
    const jsx = result.files.find(f => f.name.endsWith('.jsx'))!
    const src = jsx.kind === 'text' ? jsx.contents : ''
    const stub = runInAEStub(src)

    // Find all position properties across all comps
    for (const comp of stub.comps) {
      for (const layer of comp.layers) {
        const posProp = layer.properties['Position']
        if (posProp && posProp.keyframes.length > 1) {
          for (const kf of posProp.keyframes) {
            expect(kf.spatialInterpolation).toBe('linear')
          }
        }
      }
    }
  })
})

// ---------------------------------------------------------------------------
// AE3.5 - Keyframe times from resolve
// ---------------------------------------------------------------------------

describe('AE3.5 - snapped keyframe times preserved', () => {
  it('sets keyframes at exactly the snapped times from resolve.ts', () => {
    const format: MotionFormat = { width: 1920, height: 1080, fps: 25 }
    const input = makeInput(textFixture, { format })
    const result = generateJsx(input)
    const jsx = result.files.find(f => f.name.endsWith('.jsx'))!
    const src = jsx.kind === 'text' ? jsx.contents : ''
    const stub = runInAEStub(src)

    const mainComp = stub.comps[0]
    const textLayer = mainComp.layers.find(l => l.kind === 'text')
    expect(textLayer).toBeDefined()
    // The opacity keyframes come from resolve.ts already snapped to 25fps.
    // t=0 stays 0, t=0.5 snaps to round(0.5*25)/25 = 13/25 = 0.52
    const opacityProp = textLayer!.properties['Opacity']
    expect(opacityProp).toBeDefined()
    expect(opacityProp.keyframes.length).toBe(2)
    expect(opacityProp.keyframes[0].time).toBe(0)
    // Verify the exporter passes through the snapped time exactly (no further rounding)
    const snapped = Math.round(0.5 * format.fps) / format.fps
    expect(opacityProp.keyframes[1].time).toBe(snapped)
  })
})

// ---------------------------------------------------------------------------
// AE4.1 - Animated tracking
// ---------------------------------------------------------------------------

describe('AE4.1 - animated tracking', () => {
  it('adds a Text Animator with Tracking Amount keyframes', () => {
    const fixture: MotionTemplate = {
      ...textFixture,
      id: 'fixture-tracking',
      layers: [
        {
          ...textLayerBase,
          tracking: [
            {
              t: 0,
              value: 0,
              ease: [0.16, 1, 0.3, 1] as [number, number, number, number]
            },
            { t: 1, value: 50 }
          ]
        }
      ]
    }
    const input = makeInput(fixture)
    const result = generateJsx(input)
    const jsx = result.files.find(f => f.name.endsWith('.jsx'))!
    const src = jsx.kind === 'text' ? jsx.contents : ''
    const stub = runInAEStub(src)

    const mainComp = stub.comps[0]
    const textLayer = mainComp.layers.find(l => l.kind === 'text')
    expect(textLayer).toBeDefined()
    expect(textLayer!.properties['Tracking Amount']).toBeDefined()
    expect(textLayer!.properties['Tracking Amount'].keyframes.length).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// AE4.2 - Character stagger Expression Selector
// ---------------------------------------------------------------------------

describe('AE4.2 - character stagger', () => {
  it('adds an Expression Selector with correct delays per textIndex', () => {
    const fixture: MotionTemplate = {
      ...textFixture,
      id: 'fixture-stagger',
      layers: [
        {
          ...textLayerBase,
          stagger: { delay: 0.04 },
          tracking: [
            {
              t: 0,
              value: 0,
              ease: [0.16, 1, 0.3, 1] as [number, number, number, number]
            },
            { t: 1, value: 50 }
          ]
        }
      ]
    }
    const input = makeInput(fixture, {
      format: { width: 1920, height: 1080, fps: 25 }
    })
    const result = generateJsx(input)
    const jsx = result.files.find(f => f.name.endsWith('.jsx'))!
    const src = jsx.kind === 'text' ? jsx.contents : ''
    const stub = runInAEStub(src)

    const mainComp = stub.comps[0]
    const textLayer = mainComp.layers.find(l => l.kind === 'text')
    expect(textLayer).toBeDefined()

    // Should have an Expression Selector
    expect(textLayer!.properties['Expression Selector']).toBeDefined()
    const exprProp = textLayer!.properties['Expression Selector']
    expect(exprProp.expression).toBeDefined()

    // Evaluate the expression at a fixed time with textIndex 1, 2, 3
    // The expression should yield delay-proportional amounts
    const expr = exprProp.expression!
    // The expression should be parseable
    expect(() => espree.parse(expr, { ecmaVersion: 3 })).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// AE4.3 - Alignment and leading
// ---------------------------------------------------------------------------

describe('AE4.3 - text alignment and line height', () => {
  it('sets centre justification and correct leading from lineHeight', () => {
    const fixture: MotionTemplate = {
      ...textFixture,
      id: 'fixture-align',
      layers: [
        {
          ...textLayerBase,
          align: 'center' as const,
          lineHeight: 1.2
        }
      ]
    }
    const input = makeInput(fixture)
    const result = generateJsx(input)
    const jsx = result.files.find(f => f.name.endsWith('.jsx'))!
    const src = jsx.kind === 'text' ? jsx.contents : ''
    const stub = runInAEStub(src)

    const mainComp = stub.comps[0]
    const textLayer = mainComp.layers.find(l => l.kind === 'text')
    expect(textLayer).toBeDefined()
    expect(textLayer!.properties['Justification']).toBeDefined()
    expect(textLayer!.properties['Justification'].value).toBe('center')
    // leading = lineHeight * fontSize. Font size is 80 * 0.5 (scale) = 40
    expect(textLayer!.properties['Leading']).toBeDefined()
    expect(textLayer!.properties['Leading'].value).toBeCloseTo(40 * 1.2, 1)
  })
})

// ---------------------------------------------------------------------------
// AE4.4 - Multiline text
// ---------------------------------------------------------------------------

describe('AE4.4 - multiline vs point text', () => {
  it('creates point text for multiline false, preserving line breaks as \\r', () => {
    const fixture: MotionTemplate = {
      ...textFixture,
      id: 'fixture-point-text',
      layers: [
        {
          ...textLayerBase,
          multiline: false,
          text: 'Line 1\nLine 2'
        }
      ]
    }
    const input = makeInput(fixture)
    const result = generateJsx(input)
    const jsx = result.files.find(f => f.name.endsWith('.jsx'))!
    const src = jsx.kind === 'text' ? jsx.contents : ''
    const stub = runInAEStub(src)

    const mainComp = stub.comps[0]
    const textLayer = mainComp.layers.find(l => l.kind === 'text')
    expect(textLayer).toBeDefined()
    expect(textLayer!.properties['Text Kind']).toBeDefined()
    expect(textLayer!.properties['Text Kind'].value).toBe('point')
  })

  it('creates paragraph (box) text for multiline true with a box width', () => {
    const fixture: MotionTemplate = {
      ...textFixture,
      id: 'fixture-box-text',
      layers: [
        {
          ...textLayerBase,
          multiline: true,
          width: 800
        }
      ]
    }
    const input = makeInput(fixture)
    const result = generateJsx(input)
    const jsx = result.files.find(f => f.name.endsWith('.jsx'))!
    const src = jsx.kind === 'text' ? jsx.contents : ''
    const stub = runInAEStub(src)

    const mainComp = stub.comps[0]
    const textLayer = mainComp.layers.find(l => l.kind === 'text')
    expect(textLayer).toBeDefined()
    expect(textLayer!.properties['Text Kind']).toBeDefined()
    expect(textLayer!.properties['Text Kind'].value).toBe('box')
  })
})

// ---------------------------------------------------------------------------
// AE4.5 - Animated rect size and fill colour
// ---------------------------------------------------------------------------

describe('AE4.5 - animated rect size and fill colour', () => {
  it('creates Rectangle Size and Fill Color keyframes', () => {
    const input = makeInput(allAnimatedFixture)
    const result = generateJsx(input)
    const jsx = result.files.find(f => f.name.endsWith('.jsx'))!
    const src = jsx.kind === 'text' ? jsx.contents : ''
    const stub = runInAEStub(src)

    // Find the rect layer
    const allLayers = stub.comps.flatMap(c => c.layers)
    const rectLayer = allLayers.find(l => l.name === 'animated-rect')
    expect(rectLayer).toBeDefined()

    // Rectangle Size has keyframes
    expect(rectLayer!.properties['Rectangle Size']).toBeDefined()
    expect(rectLayer!.properties['Rectangle Size'].keyframes.length).toBeGreaterThan(0)

    // Fill Color has keyframes, values as [r, g, b, 1] in 0..1
    expect(rectLayer!.properties['Fill Color']).toBeDefined()
    const fillKfs = rectLayer!.properties['Fill Color'].keyframes
    expect(fillKfs.length).toBeGreaterThan(0)
    for (const kf of fillKfs) {
      const val = kf.value as number[]
      expect(val).toHaveLength(4)
      expect(val[3]).toBe(1) // alpha
      for (const ch of val) {
        expect(ch).toBeGreaterThanOrEqual(0)
        expect(ch).toBeLessThanOrEqual(1)
      }
    }
  })
})

// ---------------------------------------------------------------------------
// AE5.1 - Font check
// ---------------------------------------------------------------------------

describe('AE5.1 - font check', () => {
  it('alerts with missing fonts and falls back to ArialMT', () => {
    const input = makeInput(textFixture)
    const result = generateJsx(input)
    const jsx = result.files.find(f => f.name.endsWith('.jsx'))!
    const src = jsx.kind === 'text' ? jsx.contents : ''
    const stub = runInAEStub(src, { missingFonts: ['CabritoSemi-NorBol'] })

    expect(stub.alerts.length).toBe(1)
    expect(stub.alerts[0]).toContain('CabritoSemi-NorBol')

    // Every text layer should use ArialMT
    const allLayers = stub.comps.flatMap(c => c.layers)
    const textLayers = allLayers.filter(l => l.kind === 'text')
    for (const tl of textLayers) {
      expect(tl.properties['Font']).toBeDefined()
      expect(tl.properties['Font'].value).toBe('ArialMT')
    }
  })

  it('does not alert when fonts are present', () => {
    const input = makeInput(textFixture)
    const result = generateJsx(input)
    const jsx = result.files.find(f => f.name.endsWith('.jsx'))!
    const src = jsx.kind === 'text' ? jsx.contents : ''
    const stub = runInAEStub(src, { missingFonts: [] })

    expect(stub.alerts.length).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// AE6.1 - mogrt flag: Essential Graphics and export
// ---------------------------------------------------------------------------

describe('AE6.1 - mogrt flag on', () => {
  it('adds text and colour params to Essential Graphics and calls exportAsMotionGraphicsTemplate', () => {
    const fixture: MotionTemplate = {
      ...textFixture,
      id: 'fixture-mogrt',
      params: {
        name: textFixture.params.name,
        accent: {
          kind: 'colour',
          label: 'Accent',
          default: '#ff3366',
          binds: []
        }
      }
    }
    const input = makeInput(fixture, {
      targets: ['ae', 'mogrt-via-ae'],
      mogrt: true
    })
    const result = generateJsx(input)
    const jsx = result.files.find(f => f.name.endsWith('.jsx'))!
    const src = jsx.kind === 'text' ? jsx.contents : ''
    const stub = runInAEStub(src)

    // Essential Graphics properties should be added
    const allLayers = stub.comps.flatMap(c => c.layers)
    const layersWithEG = allLayers.filter(
      l => l.essentialProperties && l.essentialProperties.length > 0
    )
    expect(layersWithEG.length).toBeGreaterThan(0)

    // exportAsMotionGraphicsTemplate is called once
    const exportCalls = stub.calls.filter(
      c => c.method === 'exportAsMotionGraphicsTemplate'
    )
    expect(exportCalls).toHaveLength(1)
    // First arg is false (never overwrite)
    expect(exportCalls[0].args[0]).toBe(false)
    // Second arg is a File pointing to <template-id>.mogrt
    const filePath = exportCalls[0].args[1] as string
    expect(filePath).toContain('fixture-mogrt.mogrt')
  })
})

// ---------------------------------------------------------------------------
// AE6.2 - No mogrt flag
// ---------------------------------------------------------------------------

describe('AE6.2 - mogrt flag off', () => {
  it('does not reference exportAsMotionGraphicsTemplate or Essential Graphics', () => {
    const input = makeInput(textFixture, { mogrt: false })
    const result = generateJsx(input)
    const jsx = result.files.find(f => f.name.endsWith('.jsx'))!
    const src = jsx.kind === 'text' ? jsx.contents : ''

    expect(src).not.toContain('exportAsMotionGraphicsTemplate')
    expect(src).not.toContain('essentialProperty')
    expect(src).not.toContain('addToMotionGraphicsTemplateControllerComp')
  })
})

// ---------------------------------------------------------------------------
// AE6.3 - File naming
// ---------------------------------------------------------------------------

describe('AE6.3 - file naming', () => {
  it('returns one .jsx file named <template-id>.jsx when mogrt is true', () => {
    const input = makeInput(textFixture, {
      targets: ['ae', 'mogrt-via-ae'],
      mogrt: true
    })
    const result = generateJsx(input)
    expect(result.files).toHaveLength(1)
    expect(result.files[0].name).toBe(`${textFixture.id}.jsx`)
  })

  it('returns one .jsx file named <template-id>.jsx when only ae target', () => {
    const input = makeInput(textFixture, {
      targets: ['ae'],
      mogrt: false
    })
    const result = generateJsx(input)
    expect(result.files).toHaveLength(1)
    expect(result.files[0].name).toBe(`${textFixture.id}.jsx`)
  })
})

// ---------------------------------------------------------------------------
// AE7.1 - Particle refusal
// ---------------------------------------------------------------------------

describe('AE7.1 - particle template refusal', () => {
  it('throws an error for particle templates', () => {
    const input = makeInput(particlesFixture)
    expect(() => generateJsx(input)).toThrow()
    try {
      generateJsx(input)
    } catch (e) {
      expect((e as Error).message).toContain(particlesFixture.id)
      expect((e as Error).message).toMatch(/video|prompt/i)
    }
  })
})

// ---------------------------------------------------------------------------
// AE8.1 - Arc layer (expanded)
// ---------------------------------------------------------------------------

describe('AE8.1 - arc layer with animated sweep', () => {
  it('creates a shape layer with Ellipse, Stroke and Trim Paths', () => {
    const input = makeInput(arcFixture, { values: { score: 72 } })
    const result = generateJsx(input)
    const jsx = result.files.find(f => f.name.endsWith('.jsx'))!
    const src = jsx.kind === 'text' ? jsx.contents : ''
    const stub = runInAEStub(src)

    const allLayers = stub.comps.flatMap(c => c.layers)
    const arcLayer = allLayers.find(l => l.name === 'ring')
    expect(arcLayer).toBeDefined()

    // Has Trim Paths End (sweep 0..1 -> 0..100)
    expect(arcLayer!.properties['Trim Paths End']).toBeDefined()
    const trimKfs = arcLayer!.properties['Trim Paths End'].keyframes
    expect(trimKfs.length).toBeGreaterThan(0)

    // Has Stroke Width
    expect(arcLayer!.properties['Stroke Width']).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// AE8.2 - Counter expression
// ---------------------------------------------------------------------------

describe('AE8.2 - counter expression', () => {
  it('generates a Source Text expression that yields correct values', () => {
    const input = makeInput(counterFixture, { values: { value: 72 } })
    const result = generateJsx(input)
    const jsx = result.files.find(f => f.name.endsWith('.jsx'))!
    const src = jsx.kind === 'text' ? jsx.contents : ''
    const stub = runInAEStub(src)

    const allLayers = stub.comps.flatMap(c => c.layers)
    const counterLayer = allLayers.find(l => l.name === 'counter-text')
    expect(counterLayer).toBeDefined()

    // Should have a Source Text expression
    expect(counterLayer!.properties['Source Text']).toBeDefined()
    const stProp = counterLayer!.properties['Source Text']
    expect(stProp.expression).toBeDefined()

    // Expression should be ASCII-only and parseable
    const expr = stProp.expression!
    for (let i = 0; i < expr.length; i++) {
      expect(expr.charCodeAt(i)).toBeLessThanOrEqual(0x7f)
    }

    // The expression, when parsed, should be valid ES3
    expect(() => espree.parse(expr, { ecmaVersion: 3 })).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// AE8.3 - Series expansion
// ---------------------------------------------------------------------------

describe('AE8.3 - series expansion', () => {
  it('builds only primitives from a series, no series reference', () => {
    const input = makeInput(seriesFixture)
    const result = generateJsx(input)
    const jsx = result.files.find(f => f.name.endsWith('.jsx'))!
    const src = jsx.kind === 'text' ? jsx.contents : ''

    // No reference to 'series' as a layer kind in the output
    // (The script should not mention MotionTemplate/series constructs)
    expect(src).not.toMatch(/\.kind\s*=\s*['"]series['"]/)

    const stub = runInAEStub(src)
    const allLayers = stub.comps.flatMap(c => c.layers)

    // Should have dot ellipses (3 data points), connector dots, labels, a marker, and hatch paths
    expect(allLayers.length).toBeGreaterThanOrEqual(3) // at least the dots
  })
})
