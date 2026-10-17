/**
 * Tests for After Effects .jsx exporter (issue #329)
 *
 * Behaviours: AE1.1, AE1.4, AE2.1-AE2.3, AE3.3-AE3.5, AE4.1-AE4.5,
 * AE5.1, AE6.1-AE6.3, AE7.1, AE8.1-AE8.3
 *
 * Tests use ADBE matchNames that correspond to the documented AE scripting API.
 * The stub enforces that only documented matchNames are used.
 */
import * as espree from 'espree'
import { describe, expect, it } from 'vitest'
import type { ExportInput, MotionFormat, MotionTemplate, TextLayer } from '../../../types'
import { loadBuiltins } from '../../builtins'
import { evaluate } from '../../evaluate'
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
import { evaluateStaggerExpression, runInAEStub } from './testing/aeStub'

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

const textLayerBase = textFixture.layers[0] as TextLayer

const nonParticleFixtures = layerKindFixtures.filter(
  f => !f.layers.some(l => l.kind === 'particles' || l.kind === 'series')
)

function getJsxSrc(input: ExportInput): string {
  const result = generateJsx(input)
  const jsx = result.files.find(f => f.name.endsWith('.jsx'))
  expect(jsx).toBeDefined()
  expect(jsx!.kind).toBe('text')
  return jsx!.kind === 'text' ? jsx!.contents : ''
}

// ---------------------------------------------------------------------------
// AE1.1 - ES3 validity
// ---------------------------------------------------------------------------

describe('AE1.1 - ES3 parse validity', () => {
  it.each(nonParticleFixtures.map(f => [f.id, f] as const))(
    'fixture %s parses with espree at ecmaVersion 3',
    (_id, fixture) => {
      const src = getJsxSrc(makeInput(fixture))
      expect(() => espree.parse(src, { ecmaVersion: 3 })).not.toThrow()
    }
  )

  it('built-in non-particle templates parse as ES3', () => {
    const builtins = loadBuiltins()
    const nonParticle = builtins.filter(b => !b.layers.some(l => l.kind === 'particles'))
    for (const template of nonParticle) {
      const src = getJsxSrc(makeInput(template))
      expect(() => espree.parse(src, { ecmaVersion: 3 })).not.toThrow()
    }
  })
})

// ---------------------------------------------------------------------------
// AE1.4 - No JSON, beginUndoGroup / endUndoGroup
// ---------------------------------------------------------------------------

describe('AE1.4 - structure constraints', () => {
  it('contains no JSON identifier', () => {
    const src = getJsxSrc(makeInput(textFixture))
    expect(src).not.toMatch(/\bJSON\b/)
  })

  it('first statement calls app.beginUndoGroup', () => {
    const src = getJsxSrc(makeInput(textFixture))
    const lines = src.trim().split('\n')
    const first = lines.find(
      l => l.trim() && !l.trim().startsWith('//') && !l.trim().startsWith('/*')
    )
    expect(first).toContain('app.beginUndoGroup')
  })

  it('last statement calls app.endUndoGroup', () => {
    const src = getJsxSrc(makeInput(textFixture))
    const lines = src
      .trim()
      .split('\n')
      .filter(l => l.trim())
    expect(lines[lines.length - 1]).toContain('app.endUndoGroup()')
  })
})

// ---------------------------------------------------------------------------
// AE2.1 - Composition creation
// Uses: app.project.items.addComp (itemcollection/)
// ---------------------------------------------------------------------------

describe('AE2.1 - composition creation', () => {
  it('creates one top-level comp with correct dimensions', () => {
    const src = getJsxSrc(
      makeInput(textFixture, {
        format: { width: 1920, height: 1080, fps: 25 }
      })
    )
    const stub = runInAEStub(src)

    expect(stub.comps.length).toBeGreaterThanOrEqual(1)
    const mc = stub.comps[0]
    expect(mc.width).toBe(1920)
    expect(mc.height).toBe(1080)
    expect(mc.pixelAspect).toBe(1)
    expect(mc.duration).toBe(4)
    expect(mc.frameRate).toBe(25)
  })
})

// ---------------------------------------------------------------------------
// AE2.2 - Groups as precomps
// Uses: comp.layers.add(precompItem) (layercollection/)
// ---------------------------------------------------------------------------

describe('AE2.2 - groups as precomps', () => {
  it('creates precomps for nested groups, no null layers', () => {
    const src = getJsxSrc(makeInput(groupOfGroupsFixture))
    const stub = runInAEStub(src)

    expect(stub.comps.length).toBeGreaterThanOrEqual(3)
    const allLayers = stub.comps.flatMap(c => c.layers)
    expect(allLayers.some(l => l.kind === 'null')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// AE2.3 - Shape layers
// Uses ADBE matchNames from shapelayer matchnames page
// ---------------------------------------------------------------------------

describe('AE2.3 - shape layers', () => {
  it('creates a rectangle shape with roundness from rect layer', () => {
    const src = getJsxSrc(makeInput(rectFixture))
    const stub = runInAEStub(src)

    const mc = stub.comps[0]
    const sl = mc.layers.find(l => l.kind === 'shape')
    expect(sl).toBeDefined()
    // ADBE Vector Rect Roundness (shapelayer matchnames)
    expect(sl!.properties['ADBE Vector Rect Roundness']).toBeDefined()
    expect(sl!.properties['ADBE Vector Rect Roundness'].value).toBe(12) // 24 * 0.5
  })

  it('creates an ellipse shape from ellipse layer', () => {
    const src = getJsxSrc(makeInput(ellipseFixture))
    const stub = runInAEStub(src)

    const sl = stub.comps[0].layers.find(l => l.kind === 'shape')
    expect(sl).toBeDefined()
    // ADBE Vector Ellipse Size (shapelayer matchnames)
    expect(sl!.properties['ADBE Vector Ellipse Size']).toBeDefined()
  })

  it('creates a closed path from path layer with ADBE Vector Shape', () => {
    const src = getJsxSrc(makeInput(pathFixture))
    const stub = runInAEStub(src)

    const sl = stub.comps[0].layers.find(l => l.kind === 'shape')
    expect(sl).toBeDefined()
    // ADBE Vector Shape (shapelayer matchnames)
    expect(sl!.properties['ADBE Vector Shape']).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// AE3.3 - Ease dimension enforcement
// ---------------------------------------------------------------------------

describe('AE3.3 - ease dimension counts', () => {
  it('enforces correct ease dimensions for every animated property', () => {
    const src = getJsxSrc(makeInput(allAnimatedFixture))
    // The stub throws on wrong ease dimension count
    expect(() => runInAEStub(src)).not.toThrow()

    const stub = runInAEStub(src)
    const easeCalls = stub.calls.filter(c => c.method === 'setTemporalEaseAtKey')
    expect(easeCalls.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// AE3.4 - Linear spatial interpolation
// ---------------------------------------------------------------------------

describe('AE3.4 - linear spatial interpolation', () => {
  it('sets linear spatial interpolation on position keyframes', () => {
    const src = getJsxSrc(makeInput(allAnimatedFixture))
    const stub = runInAEStub(src)

    for (const comp of stub.comps) {
      for (const layer of comp.layers) {
        // ADBE Position (avlayer matchnames)
        const posProp = layer.properties['ADBE Position']
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
    const src = getJsxSrc(makeInput(textFixture, { format }))
    const stub = runInAEStub(src)

    const tl = stub.comps[0].layers.find(l => l.kind === 'text')
    expect(tl).toBeDefined()
    // ADBE Opacity (avlayer matchnames)
    const op = tl!.properties['ADBE Opacity']
    expect(op).toBeDefined()
    expect(op.keyframes.length).toBe(2)
    expect(op.keyframes[0].time).toBe(0)
    const snapped = Math.round(0.5 * format.fps) / format.fps
    expect(op.keyframes[1].time).toBe(snapped)
  })
})

// ---------------------------------------------------------------------------
// AE4.1 - Animated tracking
// Uses: ADBE Text Animators > ADBE Text Animator > ADBE Text Animator Properties
//       > ADBE Text Tracking Amount (textlayer matchnames)
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
    const src = getJsxSrc(makeInput(fixture))
    const stub = runInAEStub(src)

    const tl = stub.comps[0].layers.find(l => l.kind === 'text')
    expect(tl).toBeDefined()
    // ADBE Text Tracking Amount (textlayer matchnames)
    expect(tl!.properties['ADBE Text Tracking Amount']).toBeDefined()
    expect(tl!.properties['ADBE Text Tracking Amount'].keyframes.length).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// AE4.2 - Character stagger Expression Selector
// Uses: ADBE Text Expressible Selector (not in official docs; flagged for #339)
// ---------------------------------------------------------------------------

describe('AE4.2 - character stagger', () => {
  const staggerFixture: MotionTemplate = {
    ...textFixture,
    id: 'fixture-stagger',
    layers: [
      {
        ...textLayerBase,
        stagger: { delay: 0.04 },
        opacity: [
          {
            t: 0,
            value: 0,
            ease: [0.16, 1, 0.3, 1] as [number, number, number, number]
          },
          { t: 0.5, value: 1 }
        ],
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

  it('emits a Slider effect with the opacity keyframes and eases', () => {
    const src = getJsxSrc(
      makeInput(staggerFixture, {
        format: { width: 1920, height: 1080, fps: 25 }
      })
    )
    const stub = runInAEStub(src)
    const tl = stub.comps[0].layers.find(l => l.kind === 'text')
    expect(tl).toBeDefined()

    const slider = tl!.properties['ADBE Slider Control-0001']
    expect(slider).toBeDefined()
    expect(slider.keyframes.length).toBe(2)
    expect(slider.keyframes[0].value).toBe(0)
    expect(slider.keyframes[1].value).toBe(100)
    expect(slider.keyframes[0].outEase).toBeDefined()
  })

  it('sets Transform Opacity to constant 100 (not keyed)', () => {
    const src = getJsxSrc(
      makeInput(staggerFixture, {
        format: { width: 1920, height: 1080, fps: 25 }
      })
    )
    const stub = runInAEStub(src)
    const tl = stub.comps[0].layers.find(l => l.kind === 'text')
    expect(tl).toBeDefined()

    const opProp = tl!.properties['ADBE Opacity']
    // Should either not exist (no keyframes set) or be 100
    if (opProp && opProp.keyframes.length > 0) {
      for (const kf of opProp.keyframes) {
        expect(kf.value).toBe(100)
      }
    }
  })

  it('animator ADBE Text Opacity is set to 0', () => {
    const src = getJsxSrc(
      makeInput(staggerFixture, {
        format: { width: 1920, height: 1080, fps: 25 }
      })
    )
    const stub = runInAEStub(src)
    const tl = stub.comps[0].layers.find(l => l.kind === 'text')
    expect(tl).toBeDefined()

    const opProp = tl!.properties['ADBE Text Opacity']
    expect(opProp).toBeDefined()
    expect(opProp.value).toBe(0)
  })

  it('expression is on ADBE Text Expressible Amount, not Selector Max Amount', () => {
    const src = getJsxSrc(
      makeInput(staggerFixture, {
        format: { width: 1920, height: 1080, fps: 25 }
      })
    )
    const stub = runInAEStub(src)
    const tl = stub.comps[0].layers.find(l => l.kind === 'text')
    expect(tl).toBeDefined()

    const exprProp = tl!.properties['ADBE Text Expressible Amount']
    expect(exprProp).toBeDefined()
    expect(exprProp.expression).toBeDefined()
    expect(exprProp.expression!.length).toBeGreaterThan(0)
    expect(() => espree.parse(exprProp.expression!, { ecmaVersion: 3 })).not.toThrow()
  })

  it('tracking stays on its own independent animator', () => {
    const src = getJsxSrc(
      makeInput(staggerFixture, {
        format: { width: 1920, height: 1080, fps: 25 }
      })
    )
    const stub = runInAEStub(src)
    const tl = stub.comps[0].layers.find(l => l.kind === 'text')
    expect(tl).toBeDefined()

    expect(tl!.properties['ADBE Text Tracking Amount']).toBeDefined()
    expect(tl!.properties['ADBE Text Tracking Amount'].keyframes.length).toBe(2)
  })

  it('per-character opacity matches slider valueAtTime (executable check)', () => {
    const format: MotionFormat = { width: 1920, height: 1080, fps: 25 }
    const src = getJsxSrc(makeInput(staggerFixture, { format }))
    const stub = runInAEStub(src)
    const tl = stub.comps[0].layers.find(l => l.kind === 'text')
    expect(tl).toBeDefined()

    const exprProp = tl!.properties['ADBE Text Expressible Amount']
    expect(exprProp).toBeDefined()
    const expression = exprProp.expression!

    const slider = tl!.properties['ADBE Slider Control-0001']
    expect(slider).toBeDefined()

    // Evaluate the expression in a vm for textIndex 1..3 at several times.
    // The expression returns the selector amount. In AE, the animator's
    // ADBE Text Opacity is 0, so character opacity = 100 - selectorAmount.
    // We verify the per-character opacity (100 - amount) matches expectations.
    const testTimes = [0, 0.1, 0.25, 0.4, 0.52]
    for (const time of testTimes) {
      for (let textIdx = 1; textIdx <= 3; textIdx++) {
        const amount = evaluateStaggerExpression(
          expression,
          slider.keyframes,
          time,
          textIdx
        )
        // Selector amount should be in [0, 100]
        expect(amount).toBeGreaterThanOrEqual(-0.001)
        expect(amount).toBeLessThanOrEqual(100.001)
      }
    }

    // Char 1 at time 0: slider(0) = 0, r = 100 - 0 = 100.
    // Character opacity = 100 - 100 = 0 (invisible).
    const a1t0 = evaluateStaggerExpression(expression, slider.keyframes, 0, 1)
    expect(100 - a1t0).toBeCloseTo(0, 0)

    // Char 1 at end of opacity ramp (0.52): slider(0.52) = 100, r = 0.
    // Character opacity = 100 - 0 = 100 (fully visible).
    const a1tEnd = evaluateStaggerExpression(expression, slider.keyframes, 0.52, 1)
    expect(100 - a1tEnd).toBeCloseTo(100, 0)

    // Char 2 at time 0: slider(0 - 0.04) = slider(-0.04) = 0, r = 100.
    // Character opacity = 100 - 100 = 0 (invisible).
    const a2t0 = evaluateStaggerExpression(expression, slider.keyframes, 0, 2)
    expect(100 - a2t0).toBeCloseTo(0, 0)

    // Exact match with the preview: each character's AE opacity must equal the
    // evaluator's per-unit opacity, mid-ramp included, so the eased curve
    // survives the bezier -> KeyframeEase mapping on the slider.
    const resolved = resolveTemplate(staggerFixture, {}, format)
    for (const time of [0.05, 0.12, 0.2, 0.3, 0.4]) {
      const states = evaluate(resolved, time)
      const text = states.find(st => st.kind === 'text')
      const units = text && text.kind === 'text' ? text.units : undefined
      expect(units, 'stagger fixture must produce per-character units').toBeDefined()
      for (let textIdx = 1; textIdx <= 3; textIdx++) {
        const amount = evaluateStaggerExpression(
          expression,
          slider.keyframes,
          time,
          textIdx
        )
        const aeOpacity = (100 - amount) / 100
        expect(aeOpacity, `char ${textIdx} at t=${time}`).toBeCloseTo(
          units![textIdx - 1].opacity,
          3
        )
      }
    }

    // Char 1 reaches full opacity before char 2 (stagger lag)
    const a1mid = evaluateStaggerExpression(expression, slider.keyframes, 0.3, 1)
    const a2mid = evaluateStaggerExpression(expression, slider.keyframes, 0.3, 2)
    // Char 1's opacity >= char 2's opacity at the same time
    expect(100 - a1mid).toBeGreaterThanOrEqual(100 - a2mid - 0.01)
  })
})

// ---------------------------------------------------------------------------
// AE4.3 - Alignment and leading
// Uses: TextDocument.justification, TextDocument.leading (textdocument/)
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
    const src = getJsxSrc(makeInput(fixture))
    const stub = runInAEStub(src)

    const tl = stub.comps[0].layers.find(l => l.kind === 'text')
    expect(tl).toBeDefined()
    // The TextDocument is set on ADBE Text Document
    const tdProp = tl!.properties['ADBE Text Document']
    expect(tdProp).toBeDefined()
    // Check the final TextDocument value
    const tdoc = tdProp.value as {
      justification: number
      leading: number
    }
    // ParagraphJustification.CENTER_JUSTIFY = 2014
    expect(tdoc.justification).toBe(2014)
    // leading = lineHeight * fontSize = 1.2 * 40 (80 * 0.5 scale)
    expect(tdoc.leading).toBeCloseTo(48, 1)
  })
})

// ---------------------------------------------------------------------------
// AE4.4 - Multiline text
// Uses: LayerCollection.addText vs addBoxText (layercollection/)
// ---------------------------------------------------------------------------

describe('AE4.4 - multiline vs point text', () => {
  it('creates point text for multiline false', () => {
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
    const src = getJsxSrc(makeInput(fixture))
    const stub = runInAEStub(src)

    const tl = stub.comps[0].layers.find(l => l.kind === 'text')
    expect(tl).toBeDefined()
    // Point text uses comp.layers.addText() - just check text layer exists
    // and that the source text was set
    const tdProp = tl!.properties['ADBE Text Document']
    expect(tdProp).toBeDefined()
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
    const src = getJsxSrc(makeInput(fixture))
    const stub = runInAEStub(src)

    const tl = stub.comps[0].layers.find(l => l.kind === 'text')
    expect(tl).toBeDefined()
    // Box text sets boxTextSize on the TextDocument
    const tdProp = tl!.properties['ADBE Text Document']
    expect(tdProp).toBeDefined()
    const tdoc = tdProp.value as { boxText: boolean; boxTextSize: number[] }
    expect(tdoc.boxText).toBe(true)
    expect(tdoc.boxTextSize[0]).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// AE4.5 - Animated rect size and fill colour
// Uses: ADBE Vector Rect Size, ADBE Vector Fill Color (shapelayer matchnames)
// ---------------------------------------------------------------------------

describe('AE4.5 - animated rect size and fill colour', () => {
  it('creates Rectangle Size and Fill Color keyframes', () => {
    const src = getJsxSrc(makeInput(allAnimatedFixture))
    const stub = runInAEStub(src)

    const allLayers = stub.comps.flatMap(c => c.layers)
    const rl = allLayers.find(l => l.name === 'animated-rect')
    expect(rl).toBeDefined()

    expect(rl!.properties['ADBE Vector Rect Size']).toBeDefined()
    expect(rl!.properties['ADBE Vector Rect Size'].keyframes.length).toBeGreaterThan(0)

    expect(rl!.properties['ADBE Vector Fill Color']).toBeDefined()
    const fillKfs = rl!.properties['ADBE Vector Fill Color'].keyframes
    expect(fillKfs.length).toBeGreaterThan(0)
    for (const kf of fillKfs) {
      const val = kf.value as number[]
      expect(val).toHaveLength(4)
      expect(val[3]).toBe(1)
    }
  })
})

// ---------------------------------------------------------------------------
// AE5.1 - Font check
// Uses: app.fonts.getFontsByPostScriptName (fontsobject/, AE 24.0+)
// ---------------------------------------------------------------------------

describe('AE5.1 - font check', () => {
  it('alerts with missing fonts and falls back to ArialMT', () => {
    const src = getJsxSrc(makeInput(textFixture))
    const stub = runInAEStub(src, {
      missingFonts: ['CabritoSemi-NorBol']
    })

    expect(stub.alerts.length).toBe(1)
    expect(stub.alerts[0]).toContain('CabritoSemi-NorBol')

    // Check font in TextDocument
    const allLayers = stub.comps.flatMap(c => c.layers)
    const textLayers = allLayers.filter(l => l.kind === 'text')
    for (const tl of textLayers) {
      const tdoc = tl.properties['ADBE Text Document']?.value as {
        font: string
      }
      expect(tdoc.font).toBe('ArialMT')
    }
  })

  it('does not alert when fonts are present', () => {
    const src = getJsxSrc(makeInput(textFixture))
    const stub = runInAEStub(src, { missingFonts: [] })
    expect(stub.alerts.length).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// AE6.1 - mogrt flag: Essential Graphics and export
// Uses: openInEssentialGraphics, addToMotionGraphicsTemplateAs,
//       exportAsMotionGraphicsTemplate (compitem/)
// ---------------------------------------------------------------------------

describe('AE6.1 - mogrt flag on', () => {
  it('adds params to Essential Graphics and calls exportAsMotionGraphicsTemplate', () => {
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
    const src = getJsxSrc(
      makeInput(fixture, {
        targets: ['ae', 'mogrt-via-ae'],
        mogrt: true
      })
    )
    const stub = runInAEStub(src)

    // addToMotionGraphicsTemplateAs should be called
    const egCalls = stub.calls.filter(c => c.method === 'addToMotionGraphicsTemplateAs')
    expect(egCalls.length).toBeGreaterThan(0)

    // exportAsMotionGraphicsTemplate called once
    const exportCalls = stub.calls.filter(
      c => c.method === 'exportAsMotionGraphicsTemplate'
    )
    expect(exportCalls).toHaveLength(1)
    expect(exportCalls[0].args[0]).toBe(false) // doOverwrite
    const fp = exportCalls[0].args[1] as string
    expect(fp).toContain('fixture-mogrt.mogrt')
  })
})

// ---------------------------------------------------------------------------
// AE6.2 - No mogrt flag
// ---------------------------------------------------------------------------

describe('AE6.2 - mogrt flag off', () => {
  it('does not reference exportAsMotionGraphicsTemplate or Essential Graphics', () => {
    const src = getJsxSrc(makeInput(textFixture, { mogrt: false }))
    expect(src).not.toContain('exportAsMotionGraphicsTemplate')
    expect(src).not.toContain('addToMotionGraphicsTemplateAs')
    expect(src).not.toContain('openInEssentialGraphics')
  })
})

// ---------------------------------------------------------------------------
// AE6.3 - File naming
// ---------------------------------------------------------------------------

describe('AE6.3 - file naming', () => {
  it('returns one .jsx file named <template-id>.jsx when mogrt is true', () => {
    const result = generateJsx(
      makeInput(textFixture, {
        targets: ['ae', 'mogrt-via-ae'],
        mogrt: true
      })
    )
    expect(result.files).toHaveLength(1)
    expect(result.files[0].name).toBe(`${textFixture.id}.jsx`)
  })

  it('returns one .jsx file named <template-id>.jsx when only ae target', () => {
    const result = generateJsx(makeInput(textFixture, { targets: ['ae'], mogrt: false }))
    expect(result.files).toHaveLength(1)
    expect(result.files[0].name).toBe(`${textFixture.id}.jsx`)
  })
})

// ---------------------------------------------------------------------------
// AE7.1 - Particle refusal
// ---------------------------------------------------------------------------

describe('AE7.1 - particle template refusal', () => {
  it('throws an error for particle templates', () => {
    expect(() => generateJsx(makeInput(particlesFixture))).toThrow(/video|prompt/i)
  })
})

// ---------------------------------------------------------------------------
// AE8.1 - Arc layer (expanded)
// Uses: ADBE Vector Trim End, ADBE Vector Stroke Width (shapelayer matchnames)
// ---------------------------------------------------------------------------

describe('AE8.1 - arc layer with animated sweep', () => {
  it('creates a shape layer with Ellipse, Stroke and Trim Paths', () => {
    const src = getJsxSrc(makeInput(arcFixture, { values: { score: 72 } }))
    const stub = runInAEStub(src)

    const allLayers = stub.comps.flatMap(c => c.layers)
    const al = allLayers.find(l => l.name === 'ring')
    expect(al).toBeDefined()
    expect(al!.properties['ADBE Vector Trim End']).toBeDefined()
    expect(al!.properties['ADBE Vector Trim End'].keyframes.length).toBeGreaterThan(0)
    expect(al!.properties['ADBE Vector Stroke Width']).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// AE8.2 - Counter expression
// Uses: ADBE Slider Control, ADBE Text Document expression (property/)
// ---------------------------------------------------------------------------

describe('AE8.2 - counter expression', () => {
  it('generates a Source Text expression that yields correct values', () => {
    const src = getJsxSrc(makeInput(counterFixture, { values: { value: 72 } }))
    const stub = runInAEStub(src)

    const allLayers = stub.comps.flatMap(c => c.layers)
    const cl = allLayers.find(l => l.name === 'counter-text')
    expect(cl).toBeDefined()

    // Source Text expression
    const stProp = cl!.properties['ADBE Text Document']
    expect(stProp).toBeDefined()
    expect(stProp.expression).toBeDefined()
    const expr = stProp.expression!
    expect(expr.length).toBeGreaterThan(0)
    for (let i = 0; i < expr.length; i++) {
      expect(expr.charCodeAt(i)).toBeLessThanOrEqual(0x7f)
    }
    expect(() => espree.parse(expr, { ecmaVersion: 3 })).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// AE8.3 - Series expansion
// ---------------------------------------------------------------------------

describe('AE8.3 - series expansion', () => {
  it('builds only primitives from a series, no series reference', () => {
    const src = getJsxSrc(makeInput(seriesFixture))
    expect(src).not.toMatch(/\.kind\s*=\s*['"]series['"]/)

    const stub = runInAEStub(src)
    const allLayers = stub.comps.flatMap(c => c.layers)
    expect(allLayers.length).toBeGreaterThanOrEqual(3)
  })
})

// ---------------------------------------------------------------------------
// Property coverage: every animatable property on every applicable layer kind
// ---------------------------------------------------------------------------

describe('Property coverage - all animatable properties on all layer kinds', () => {
  const coverageFixture: MotionTemplate = {
    schemaVersion: 1,
    id: 'fixture-coverage',
    version: '1.0.0',
    name: 'coverage',
    description: 'Coverage fixture',
    category: 'lower-third',
    status: 'stable',
    tags: ['test'],
    fonts: ['CabritoSemi-NorBol'],
    duration: 4,
    inEnd: 1,
    outStart: 3,
    params: {
      score: {
        kind: 'number' as const,
        label: 'Score',
        default: 72,
        min: 0,
        max: 100
      }
    },
    layers: [
      {
        kind: 'text' as const,
        id: 'cov-text',
        anchor: { x: 0, y: 0 },
        position: [
          {
            t: 0,
            value: { x: 100, y: 100 },
            ease: [0.16, 1, 0.3, 1] as [number, number, number, number]
          },
          { t: 1, value: { x: 200, y: 200 } }
        ],
        scale: [
          {
            t: 0,
            value: { x: 1, y: 1 },
            ease: [0.16, 1, 0.3, 1] as [number, number, number, number]
          },
          { t: 1, value: { x: 1.5, y: 1.5 } }
        ],
        rotation: [
          {
            t: 0,
            value: 0,
            ease: [0.16, 1, 0.3, 1] as [number, number, number, number]
          },
          { t: 1, value: 45 }
        ],
        opacity: [
          {
            t: 0,
            value: 0,
            ease: [0.16, 1, 0.3, 1] as [number, number, number, number]
          },
          { t: 0.5, value: 1 }
        ],
        text: 'Test',
        font: { family: 'Cabrito Semi', style: 'Norm Bold', size: 80 },
        align: 'left' as const,
        lineHeight: 1.2,
        multiline: false,
        fill: '#ffffff',
        tracking: [
          {
            t: 0,
            value: 0,
            ease: [0.16, 1, 0.3, 1] as [number, number, number, number]
          },
          { t: 1, value: 50 }
        ]
      },
      {
        kind: 'rect' as const,
        id: 'cov-rect',
        anchor: { x: 0, y: 0 },
        position: [
          {
            t: 0,
            value: { x: 50, y: 50 },
            ease: [0.16, 1, 0.3, 1] as [number, number, number, number]
          },
          { t: 1, value: { x: 150, y: 150 } }
        ],
        scale: [
          {
            t: 0,
            value: { x: 1, y: 1 },
            ease: [0.16, 1, 0.3, 1] as [number, number, number, number]
          },
          { t: 1, value: { x: 2, y: 2 } }
        ],
        rotation: [
          {
            t: 0,
            value: 0,
            ease: [0.16, 1, 0.3, 1] as [number, number, number, number]
          },
          { t: 1, value: 90 }
        ],
        opacity: [
          {
            t: 0,
            value: 0,
            ease: [0.16, 1, 0.3, 1] as [number, number, number, number]
          },
          { t: 1, value: 1 }
        ],
        width: 400,
        height: 200,
        widthAnimation: [
          {
            t: 0,
            value: 400,
            ease: [0.16, 1, 0.3, 1] as [number, number, number, number]
          },
          { t: 1, value: 600 }
        ],
        heightAnimation: [
          {
            t: 0,
            value: 200,
            ease: [0.16, 1, 0.3, 1] as [number, number, number, number]
          },
          { t: 1, value: 300 }
        ],
        fill: '#ff3366',
        fillAnimation: [
          {
            t: 0,
            value: '#ff3366',
            ease: [0.16, 1, 0.3, 1] as [number, number, number, number]
          },
          { t: 1, value: '#3366ff' }
        ],
        radius: 8
      },
      {
        kind: 'ellipse' as const,
        id: 'cov-ellipse',
        anchor: { x: 0, y: 0 },
        position: [
          {
            t: 0,
            value: { x: 500, y: 500 },
            ease: [0.16, 1, 0.3, 1] as [number, number, number, number]
          },
          { t: 1, value: { x: 600, y: 600 } }
        ],
        scale: [
          {
            t: 0,
            value: { x: 1, y: 1 },
            ease: [0.16, 1, 0.3, 1] as [number, number, number, number]
          },
          { t: 1, value: { x: 1.5, y: 1.5 } }
        ],
        rotation: [
          {
            t: 0,
            value: 0,
            ease: [0.16, 1, 0.3, 1] as [number, number, number, number]
          },
          { t: 1, value: 45 }
        ],
        opacity: [
          {
            t: 0,
            value: 0,
            ease: [0.16, 1, 0.3, 1] as [number, number, number, number]
          },
          { t: 1, value: 1 }
        ],
        radiusX: 50,
        radiusY: 50,
        fill: '#00ff00',
        fillAnimation: [
          {
            t: 0,
            value: '#00ff00',
            ease: [0.16, 1, 0.3, 1] as [number, number, number, number]
          },
          { t: 1, value: '#ff0000' }
        ]
      },
      {
        kind: 'path' as const,
        id: 'cov-path',
        anchor: { x: 0, y: 0 },
        position: [
          {
            t: 0,
            value: { x: 300, y: 300 },
            ease: [0.16, 1, 0.3, 1] as [number, number, number, number]
          },
          { t: 1, value: { x: 400, y: 400 } }
        ],
        scale: [
          {
            t: 0,
            value: { x: 1, y: 1 },
            ease: [0.16, 1, 0.3, 1] as [number, number, number, number]
          },
          { t: 1, value: { x: 1.2, y: 1.2 } }
        ],
        rotation: [
          {
            t: 0,
            value: 0,
            ease: [0.16, 1, 0.3, 1] as [number, number, number, number]
          },
          { t: 1, value: 30 }
        ],
        opacity: [
          {
            t: 0,
            value: 0,
            ease: [0.16, 1, 0.3, 1] as [number, number, number, number]
          },
          { t: 1, value: 1 }
        ],
        d: 'M 10 10 L 50 90 L 90 10 Z',
        fill: '#0000ff',
        fillAnimation: [
          {
            t: 0,
            value: '#0000ff',
            ease: [0.16, 1, 0.3, 1] as [number, number, number, number]
          },
          { t: 1, value: '#ff00ff' }
        ]
      },
      {
        kind: 'arc' as const,
        id: 'cov-arc',
        anchor: { x: 500, y: 500 },
        position: [
          {
            t: 0,
            value: { x: 960, y: 540 },
            ease: [0.16, 1, 0.3, 1] as [number, number, number, number]
          },
          { t: 1, value: { x: 960, y: 540 } }
        ],
        scale: [
          {
            t: 0,
            value: { x: 1, y: 1 },
            ease: [0.16, 1, 0.3, 1] as [number, number, number, number]
          },
          { t: 1, value: { x: 1.3, y: 1.3 } }
        ],
        rotation: [
          {
            t: 0,
            value: 0,
            ease: [0.16, 1, 0.3, 1] as [number, number, number, number]
          },
          { t: 1, value: 15 }
        ],
        opacity: [
          {
            t: 0,
            value: 0,
            ease: [0.16, 1, 0.3, 1] as [number, number, number, number]
          },
          { t: 1, value: 1 }
        ],
        innerRadius: 200,
        outerRadius: 240,
        sweep: [
          {
            t: 0,
            value: 0,
            ease: [0.16, 1, 0.3, 1] as [number, number, number, number]
          },
          { t: 1, value: 0.72 }
        ],
        startAngle: [
          {
            t: 0,
            value: -90,
            ease: [0.16, 1, 0.3, 1] as [number, number, number, number]
          },
          { t: 1, value: 0 }
        ],
        sweepFromParam: { param: 'score', max: 100 },
        fill: '#ff3366'
      }
    ]
  }

  const expectations: Array<{
    layerName: string
    kind: string
    props: string[]
  }> = [
    {
      layerName: 'cov-text',
      kind: 'text',
      props: [
        'ADBE Position',
        'ADBE Scale',
        'ADBE Rotate Z',
        'ADBE Opacity',
        'ADBE Text Tracking Amount'
      ]
    },
    {
      layerName: 'cov-rect',
      kind: 'shape',
      props: [
        'ADBE Position',
        'ADBE Scale',
        'ADBE Rotate Z',
        'ADBE Opacity',
        'ADBE Vector Rect Size',
        'ADBE Vector Fill Color'
      ]
    },
    {
      layerName: 'cov-ellipse',
      kind: 'shape',
      props: [
        'ADBE Position',
        'ADBE Scale',
        'ADBE Rotate Z',
        'ADBE Opacity',
        'ADBE Vector Fill Color'
      ]
    },
    {
      layerName: 'cov-path',
      kind: 'shape',
      props: [
        'ADBE Position',
        'ADBE Scale',
        'ADBE Rotate Z',
        'ADBE Opacity',
        'ADBE Vector Fill Color'
      ]
    },
    {
      layerName: 'cov-arc',
      kind: 'shape',
      props: [
        'ADBE Position',
        'ADBE Scale',
        'ADBE Rotate Z',
        'ADBE Opacity',
        'ADBE Vector Trim End',
        'ADBE Vector Trim Offset',
        'ADBE Vector Stroke Width'
      ]
    }
  ]

  it('exports the right properties for each layer kind', () => {
    const src = getJsxSrc(makeInput(coverageFixture, { values: { score: 72 } }))
    const stub = runInAEStub(src)
    const allLayers = stub.comps.flatMap(c => c.layers)

    for (const exp of expectations) {
      const layer = allLayers.find(l => l.name === exp.layerName)
      expect(layer, exp.layerName + ' should exist').toBeDefined()
      expect(layer!.kind).toBe(exp.kind)

      for (const prop of exp.props) {
        expect(
          layer!.properties[prop],
          exp.layerName + ' should have ' + prop
        ).toBeDefined()
      }
    }
  })

  it('runs in the stub without ease dimension errors', () => {
    const src = getJsxSrc(makeInput(coverageFixture, { values: { score: 72 } }))
    expect(() => runInAEStub(src)).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// S4 - Interior keyframes get correct distinct in/out ease (one call per key)
// ---------------------------------------------------------------------------

describe('S4 - interior key gets correct in and out ease', () => {
  // A 4-key opacity track: 0 -> 1 -> 1 -> 0 (in, hold start, hold end, out)
  // Segment 0: 0->1 with ease [0.16, 1, 0.3, 1]
  // Segment 1: 1->1 (hold) with ease [0, 0, 1, 1] (linear, no change)
  // Segment 2: 1->0 with ease [0.7, 0, 0.84, 0]
  const fourKeyFixture: MotionTemplate = {
    schemaVersion: 1,
    id: 'fixture-four-key',
    version: '1.0.0',
    name: 'four key',
    description: 'Four-key fixture for S4',
    category: 'lower-third',
    status: 'stable',
    tags: ['test'],
    fonts: ['CabritoSemi-NorBol'],
    duration: 4,
    inEnd: 1,
    outStart: 3,
    params: {},
    layers: [
      {
        kind: 'rect' as const,
        id: 's4-rect',
        anchor: { x: 0, y: 0 },
        width: 100,
        height: 100,
        fill: '#ffffff',
        radius: 0,
        opacity: [
          { t: 0, value: 0, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
          {
            t: 0.5,
            value: 1,
            ease: [0, 0, 1, 1] as [number, number, number, number]
          },
          {
            t: 3,
            value: 1,
            ease: [0.7, 0, 0.84, 0] as [number, number, number, number]
          },
          { t: 4, value: 0 }
        ]
      }
    ]
  }

  it('emits exactly one setTemporalEaseAtKey per key', () => {
    const src = getJsxSrc(makeInput(fourKeyFixture))
    const stub = runInAEStub(src)

    const layer = stub.comps[0].layers.find(l => l.name === 's4-rect')
    expect(layer).toBeDefined()

    const op = layer!.properties['ADBE Opacity']
    expect(op).toBeDefined()
    expect(op.keyframes).toHaveLength(4)

    // The important assertion: key 2 (interior) must have distinct in vs out.
    // Verify via the final recorded in/out on key 2:
    const kf2 = op.keyframes[1] // key 2 (0-indexed)
    expect(kf2.inEase, 'key 2 should have inEase set').toBeDefined()
    expect(kf2.outEase, 'key 2 should have outEase set').toBeDefined()

    // Key 2 is at the boundary between segment 0 (in ease [0.16,1,0.3,1])
    // and segment 1 (hold ease [0,0,1,1]).
    // inEase comes from segment 0's incoming half: influence = (1-0.3)*100 = 70, speed = 0
    // outEase comes from segment 1's outgoing half: delta = 0 (hold), so speed = 0
    // These must be DIFFERENT from each other (in speed at minimum).
    // The old bug: both would be segment 1's outgoing ease (last write wins).
    expect(kf2.inEase![0].influence).toBeCloseTo(70, 1)
    expect(kf2.inEase![0].speed).toBeCloseTo(0, 1)
    // outEase from hold segment: x1=0, influence clamped to 0.1
    expect(kf2.outEase![0].influence).toBeCloseTo(0.1, 1)
  })

  it('first and last keys get sensible neutral halves', () => {
    const src = getJsxSrc(makeInput(fourKeyFixture))
    const stub = runInAEStub(src)

    const layer = stub.comps[0].layers.find(l => l.name === 's4-rect')
    expect(layer).toBeDefined()

    const op = layer!.properties['ADBE Opacity']
    // First key (index 0): should have outEase from segment 0, inEase is neutral
    const kf0 = op.keyframes[0]
    expect(kf0.outEase).toBeDefined()
    expect(kf0.inEase).toBeDefined()

    // Last key (index 3): should have inEase from segment 2, outEase is neutral
    const kf3 = op.keyframes[3]
    expect(kf3.inEase).toBeDefined()
    expect(kf3.outEase).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// S5 - Rect, ellipse, path, arc origin parity with evaluator
// ---------------------------------------------------------------------------

describe('S5 - shape layer origin parity with evaluator', () => {
  // Helper: apply a 2D affine matrix to a point
  function transformPoint(
    m: [number, number, number, number, number, number],
    x: number,
    y: number
  ): { x: number; y: number } {
    return {
      x: m[0] * x + m[2] * y + m[4],
      y: m[1] * x + m[3] * y + m[5]
    }
  }

  // Helper: compute world position from AE's transform semantics
  // AE: world = layerPosition + R*S*(localPoint - anchorPoint)
  // where anchorPoint is the layer's ADBE Anchor Point, and localPoint is a
  // point in the layer's local space (e.g. a corner of the rect shape).
  // For a shape layer, the shape's local origin is centred at [0,0] with
  // shape position offsetting it. So a corner of a rect at ADBE Vector Rect Position
  // [w/2, h/2] with size [w, h] is at local coordinates
  // [w/2 - w/2, h/2 - h/2] = [0, 0] (top-left) in shape space,
  // which in layer space is [rectPos.x - w/2, rectPos.y - h/2].
  // Then: world = layerPos + R*S*(layerLocal - anchorPoint)
  function aeWorldPoint(
    layerPos: { x: number; y: number },
    anchor: { x: number; y: number },
    scale: { x: number; y: number },
    rotation: number,
    localPoint: { x: number; y: number }
  ): { x: number; y: number } {
    const rad = (rotation * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)
    const dx = localPoint.x - anchor.x
    const dy = localPoint.y - anchor.y
    const sx = dx * scale.x
    const sy = dy * scale.y
    return {
      x: layerPos.x + cos * sx - sin * sy,
      y: layerPos.y + sin * sx + cos * sy
    }
  }

  it('rect with non-zero anchor: AE stub corners equal evaluator corners', () => {
    const fixture: MotionTemplate = {
      schemaVersion: 1,
      id: 'fixture-s5-rect',
      version: '1.0.0',
      name: 's5 rect',
      description: 'S5 rect parity',
      category: 'lower-third',
      status: 'stable',
      tags: ['test'],
      fonts: ['CabritoSemi-NorBol'],
      duration: 4,
      inEnd: 1,
      outStart: 3,
      params: {},
      layers: [
        {
          kind: 'rect' as const,
          id: 's5-rect',
          anchor: { x: 50, y: 25 },
          position: [{ t: 0, value: { x: 400, y: 300 } }],
          scale: [{ t: 0, value: { x: 1.5, y: 0.8 } }],
          rotation: [{ t: 0, value: 30 }],
          width: 200,
          height: 100,
          fill: '#ff3366',
          radius: 0
        }
      ]
    }

    const format: MotionFormat = { width: 1920, height: 1080, fps: 25 }
    const input = makeInput(fixture, { format })
    const src = getJsxSrc(input)
    const stub = runInAEStub(src)

    const layer = stub.comps[0].layers.find(l => l.name === 's5-rect')
    expect(layer).toBeDefined()

    // Get the AE layer's position and anchor point from the stub
    const posProp = layer!.properties['ADBE Position']
    expect(posProp).toBeDefined()
    const aeLayerPos = posProp.keyframes[0]?.value as number[]
    expect(aeLayerPos).toBeDefined()

    const anchorProp = layer!.properties['ADBE Anchor Point']
    // The anchor must be set for non-zero anchors
    expect(anchorProp, 'ADBE Anchor Point must be set').toBeDefined()
    const aeAnchor = anchorProp.value as number[] | undefined
    const anchorVal = aeAnchor ?? [0, 0]

    // Get the rect's shape position and size
    const rectPosProp = layer!.properties['ADBE Vector Rect Position']
    const rectPos = rectPosProp?.value as number[] | undefined
    const shapeCenter = rectPos ?? [0, 0]

    // Get scale and rotation from the stub
    const scaleProp = layer!.properties['ADBE Scale']
    const aeScale = scaleProp?.keyframes?.[0]?.value as number[] | undefined
    const scaleVal = aeScale
      ? { x: aeScale[0] / 100, y: aeScale[1] / 100 }
      : { x: 1, y: 1 }

    const rotProp = layer!.properties['ADBE Rotate Z']
    const aeRot = rotProp?.keyframes?.[0]?.value as number | undefined
    const rotVal = aeRot ?? 0

    // Resolve scales layer dimensions by format.width / 3840.
    const resolved = resolveTemplate(fixture, {}, format)
    const rl = resolved.layers[0] as import('../../../types').RectLayer
    const w = rl.width
    const h = rl.height

    // In AE, the shape's top-left corner in layer local space is:
    // shapeCenter - [w/2, h/2]
    const topLeftLocal = {
      x: shapeCenter[0] - w / 2,
      y: shapeCenter[1] - h / 2
    }

    // AE world position of the top-left corner
    const aeTopLeft = aeWorldPoint(
      { x: aeLayerPos[0], y: aeLayerPos[1] },
      { x: anchorVal[0], y: anchorVal[1] },
      scaleVal,
      rotVal,
      topLeftLocal
    )

    // Evaluator: the rect's local top-left is [0, 0]
    const states = evaluate(resolved, 0)
    const evalState = states.find(s => s.id === 's5-rect')
    expect(evalState).toBeDefined()

    // Evaluator's world position of top-left corner [0, 0]
    const evalTopLeft = transformPoint(evalState!.matrix, 0, 0)

    expect(aeTopLeft.x).toBeCloseTo(evalTopLeft.x, 1)
    expect(aeTopLeft.y).toBeCloseTo(evalTopLeft.y, 1)

    // Also check bottom-right corner
    const brLocal = {
      x: shapeCenter[0] + w / 2,
      y: shapeCenter[1] + h / 2
    }
    const aeBR = aeWorldPoint(
      { x: aeLayerPos[0], y: aeLayerPos[1] },
      { x: anchorVal[0], y: anchorVal[1] },
      scaleVal,
      rotVal,
      brLocal
    )
    const evalBR = transformPoint(evalState!.matrix, w, h)

    expect(aeBR.x).toBeCloseTo(evalBR.x, 1)
    expect(aeBR.y).toBeCloseTo(evalBR.y, 1)
  })

  it('ellipse with non-zero anchor: AE stub positions match evaluator', () => {
    const fixture: MotionTemplate = {
      schemaVersion: 1,
      id: 'fixture-s5-ellipse',
      version: '1.0.0',
      name: 's5 ellipse',
      description: 'S5 ellipse parity',
      category: 'lower-third',
      status: 'stable',
      tags: ['test'],
      fonts: ['CabritoSemi-NorBol'],
      duration: 4,
      inEnd: 1,
      outStart: 3,
      params: {},
      layers: [
        {
          kind: 'ellipse' as const,
          id: 's5-ellipse',
          anchor: { x: 30, y: 20 },
          position: [{ t: 0, value: { x: 500, y: 400 } }],
          scale: [{ t: 0, value: { x: 2, y: 1.5 } }],
          rotation: [{ t: 0, value: 45 }],
          radiusX: 60,
          radiusY: 40,
          fill: '#00ff00'
        }
      ]
    }

    const format: MotionFormat = { width: 1920, height: 1080, fps: 25 }
    const input = makeInput(fixture, { format })
    const src = getJsxSrc(input)
    const stub = runInAEStub(src)

    const layer = stub.comps[0].layers.find(l => l.name === 's5-ellipse')
    expect(layer).toBeDefined()

    const posProp = layer!.properties['ADBE Position']
    expect(posProp).toBeDefined()
    const aeLayerPos = posProp.keyframes[0]?.value as number[]

    // For ellipse, evaluator local coords: top-left of bounding box is [0, 0],
    // centre is [radiusX, radiusY]. AE's shape centre should map to the same
    // world position as the evaluator's [radiusX, radiusY] in local space.
    const anchorProp = layer!.properties['ADBE Anchor Point']
    expect(anchorProp, 'ADBE Anchor Point must be set for non-zero anchor').toBeDefined()
    const anchorVal = anchorProp.value as number[]

    const scaleProp = layer!.properties['ADBE Scale']
    const aeScale = scaleProp?.keyframes?.[0]?.value as number[]
    const scaleVal = aeScale
      ? { x: aeScale[0] / 100, y: aeScale[1] / 100 }
      : { x: 1, y: 1 }

    const rotProp = layer!.properties['ADBE Rotate Z']
    const rotVal = (rotProp?.keyframes?.[0]?.value as number) ?? 0

    // AE: ellipse shape centre is at [0,0] in local space (no position offset
    // needed since ellipse shape origin is already centred). But we need to
    // account for the ellipse position property if set.
    const ellipsePosProp = layer!.properties['ADBE Vector Ellipse Position']
    const ellipsePos = ellipsePosProp?.value as number[] | undefined
    const shapeCentre = ellipsePos ?? [0, 0]

    // AE world of shape centre
    const aeCenter = aeWorldPoint(
      { x: aeLayerPos[0], y: aeLayerPos[1] },
      { x: anchorVal[0], y: anchorVal[1] },
      scaleVal,
      rotVal,
      { x: shapeCentre[0], y: shapeCentre[1] }
    )

    // Evaluator: the ellipse centre is at local [0, 0] (cx="0" cy="0")
    const resolved = resolveTemplate(fixture, {}, format)
    const states = evaluate(resolved, 0)
    const evalState = states.find(s => s.id === 's5-ellipse')
    expect(evalState).toBeDefined()
    const evalCenter = transformPoint(evalState!.matrix, 0, 0)

    expect(aeCenter.x).toBeCloseTo(evalCenter.x, 1)
    expect(aeCenter.y).toBeCloseTo(evalCenter.y, 1)
  })

  it('text with non-zero anchor: AE positions match evaluator', () => {
    const fixture: MotionTemplate = {
      schemaVersion: 1,
      id: 'fixture-s5-text',
      version: '1.0.0',
      name: 's5 text',
      description: 'S5 text parity',
      category: 'lower-third',
      status: 'stable',
      tags: ['test'],
      fonts: ['CabritoSemi-NorBol'],
      duration: 4,
      inEnd: 1,
      outStart: 3,
      params: {},
      layers: [
        {
          kind: 'text' as const,
          id: 's5-text',
          anchor: { x: 100, y: 50 },
          position: [{ t: 0, value: { x: 600, y: 500 } }],
          scale: [{ t: 0, value: { x: 1.2, y: 0.9 } }],
          rotation: [{ t: 0, value: -15 }],
          text: 'Test',
          font: { family: 'Cabrito Semi', style: 'Norm Bold', size: 80 },
          align: 'left' as const,
          lineHeight: 1.2,
          multiline: false,
          fill: '#ffffff'
        }
      ]
    }

    const format: MotionFormat = { width: 1920, height: 1080, fps: 25 }
    const input = makeInput(fixture, { format })
    const src = getJsxSrc(input)
    const stub = runInAEStub(src)

    const layer = stub.comps[0].layers.find(l => l.name === 's5-text')
    expect(layer).toBeDefined()

    const posProp = layer!.properties['ADBE Position']
    expect(posProp).toBeDefined()
    const aeLayerPos = posProp.keyframes[0]?.value as number[]

    const anchorProp = layer!.properties['ADBE Anchor Point']
    expect(anchorProp, 'ADBE Anchor Point must be set for non-zero anchor').toBeDefined()
    const anchorVal = (anchorProp.value ?? anchorProp.keyframes?.[0]?.value) as number[]

    const scaleProp = layer!.properties['ADBE Scale']
    const aeScale = scaleProp?.keyframes?.[0]?.value as number[]
    const scaleVal = aeScale
      ? { x: aeScale[0] / 100, y: aeScale[1] / 100 }
      : { x: 1, y: 1 }

    const rotProp = layer!.properties['ADBE Rotate Z']
    const rotVal = (rotProp?.keyframes?.[0]?.value as number) ?? 0

    // AE world of layer origin [0, 0] in local space
    const aeOrigin = aeWorldPoint(
      { x: aeLayerPos[0], y: aeLayerPos[1] },
      { x: anchorVal[0], y: anchorVal[1] },
      scaleVal,
      rotVal,
      { x: 0, y: 0 }
    )

    // Evaluator world of [0, 0] in local space
    const resolved = resolveTemplate(fixture, {}, format)
    const states = evaluate(resolved, 0)
    const evalState = states.find(s => s.id === 's5-text')
    expect(evalState).toBeDefined()
    const evalOrigin = transformPoint(evalState!.matrix, 0, 0)

    expect(aeOrigin.x).toBeCloseTo(evalOrigin.x, 1)
    expect(aeOrigin.y).toBeCloseTo(evalOrigin.y, 1)
  })
})

// ---------------------------------------------------------------------------
// S8 - 1-D ease speed sign for decreasing segments
// ---------------------------------------------------------------------------

describe('S8 - 1-D ease speed sign is signed for decreasing segments', () => {
  // Opacity 1 -> 0 over 1s: delta = (0 - 100) / 1 = -100 (AE units).
  // With ease [0.16, 1, 0.3, 1]:
  //   outSpeed = (y1/x1) * delta = (1/0.16) * (-100) = -625
  //   inSpeed  = ((1-y2)/(1-x2)) * delta = (0/0.7) * (-100) = 0
  // The point: outgoing speed is negative for a falling 1-D property.
  // Manual AE check: #339
  const decreasingFixture: MotionTemplate = {
    schemaVersion: 1,
    id: 'fixture-s8-decreasing',
    version: '1.0.0',
    name: 's8 decreasing',
    description: 'Decreasing 1-D segment for S8',
    category: 'lower-third',
    status: 'stable',
    tags: ['test'],
    fonts: ['CabritoSemi-NorBol'],
    duration: 4,
    inEnd: 1,
    outStart: 3,
    params: {},
    layers: [
      {
        kind: 'rect' as const,
        id: 's8-rect',
        anchor: { x: 0, y: 0 },
        width: 100,
        height: 100,
        fill: '#ffffff',
        radius: 0,
        opacity: [
          {
            t: 0,
            value: 1,
            ease: [0.16, 1, 0.3, 1] as [number, number, number, number]
          },
          { t: 1, value: 0 }
        ]
      }
    ]
  }

  it('opacity ease speed is negative for a falling segment', () => {
    const src = getJsxSrc(makeInput(decreasingFixture))
    const stub = runInAEStub(src)

    const layer = stub.comps[0].layers.find(l => l.name === 's8-rect')
    expect(layer).toBeDefined()

    const op = layer!.properties['ADBE Opacity']
    expect(op).toBeDefined()

    // Key 1 (first key): outEase speed should be negative because
    // the value is decreasing (100 -> 0 in AE units, delta < 0).
    // With ease [0.16, 1, 0.3, 1]: outSpeed = (1/0.16) * (-100) = -625
    const kf0 = op.keyframes[0]
    expect(kf0.outEase).toBeDefined()
    expect(
      kf0.outEase![0].speed,
      'outgoing speed should be negative for a falling 1-D segment'
    ).toBeLessThan(0)
    // Exact value check
    expect(kf0.outEase![0].speed).toBeCloseTo(-625, 0)

    // Key 2 (last key): inEase speed = ((1-y2)/(1-x2)) * delta = 0 * (-100) = 0
    // That is fine (zero speed is valid for a key that arrives flat).
    const kf1 = op.keyframes[1]
    expect(kf1.inEase).toBeDefined()
    expect(kf1.inEase![0].speed).toBeCloseTo(0, 1)
  })

  it('spatial position speed remains positive (magnitude)', () => {
    // Verify that spatial properties still use abs(delta)
    const spatialFixture: MotionTemplate = {
      schemaVersion: 1,
      id: 'fixture-s8-spatial',
      version: '1.0.0',
      name: 's8 spatial',
      description: 'Spatial position for S8',
      category: 'lower-third',
      status: 'stable',
      tags: ['test'],
      fonts: ['CabritoSemi-NorBol'],
      duration: 4,
      inEnd: 1,
      outStart: 3,
      params: {},
      layers: [
        {
          kind: 'rect' as const,
          id: 's8-spatial-rect',
          anchor: { x: 0, y: 0 },
          width: 100,
          height: 100,
          fill: '#ffffff',
          radius: 0,
          position: [
            {
              t: 0,
              value: { x: 500, y: 500 },
              ease: [0.16, 1, 0.3, 1] as [number, number, number, number]
            },
            { t: 1, value: { x: 100, y: 100 } }
          ]
        }
      ]
    }

    const src = getJsxSrc(makeInput(spatialFixture))
    const stub = runInAEStub(src)

    const layer = stub.comps[0].layers.find(l => l.name === 's8-spatial-rect')
    expect(layer).toBeDefined()

    const pos = layer!.properties['ADBE Position']
    expect(pos).toBeDefined()

    const kf0 = pos.keyframes[0]
    expect(kf0.outEase).toBeDefined()
    expect(
      kf0.outEase![0].speed,
      'spatial position speed should be positive (magnitude)'
    ).toBeGreaterThanOrEqual(0)
  })
})

// ---------------------------------------------------------------------------
// S6 - Multiline text uses point text, not box text
// ---------------------------------------------------------------------------

describe('S6 - multiline text uses addText (not addBoxText)', () => {
  // Layer base without the param field so resolveTemplate does not overwrite the text
  const s6LayerBase = { ...textLayerBase }
  delete (s6LayerBase as Record<string, unknown>).param

  it('multiline text with width emits addText, not addBoxText', () => {
    const fixture: MotionTemplate = {
      ...textFixture,
      id: 'fixture-s6-multiline',
      params: {},
      layers: [
        {
          ...s6LayerBase,
          multiline: true,
          width: 800,
          text: 'Line 1\nLine 2\nLine 3'
        }
      ]
    }
    const src = getJsxSrc(makeInput(fixture))
    const stub = runInAEStub(src)

    const tl = stub.comps[0].layers.find(l => l.kind === 'text')
    expect(tl).toBeDefined()

    // Must NOT be box text - should be point text
    const tdProp = tl!.properties['ADBE Text Document']
    expect(tdProp).toBeDefined()
    const tdoc = tdProp.value as { boxText: boolean; pointText: boolean }
    expect(tdoc.boxText, 'should not use addBoxText').toBe(false)
    expect(tdoc.pointText, 'should use addText (point text)').toBe(true)
  })

  it('multiline text contains line breaks in the source text', () => {
    const fixture: MotionTemplate = {
      ...textFixture,
      id: 'fixture-s6-breaks',
      params: {},
      layers: [
        {
          ...s6LayerBase,
          multiline: true,
          width: 800,
          text: 'Line 1\nLine 2'
        }
      ]
    }
    const src = getJsxSrc(makeInput(fixture))

    // The JSX should contain \r line breaks (AE convention), not \n
    expect(src).toContain('\\r')
    // Should NOT contain addBoxText
    expect(src).not.toContain('addBoxText')
    // Should contain addText
    expect(src).toContain('addText')
  })
})
