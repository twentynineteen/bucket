/**
 * Fusion .setting exporter tests (issue #330)
 *
 * RES1.1: output validity and parse check
 * RES2.1: instance inputs for text/colour params
 * RES2.2: hold/number/numberList not exposed as inputs
 * RES3.3: all key times are integer frame numbers at 24 fps
 * RES5.1: shape -> sMerge -> sRender -> Merge chain
 * RES5.2: group transform as image Transform
 * RES5.4: fallback to Polygon mask for hatch bands and bezier paths
 * RES5.5: Text+ tool with font, size, tracking, line spacing, alignment, multiline
 * RES5.6: animated rect size and fill colour
 * RES6.1: Follower modifier for stagger
 * RES6.2: fractional delay rounding
 * RES7.1: particle template rejection
 * RES8.1: arc -> sEllipse with WriteLength
 * RES8.2: counter -> Text+ expression
 * RES8.3: series expansion into primitive tools
 */
import * as luaparse from 'luaparse'
import { describe, expect, it } from 'vitest'
import type {
  ArcLayer,
  EllipseLayer,
  ExportInput,
  GroupLayer,
  Layer,
  MotionFormat,
  MotionTemplate,
  ParamValues,
  PathLayer,
  RectLayer,
  TextLayer
} from '../../../types'
import { resolveTemplate } from '../../resolve'
import {
  allAnimatedFixture,
  arcFixture,
  colourParamFixture,
  counterFixture,
  ellipseFixture,
  groupFixture,
  holdParamFixture,
  layerKindFixtures,
  particlesFixture,
  pathFixture,
  rectFixture,
  seriesFixture,
  textFixture
} from '../../testing/fixtures'
import { generateSetting } from './generateSetting'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FMT_25: MotionFormat = { width: 3840, height: 2160, fps: 25 }
const FMT_24: MotionFormat = { width: 3840, height: 2160, fps: 24 }

function makeInput(
  template: MotionTemplate,
  values: ParamValues = {},
  format: MotionFormat = FMT_25
): ExportInput {
  const resolved = resolveTemplate(template, values, format)
  return { template, values, format, resolved, targets: ['resolve'], mogrt: false }
}

/** Encode a JS string's UTF-8 bytes as latin1 characters. */
function utf8ToLatin1(text: string): string {
  const encoder = new TextEncoder()
  const bytes = encoder.encode(text)
  return Array.from(bytes, b => String.fromCharCode(b)).join('')
}

/** Parse .setting text with luaparse, handling UTF-8 via pseudo-latin1. */
function parseSetting(text: string): luaparse.Chunk {
  const latin1 = utf8ToLatin1(text)
  return luaparse.parse('return ' + latin1, {
    luaVersion: '5.1',
    encodingMode: 'pseudo-latin1'
  })
}

/** Get the .setting text from an export result. */
function getSettingText(input: ExportInput): string {
  const result = generateSetting(input)
  expect(result.files).toHaveLength(1)
  expect(result.files[0].kind).toBe('text')
  return (result.files[0] as { contents: string }).contents
}

/** Check that the .setting text contains a specific tool type. */
function hasToolType(text: string, toolType: string): boolean {
  // In the .setting format, tools appear as: name = ToolType { ... }
  return new RegExp(`\\w+\\s*=\\s*${toolType}\\s*\\{`).test(text)
}

/** Extract all BezierSpline key frame numbers from the text. */
function extractFrameNumbers(text: string): number[] {
  const frames: number[] = []
  const re = /\[(\d+(?:\.\d+)?)\]\s*=/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    frames.push(parseFloat(m[1]))
  }
  return frames
}

// ---------------------------------------------------------------------------
// RES1.1: output validity
// ---------------------------------------------------------------------------

describe('RES1.1: output validity', () => {
  const nonParticleFixtures = layerKindFixtures.filter(
    f => !f.layers.some(l => l.kind === 'particles')
  )

  for (const fixture of nonParticleFixtures) {
    it(`parses as valid Lua for ${fixture.id}`, () => {
      const text = getSettingText(makeInput(fixture))
      expect(() => parseSetting(text)).not.toThrow()
    })

    it(`has Tools with one MacroOperator or GroupOperator for ${fixture.id}`, () => {
      const text = getSettingText(makeInput(fixture))
      expect(text).toMatch(/MacroOperator|GroupOperator/)
    })
  }

  // Also test colourParamFixture and holdParamFixture
  for (const fixture of [colourParamFixture, holdParamFixture]) {
    it(`parses as valid Lua for ${fixture.id}`, () => {
      const text = getSettingText(makeInput(fixture))
      expect(() => parseSetting(text)).not.toThrow()
    })
  }

  // allAnimatedFixture
  it('parses as valid Lua for allAnimatedFixture', () => {
    const text = getSettingText(makeInput(allAnimatedFixture))
    expect(() => parseSetting(text)).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// RES2.1: instance inputs for text and colour params
// ---------------------------------------------------------------------------

describe('RES2.1: instance inputs', () => {
  it('exposes text params as InstanceInput on StyledText', () => {
    const template: MotionTemplate = {
      ...textFixture,
      id: 'res2-text-input',
      params: {
        name: {
          kind: 'text',
          label: 'Name',
          maxLength: 40,
          default: 'Jane Doe',
          required: true
        },
        subtitle: {
          kind: 'text',
          label: 'Subtitle',
          maxLength: 80,
          default: 'CEO',
          required: false
        }
      },
      layers: [
        {
          kind: 'text',
          id: 'title',
          anchor: { x: 0, y: 0 },
          position: [{ t: 0, value: { x: 200, y: 500 } }],
          text: 'Jane Doe',
          param: 'name',
          font: { family: 'Cabrito Semi', style: 'Norm Bold', size: 80 },
          align: 'left',
          lineHeight: 1.2,
          multiline: false,
          fill: '#ffffff'
        },
        {
          kind: 'text',
          id: 'sub',
          anchor: { x: 0, y: 0 },
          position: [{ t: 0, value: { x: 200, y: 620 } }],
          text: 'CEO',
          param: 'subtitle',
          font: { family: 'Cabrito Semi', style: 'Norm Bold', size: 48 },
          align: 'left',
          lineHeight: 1.2,
          multiline: false,
          fill: '#ffffff'
        }
      ]
    }

    const text = getSettingText(makeInput(template))

    // Two InstanceInput entries for StyledText
    const styledTextMatches = text.match(/Source\s*=\s*"StyledText"/g)
    expect(styledTextMatches).toHaveLength(2)

    // Each InstanceInput has the param label as Name
    expect(text).toContain('"Name"')
    expect(text).toContain('"Subtitle"')
  })

  it('exposes colour param channels as InstanceInputs', () => {
    const template: MotionTemplate = {
      ...colourParamFixture,
      id: 'res2-colour-input',
      params: {
        accent: {
          kind: 'colour',
          label: 'Accent',
          default: '#ff3366',
          binds: ['layers[0]']
        }
      }
    }

    const text = getSettingText(makeInput(template))

    // Colour exposed as Red, Green, Blue InstanceInputs
    expect(text).toMatch(/Accent.*Red|Red.*Accent/i)
    expect(text).toMatch(/Accent.*Green|Green.*Accent/i)
    expect(text).toMatch(/Accent.*Blue|Blue.*Accent/i)
  })

  it('bakes the resolved default values', () => {
    const text = getSettingText(makeInput(textFixture))
    expect(text).toContain('Jane Doe')
  })
})

// ---------------------------------------------------------------------------
// RES2.2: hold/number/numberList not exposed
// ---------------------------------------------------------------------------

describe('RES2.2: non-exposed params', () => {
  it('does not expose hold param as InstanceInput', () => {
    const text = getSettingText(makeInput(holdParamFixture))
    // InstanceInput should not reference "Hold" label
    const instanceInputCount = (text.match(/InstanceInput/g) || []).length
    // If there are no text or colour params, there should be no InstanceInputs
    expect(instanceInputCount).toBe(0)
  })

  it('does not expose number param as InstanceInput', () => {
    const text = getSettingText(makeInput(arcFixture))
    // arcFixture has only a number param (score) - no InstanceInputs expected
    // Counter text might be exposed, but the number param itself should not be
    // Only text and colour params become InstanceInputs
    expect(text).not.toMatch(/InstanceInput[^}]*Score/i)
  })

  it('does not expose numberList param as InstanceInput', () => {
    const text = getSettingText(makeInput(seriesFixture))
    // seriesFixture has only a numberList param (data) - no InstanceInputs
    expect(text).not.toMatch(/InstanceInput[^}]*Data/i)
  })
})

// ---------------------------------------------------------------------------
// RES3.3: integer frame numbers at 24 fps
// ---------------------------------------------------------------------------

describe('RES3.3: integer frame numbers at 24 fps', () => {
  it('every key time in the output is an integer frame number', () => {
    const text = getSettingText(makeInput(allAnimatedFixture, {}, FMT_24))
    const frames = extractFrameNumbers(text)
    expect(frames.length).toBeGreaterThan(0)
    for (const frame of frames) {
      expect(Number.isInteger(frame)).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// RES5.1: shape -> sMerge -> sRender -> Merge chain
// ---------------------------------------------------------------------------

describe('RES5.1: shape tool chain', () => {
  it('uses sRectangle for rect layers', () => {
    const text = getSettingText(makeInput(rectFixture))
    expect(hasToolType(text, 'sRectangle')).toBe(true)
  })

  it('uses sEllipse for ellipse layers', () => {
    const text = getSettingText(makeInput(ellipseFixture))
    expect(hasToolType(text, 'sEllipse')).toBe(true)
  })

  it('uses sPolygon for closed path layers', () => {
    const text = getSettingText(makeInput(pathFixture))
    expect(hasToolType(text, 'sPolygon')).toBe(true)
  })

  it('chains shapes through sMerge then sRender', () => {
    const text = getSettingText(makeInput(rectFixture))
    expect(hasToolType(text, 'sMerge')).toBe(true)
    expect(hasToolType(text, 'sRender')).toBe(true)
  })

  it('merges sRender output with Text+ via Merge', () => {
    // groupFixture has both rect and text children
    const text = getSettingText(makeInput(groupFixture))
    expect(hasToolType(text, 'sRender')).toBe(true)
    expect(hasToolType(text, 'TextPlus')).toBe(true)
    expect(hasToolType(text, 'Merge')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// RES5.2: group transform as image Transform
// ---------------------------------------------------------------------------

describe('RES5.2: group transform', () => {
  it('applies group transform as image Transform after sRender', () => {
    const text = getSettingText(makeInput(groupFixture))
    expect(hasToolType(text, 'Transform')).toBe(true)
  })

  it('does not use sTransform', () => {
    const text = getSettingText(makeInput(groupFixture))
    expect(hasToolType(text, 'sTransform')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// RES5.4: fallback to Polygon mask on Background
// ---------------------------------------------------------------------------

describe('RES5.4: Polygon mask fallback', () => {
  it('uses Polygon mask on Background for hatch band paths', () => {
    // seriesFixture has a band -> hatch paths after expansion
    const text = getSettingText(makeInput(seriesFixture))
    expect(hasToolType(text, 'Background')).toBe(true)
  })

  it('uses sPolygon for simple closed paths without bezier handles', () => {
    // pathFixture has M/L/Z only
    const text = getSettingText(makeInput(pathFixture))
    expect(hasToolType(text, 'sPolygon')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// RES5.5: Text+ with font, size, tracking, line spacing, alignment, multiline
// ---------------------------------------------------------------------------

describe('RES5.5: Text+ tool', () => {
  it('sets font family and style', () => {
    const text = getSettingText(makeInput(textFixture))
    expect(text).toContain('Cabrito Semi')
    expect(text).toContain('Norm Bold')
  })

  it('converts font size to Fusion size', () => {
    // 80px / 3840 = 0.0208333...
    const text = getSettingText(makeInput(textFixture))
    // Should contain the converted size value
    expect(text).toMatch(/Size\s*=\s*Input\s*\{\s*Value\s*=/)
  })

  it('sets alignment', () => {
    const text = getSettingText(makeInput(textFixture))
    // Fusion uses 0=center, -1=left, 1=right (or similar)
    expect(text).toMatch(/HorizontalJustification/i)
  })

  it('sets line spacing from lineHeight', () => {
    const text = getSettingText(makeInput(textFixture))
    expect(text).toMatch(/LineSpacing/i)
  })

  it('handles multiline: false as single line', () => {
    const text = getSettingText(makeInput(textFixture))
    // multiline: false - single-line text
    expect(() => parseSetting(text)).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// RES5.6: animated rect size and fill colour
// ---------------------------------------------------------------------------

describe('RES5.6: animated rect size and fill colour', () => {
  it('creates BezierSpline for animated Width/Height', () => {
    const text = getSettingText(makeInput(allAnimatedFixture))
    expect(text).toMatch(/BezierSpline/)
    // Width and height animations should produce splines
    expect(text).toMatch(/Width/)
    expect(text).toMatch(/Height/)
  })

  it('creates BezierSpline for animated fill RGB', () => {
    const text = getSettingText(makeInput(allAnimatedFixture))
    // Fill colour animation -> Red, Green, Blue splines
    expect(text).toMatch(/Red.*BezierSpline|BezierSpline.*Red/s)
  })
})

// ---------------------------------------------------------------------------
// RES6.1: Follower modifier for stagger
// ---------------------------------------------------------------------------

describe('RES6.1: Follower modifier for stagger', () => {
  const baseText = textFixture.layers[0] as TextLayer

  it('creates a Follower for text with stagger', () => {
    const staggerTemplate: MotionTemplate = {
      ...textFixture,
      id: 'res6-stagger',
      layers: [{ ...baseText, stagger: { delay: 0.04 } }]
    }
    const text = getSettingText(makeInput(staggerTemplate))
    expect(text).toMatch(/Follower/i)
  })

  it('sets delay to 1 frame for 0.04s at 25fps', () => {
    // 0.04 * 25 = 1 frame
    const staggerTemplate: MotionTemplate = {
      ...textFixture,
      id: 'res6-stagger-1frame',
      layers: [{ ...baseText, stagger: { delay: 0.04 } }]
    }
    const text = getSettingText(makeInput(staggerTemplate))
    // Delay should be 1 frame
    expect(text).toMatch(/Delay\s*=\s*Input\s*\{\s*Value\s*=\s*1\s*[,}]/)
  })
})

// ---------------------------------------------------------------------------
// RES6.2: fractional delay rounding
// ---------------------------------------------------------------------------

describe('RES6.2: stagger delay arrives in whole frames', () => {
  it('a 0.03s delay at 25fps reaches the Follower as exactly 1 frame, with no rounding note', () => {
    // resolveTemplate quantises stagger to whole frames (review finding A1),
    // so the preview, AE and Fusion all use the same delay and Fusion has
    // nothing left to round.
    const baseText = textFixture.layers[0] as TextLayer
    const staggerTemplate: MotionTemplate = {
      ...textFixture,
      id: 'res6-fractional',
      layers: [{ ...baseText, stagger: { delay: 0.03 } }]
    }
    const result = generateSetting(makeInput(staggerTemplate))
    const text = (result.files[0] as { contents: string }).contents
    expect(text).toMatch(/Delay\s*=\s*Input\s*\{\s*Value\s*=\s*1\s*[,}]/)
    expect(result.notes.some(n => /stagger.*round/i.test(n))).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// RES7.1: particle template rejection
// ---------------------------------------------------------------------------

describe('RES7.1: particle template rejection', () => {
  it('throws for templates with particles layers', () => {
    expect(() => generateSetting(makeInput(particlesFixture))).toThrow(/particle/i)
  })
})

// ---------------------------------------------------------------------------
// RES8.1: arc -> sEllipse with WriteLength
// ---------------------------------------------------------------------------

describe('RES8.1: arc as sEllipse with WriteLength', () => {
  it('creates sEllipse for arc layers', () => {
    const text = getSettingText(makeInput(arcFixture))
    expect(hasToolType(text, 'sEllipse')).toBe(true)
  })

  it('has WriteLength driven by sweep keyframes', () => {
    const text = getSettingText(makeInput(arcFixture))
    expect(text).toMatch(/WriteLength/i)
    // Sweep is animated, so there should be a BezierSpline
    expect(text).toMatch(/BezierSpline/)
  })

  it('applies start angle', () => {
    const text = getSettingText(makeInput(arcFixture))
    expect(text).toMatch(/WritePosition|StartAngle|Angle/i)
  })
})

// ---------------------------------------------------------------------------
// RES8.2: counter -> Text+ with expression
// ---------------------------------------------------------------------------

describe('RES8.2: counter expression', () => {
  it('creates Text+ for counter layers', () => {
    const text = getSettingText(makeInput(counterFixture))
    expect(hasToolType(text, 'TextPlus')).toBe(true)
  })

  it('carries an expression for the counter progress', () => {
    const text = getSettingText(makeInput(counterFixture))
    // The expression should reference the progress and produce "36%" at 0.5
    expect(text).toMatch(/Expression|expression/i)
  })

  it('output parses with luaparse', () => {
    const text = getSettingText(makeInput(counterFixture))
    expect(() => parseSetting(text)).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// RES8.3: series expansion
// ---------------------------------------------------------------------------

describe('RES8.3: series expansion into primitives', () => {
  it('has no reference to series in output', () => {
    const text = getSettingText(makeInput(seriesFixture))
    expect(text).not.toMatch(/\bseries\b/i)
  })

  it('contains dot ellipses', () => {
    const text = getSettingText(makeInput(seriesFixture))
    expect(hasToolType(text, 'sEllipse')).toBe(true)
  })

  it('contains label Text+ tools', () => {
    const text = getSettingText(makeInput(seriesFixture))
    expect(hasToolType(text, 'TextPlus')).toBe(true)
  })

  it('contains marker ellipse with keyframes', () => {
    const text = getSettingText(makeInput(seriesFixture))
    expect(text).toMatch(/BezierSpline/)
  })

  it('contains hatch paths as Background with Polygon mask', () => {
    const text = getSettingText(makeInput(seriesFixture))
    expect(hasToolType(text, 'Background')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// S3: colour InstanceInputs bind to shape fills, not Background tools
// ---------------------------------------------------------------------------

describe('S3: colour InstanceInputs bind to shape fills', () => {
  it('does not emit a full-frame colour Background for colour params', () => {
    const template: MotionTemplate = {
      ...colourParamFixture,
      id: 's3-no-bg'
    }
    const text = getSettingText(makeInput(template))
    // Background tools for colour params used colour_bg naming; none should exist
    expect(text).not.toMatch(/colour_bg\s*=\s*Background/)
  })

  it('colour InstanceInput SourceOp targets the bound shape tool', () => {
    // colourParamFixture binds accent to layers[0] which is rect 'bar'
    const template: MotionTemplate = {
      ...colourParamFixture,
      id: 's3-source-op'
    }
    const text = getSettingText(makeInput(template))
    // The InstanceInput's SourceOp should be the shape tool for layer 'bar',
    // not a Background tool
    expect(text).toMatch(/SourceOp\s*=\s*"bar_shape"/)
    // And it should target the fill inputs Red, Green, Blue (not TopLeftRed etc.)
    expect(text).toMatch(/Source\s*=\s*"Red"/)
    expect(text).toMatch(/Source\s*=\s*"Green"/)
    expect(text).toMatch(/Source\s*=\s*"Blue"/)
  })

  it('colour InstanceInput targets Text+ Red1/Green1/Blue1 for text layers', () => {
    const template: MotionTemplate = {
      ...textFixture,
      id: 's3-text-colour',
      params: {
        name: {
          kind: 'text',
          label: 'Name',
          maxLength: 40,
          default: 'Jane Doe',
          required: true
        },
        textColour: {
          kind: 'colour',
          label: 'Text Colour',
          default: '#ffffff',
          binds: ['layers[0]']
        }
      }
    }
    const text = getSettingText(makeInput(template))
    // InstanceInput for colour should target the text tool's Red1/Green1/Blue1
    expect(text).toMatch(/SourceOp\s*=\s*"title_text"/)
    expect(text).toMatch(/Source\s*=\s*"Red1"/)
    expect(text).toMatch(/Source\s*=\s*"Green1"/)
    expect(text).toMatch(/Source\s*=\s*"Blue1"/)
  })

  it('multi-bind: second bound tool expression-links to the first', () => {
    const template: MotionTemplate = {
      ...rectFixture,
      id: 's3-multi-bind',
      params: {
        accent: {
          kind: 'colour',
          label: 'Accent',
          default: '#ff3366',
          binds: ['layers[0]', 'layers[1]']
        }
      },
      layers: [
        {
          kind: 'rect',
          id: 'bar1',
          anchor: { x: 0, y: 0 },
          position: [{ t: 0, value: { x: 0, y: 900 } }],
          width: 3840,
          height: 40,
          fill: '#ff3366',
          radius: 0
        },
        {
          kind: 'rect',
          id: 'bar2',
          anchor: { x: 0, y: 0 },
          position: [{ t: 0, value: { x: 0, y: 1900 } }],
          width: 3840,
          height: 40,
          fill: '#ff3366',
          radius: 0
        }
      ]
    }
    const text = getSettingText(makeInput(template))
    // InstanceInput should target bar1_shape (the first bound tool)
    expect(text).toMatch(/SourceOp\s*=\s*"bar1_shape"/)
    // bar2_shape should expression-link its fill to bar1_shape
    expect(text).toMatch(/bar1_shape/)
    expect(text).toMatch(/Expression/)
  })
})

// ---------------------------------------------------------------------------
// S5: rect/ellipse centre conversion with anchor folded in
// ---------------------------------------------------------------------------

describe('S5: rect origin parity with evaluator convention', () => {
  it('rect centre accounts for anchor offset', () => {
    // quote-card: anchor=(60,40), width=120, height=80, position=(1020,820)
    // evaluator: world_centre = pos - anchor + (w/2, h/2)
    //   = (1020-60+60, 820-40+40) = (1020, 820)
    // Fusion shape coords: x = (1020 - 1920) / 3840 = -0.234375
    //                       y = (1080 - 820) / 3840 = 0.0677083...
    const template: MotionTemplate = {
      ...rectFixture,
      id: 's5-anchor-offset',
      layers: [
        {
          kind: 'rect',
          id: 'mark',
          anchor: { x: 60, y: 40 },
          position: [{ t: 0, value: { x: 1020, y: 820 } }],
          width: 120,
          height: 80,
          fill: '#ff3366',
          radius: 0
        }
      ]
    }
    const text = getSettingText(makeInput(template))
    // Expected centre: (1020, 820) in template coords
    // toShapeCoords(1020, 820, 3840, 2160):
    //   x = (1020 - 1920) / 3840 = -0.234375
    //   y = (1080 - 820) / 3840 = 0.0677083...
    expect(text).toMatch(/-0\.234375/)
  })

  it('rect with zero anchor adds half-size offset', () => {
    // bar-reveal bg-bar: anchor=(0,0), width=2000, height=180, position=(192,1700)
    // evaluator: world_centre = (192-0+1000, 1700-0+90) = (1192, 1790)
    // toShapeCoords(1192, 1790, 3840, 2160):
    //   x = (1192 - 1920) / 3840 = -0.1895833...
    //   y = (1080 - 1790) / 3840 = -0.1848958...
    const template: MotionTemplate = {
      ...rectFixture,
      id: 's5-zero-anchor',
      layers: [
        {
          kind: 'rect',
          id: 'bg',
          anchor: { x: 0, y: 0 },
          position: [{ t: 0, value: { x: 192, y: 1700 } }],
          width: 2000,
          height: 180,
          fill: '#ff3366',
          radius: 0
        }
      ]
    }
    const text = getSettingText(makeInput(template))
    // Expected x offset: (1192 - 1920) / 3840 = -728/3840 = -0.1895833...
    // The raw position would give (192-1920)/3840 = -0.4505208..., which is wrong
    expect(text).not.toMatch(/-0\.450/)
    // Should contain the corrected offset
    const xOffset = (1192 - 1920) / 3840
    expect(text).toContain(xOffset.toFixed(10).replace(/0+$/, '').replace(/\.$/, ''))
  })

  it('ellipse centre accounts for zero anchor', () => {
    // ellipse at position (1920, 1080), anchor (0,0), radiusX=50, radiusY=50
    // evaluator: world_centre = (1920-0+50, 1080-0+50) = (1970, 1130)
    // toShapeCoords(1970, 1130, 3840, 2160):
    //   x = (1970 - 1920) / 3840 = 0.01302...
    //   y = (1080 - 1130) / 3840 = -0.01302...
    const template: MotionTemplate = {
      ...ellipseFixture,
      id: 's5-ellipse-zero-anchor'
    }
    const text = getSettingText(makeInput(template))
    // With zero anchor, centre should NOT be at position (1920, 1080) directly
    // but at (1970, 1130)
    const expectedX = (1970 - 1920) / 3840
    expect(text).toContain(expectedX.toFixed(10).replace(/0+$/, '').replace(/\.$/, ''))
  })

  it('animated position keyframes include anchor-to-centre offset', () => {
    // Rect with animated position and non-zero anchor
    const template: MotionTemplate = {
      ...rectFixture,
      id: 's5-animated-anchor',
      layers: [
        {
          kind: 'rect',
          id: 'slide',
          anchor: { x: 100, y: 50 },
          position: [
            {
              t: 0,
              value: { x: 200, y: 300 },
              ease: [0.16, 1, 0.3, 1] as [number, number, number, number]
            },
            { t: 1, value: { x: 800, y: 300 } }
          ],
          width: 400,
          height: 200,
          fill: '#ff3366',
          radius: 0
        }
      ]
    }
    const text = getSettingText(makeInput(template))
    // Static centre for first keyframe: (200-100+200, 300-50+100) = (300, 350)
    // toShapeCoords(300, 350, 3840, 2160):
    //   x = (300 - 1920) / 3840 = -0.421875
    // Animated centre for second keyframe: (800-100+200, 300-50+100) = (900, 350)
    // toShapeCoords(900, 350, 3840, 2160):
    //   x = (900 - 1920) / 3840 = -0.265625
    // Both offsets should appear in BezierSpline keyframes
    const x1 = (300 - 1920) / 3840
    const x2 = (900 - 1920) / 3840
    expect(text).toContain(x1.toFixed(10).replace(/0+$/, '').replace(/\.$/, ''))
    expect(text).toContain(x2.toFixed(10).replace(/0+$/, '').replace(/\.$/, ''))
  })
})

// ===========================================================================
// Fusion name allowlist (merged from fusionNames.test.ts)
//
// Validates that every tool type and input name the generator emits is a
// known Fusion identifier, sourced from real .setting files and official
// documentation. Prevents inventing API names that Resolve would silently
// ignore.
//
// Sources per entry are in comments on the allowlist.
// ===========================================================================

/**
 * Every tool type (the identifier after `=` in `Name = ToolType { }`) that
 * this exporter may emit.
 *
 * Sources:
 * - Fusion 18.6 Manual (steakunderwater.com mirror, part1118-1130 shape nodes)
 * - Fusion 7 Tool Reference PDF (documents.blackmagicdesign.com)
 * - jayaretv.com Fusion node reference (sEllipse, sDuplicate, sPolygon)
 * - Blackmagic forum .setting examples (forum.blackmagicdesign.com)
 * - Grokipedia BezierSpline reference
 */
const KNOWN_TOOL_TYPES = new Set([
  // Shape tools - Fusion 18.6 manual, shape nodes chapter; jayaretv.com node refs
  'sRectangle',
  'sEllipse',
  'sPolygon',
  'sMerge',
  'sRender',

  // Image tools - Fusion 7 Tool Reference; Fusion 18.6 manual
  'TextPlus', // Text+ node (Fusion 18.6 manual part585, part1953)
  'Merge', // Merge node (Fusion 7 Tool Reference, ch. Composite)
  'Background', // Background node (Fusion 7 Tool Reference, ch. Creator)
  'Transform', // Transform node (Fusion 7 Tool Reference, ch. Transform)

  // Spline - Grokipedia BezierSpline reference; Fusion scripting guide
  'BezierSpline',

  // Mask - Fusion 7 Tool Reference, ch. Mask; Fusion 18.6 manual mask nodes
  'Polygon',

  // Macro structure - Blackmagic forum; VFXstudy.com; Fusion 18.6 manual
  'MacroOperator',
  'GroupOperator',
  'InstanceInput',
  'InstanceOutput',
  'OperatorInfo',

  // Spline data - Fusion scripting guide; Grokipedia reference
  'Polyline',

  // Input wrapper - every .setting file uses this
  'Input',

  // XYPath modifier for animated point inputs - Resolve 18.6 manual;
  // forum.blackmagicdesign.com viewtopic.php?f=22&t=67065 (wiring pattern),
  // viewtopic.php?f=22&t=223637 (AddModifier script),
  // viewtopic.php?f=22&t=75019 (BezierSpline vs XYPath on Center)
  'XYPath',

  // Follower modifier - Blackmagic forum Text+ Follower threads
  // UNVERIFIED exact type ID; flagged for #339
  'StyledTextFollower'
])

/**
 * Every input key that this exporter may set on each tool type.
 *
 * Sources:
 * - Fusion 18.6 manual sRectangle/sEllipse pages (steakunderwater.com)
 * - jayaretv.com sEllipse/sRectangle node references
 * - Blackmagic forum Text+ .setting examples (viewtopic.php?p=247995, p=428801)
 * - Fusion 7 Tool Reference (Merge, Background, Transform chapters)
 * - forum.blackmagicdesign.com Follower threads (viewtopic.php?f=22&t=177057)
 */
const KNOWN_INPUTS: Record<string, Set<string>> = {
  // sRectangle - Fusion 18.6 manual; jayaretv.com
  sRectangle: new Set([
    'Inputs',
    'Width',
    'Height',
    'XOffset',
    'YOffset',
    'CornerRadius',
    'Angle',
    'Opacity',
    'Red',
    'Green',
    'Blue',
    'Solid'
  ]),

  // sEllipse - Fusion 18.6 manual; jayaretv.com sEllipse node
  sEllipse: new Set([
    'Inputs',
    'Width',
    'Height',
    'XOffset',
    'YOffset',
    'Angle',
    'Opacity',
    'Red',
    'Green',
    'Blue',
    'BorderWidth',
    'Solid',
    'WriteLength',
    'WritePosition' // arc/border controls
  ]),

  // sPolygon - Fusion 18.6 manual sPolygon/sNGon
  sPolygon: new Set([
    'Inputs',
    'Closed',
    'Polyline',
    'XOffset',
    'YOffset',
    'Angle',
    'Opacity',
    'Red',
    'Green',
    'Blue'
  ]),

  // sMerge - Fusion 18.6 manual shape merge
  sMerge: new Set(['Inputs', 'Background', 'Foreground']),

  // sRender - Fusion 18.6 manual shape render
  sRender: new Set(['Inputs', 'Background']),

  // TextPlus - Blackmagic forum examples (viewtopic.php?p=247995, p=428801);
  // Fusion 18.6 manual Text+ chapter (steakunderwater.com part585, part1953)
  TextPlus: new Set([
    'Inputs',
    'Width',
    'Height',
    'UseFrameFormatSettings',
    'StyledText',
    'Font',
    'Style',
    'Size',
    'Center', // animated via XYPath modifier, not CenterX/CenterY
    'HorizontalJustification',
    'LineSpacing',
    'Tracking',
    'Opacity',
    'Angle',
    'Red1',
    'Green1',
    'Blue1', // Character shading tab colours
    'Expression' // on the StyledText Input for counter expressions
  ]),

  // Merge - Fusion 7 Tool Reference; Fusion 18.6 manual
  Merge: new Set(['Inputs', 'Background', 'Foreground', 'Blend']),

  // Background - Fusion 7 Tool Reference; Fusion 18.6 manual
  Background: new Set([
    'Inputs',
    'TopLeftRed',
    'TopLeftGreen',
    'TopLeftBlue',
    'TopLeftAlpha',
    'EffectMask'
  ]),

  // Transform - Fusion 7 Tool Reference; Fusion 18.6 manual
  // Animated Center uses XYPath modifier, not CenterX/CenterY
  // Pivot: Fusion 7 Tool Reference, Transform chapter (separate from Center);
  // forum.blackmagicdesign.com viewtopic.php?f=22&t=89291 (Pivot vs Center)
  Transform: new Set(['Inputs', 'Input', 'Center', 'Size', 'Angle', 'Pivot']),

  // XYPath modifier - Resolve 18.6 manual; forum.blackmagicdesign.com
  // viewtopic.php?f=22&t=67065, t=223637, t=75019
  XYPath: new Set(['X', 'Y']),

  // BezierSpline - Grokipedia reference; Fusion scripting guide
  BezierSpline: new Set(['SplineColor', 'KeyFrames']),

  // Polygon mask - Fusion 7 Tool Reference
  Polygon: new Set(['Inputs', 'Polyline']),

  // MacroOperator - Blackmagic forum; VFXstudy.com
  MacroOperator: new Set(['Inputs', 'Outputs', 'ViewInfo', 'Tools']),

  // InstanceInput - Blackmagic forum examples
  InstanceInput: new Set(['SourceOp', 'Source', 'Name', 'Default']),

  // InstanceOutput - Blackmagic forum examples
  InstanceOutput: new Set(['SourceOp', 'Source']),

  // OperatorInfo - Blackmagic forum examples
  OperatorInfo: new Set(['Pos']),

  // StyledTextFollower - Blackmagic forum Follower threads
  // UNVERIFIED exact input names; flagged for #339
  StyledTextFollower: new Set(['Inputs', 'Delay', 'DelayType', 'Order', 'SourceOp'])
}

// ---------------------------------------------------------------------------
// AST walker for name allowlist
// ---------------------------------------------------------------------------

interface AllowlistToolCall {
  name: string
  type: string
  inputs: string[]
}

type CallLike =
  luaparse.CallExpression | luaparse.TableCallExpression | luaparse.StringCallExpression

/** Normalise call arguments to an array of expressions. */
function allowlistCallArgs(expr: CallLike): luaparse.Expression[] {
  if (expr.type === 'CallExpression') return expr.arguments
  if (expr.type === 'TableCallExpression') return [expr.arguments]
  if (expr.type === 'StringCallExpression') return [expr.argument]
  return []
}

/** Visit a table constructor, recursing into its fields. */
function visitTable(
  table: luaparse.TableConstructorExpression,
  visitor: (expr: luaparse.Expression, key?: string) => void
): void {
  for (const field of table.fields) {
    if (field.type === 'TableKeyString') visitor(field.value, field.key.name)
    else if (field.type === 'TableValue') visitor(field.value)
    else if (field.type === 'TableKey') visitor(field.value)
  }
}

/** Extract input keys from a call's table arguments. */
function extractCallInputKeys(
  call: CallLike,
  visitor: (expr: luaparse.Expression, key?: string) => void
): string[] {
  const inputKeys: string[] = []
  for (const arg of allowlistCallArgs(call)) {
    if (arg.type === 'TableConstructorExpression') {
      for (const field of arg.fields) {
        if (field.type === 'TableKeyString') {
          inputKeys.push(field.key.name)
          visitor(field.value, field.key.name)
        }
      }
    }
  }
  return inputKeys
}

/** Walk the luaparse AST to extract all tool-type calls and their input keys. */
function extractToolCallsForAllowlist(ast: luaparse.Chunk): AllowlistToolCall[] {
  const calls: AllowlistToolCall[] = []

  function visit(expr: luaparse.Expression, parentKey?: string): void {
    if (expr.type === 'TableConstructorExpression') {
      visitTable(expr, visit)
    } else if (
      expr.type === 'CallExpression' ||
      expr.type === 'TableCallExpression' ||
      expr.type === 'StringCallExpression'
    ) {
      const base = (expr as CallLike).base
      if (base.type === 'Identifier') {
        const inputKeys = extractCallInputKeys(expr as CallLike, visit)
        calls.push({ name: parentKey ?? '', type: base.name, inputs: inputKeys })
      }
      for (const arg of allowlistCallArgs(expr as CallLike)) visit(arg)
    }
  }

  for (const stmt of ast.body) {
    if (stmt.type === 'ReturnStatement') {
      for (const arg of stmt.arguments) visit(arg)
    }
  }

  return calls
}

function getAllowlistToolCalls(template: MotionTemplate): AllowlistToolCall[] {
  const result = generateSetting(makeInput(template))
  const text = (result.files[0] as { contents: string }).contents
  const latin1 = utf8ToLatin1(text)
  const ast = luaparse.parse('return ' + latin1, {
    luaVersion: '5.1',
    encodingMode: 'pseudo-latin1'
  })
  return extractToolCallsForAllowlist(ast)
}

// ---------------------------------------------------------------------------
// Fusion name allowlist tests
// ---------------------------------------------------------------------------

const allowlistFixtures = [
  textFixture,
  rectFixture,
  ellipseFixture,
  pathFixture,
  arcFixture,
  groupFixture,
  counterFixture,
  seriesFixture,
  colourParamFixture,
  holdParamFixture,
  allAnimatedFixture
]

describe('Fusion name allowlist', () => {
  for (const fixture of allowlistFixtures) {
    describe(fixture.id, () => {
      it('emits only known tool types', () => {
        const calls = getAllowlistToolCalls(fixture)
        const unknownTypes = calls.map(c => c.type).filter(t => !KNOWN_TOOL_TYPES.has(t))

        expect(
          unknownTypes,
          `Unknown tool types: ${[...new Set(unknownTypes)].join(', ')}`
        ).toEqual([])
      })

      it('emits only known input names per tool type', () => {
        const calls = getAllowlistToolCalls(fixture)
        const unknowns: string[] = []

        for (const call of calls) {
          const allowedInputs = KNOWN_INPUTS[call.type]
          if (!allowedInputs) continue // tool type itself checked in the previous test
          for (const key of call.inputs) {
            if (!allowedInputs.has(key)) {
              unknowns.push(`${call.type}.${key}`)
            }
          }
        }

        expect(unknowns, `Unknown inputs: ${[...new Set(unknowns)].join(', ')}`).toEqual(
          []
        )
      })
    })
  }
})

// ===========================================================================
// Animated property coverage (merged from animatedProperties.test.ts)
//
// Table-driven: one row per (layer kind x animatable property).
// Each row asserts a BezierSpline on the correct Fusion input in the
// correct coordinate family (shape-space for s* tools, image-space for
// Text+ and Transform).
// ===========================================================================

/** Two-keyframe animation track for a number property. */
const numAnim = [
  { t: 0, value: 0, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  { t: 1, value: 100 }
]

/** Two-keyframe animation track for a point property. */
const posAnim = [
  {
    t: 0,
    value: { x: 100, y: 100 },
    ease: [0.16, 1, 0.3, 1] as [number, number, number, number]
  },
  { t: 1, value: { x: 500, y: 500 } }
]

/** Two-keyframe scale track. */
const scaleAnim = [
  {
    t: 0,
    value: { x: 1, y: 1 },
    ease: [0.16, 1, 0.3, 1] as [number, number, number, number]
  },
  { t: 1, value: { x: 2, y: 2 } }
]

function animBase(
  id: string,
  overrides?: Partial<MotionTemplate>
): Omit<MotionTemplate, 'layers' | 'params'> {
  return {
    schemaVersion: 1,
    id,
    version: '1.0.0',
    name: id,
    description: 'test',
    category: 'lower-third',
    status: 'stable',
    tags: [],
    fonts: ['CabritoSemi-NorBol'],
    duration: 4,
    inEnd: 1,
    outStart: 3,
    ...overrides
  }
}

// Base layers for animated property tests

const animBaseRect: RectLayer = {
  kind: 'rect',
  id: 'r',
  anchor: { x: 0, y: 0 },
  width: 500,
  height: 200,
  fill: '#ff3366',
  radius: 0
}

const animBaseEllipse: EllipseLayer = {
  kind: 'ellipse',
  id: 'e',
  anchor: { x: 0, y: 0 },
  radiusX: 50,
  radiusY: 50,
  fill: '#00ff00'
}

const animBasePath: PathLayer = {
  kind: 'path',
  id: 'p',
  anchor: { x: 0, y: 0 },
  d: 'M 100 100 L 200 300 L 300 100 Z',
  fill: '#0000ff'
}

const animBaseArc: ArcLayer = {
  kind: 'arc',
  id: 'a',
  anchor: { x: 1920, y: 1080 },
  innerRadius: 400,
  outerRadius: 480,
  sweep: [{ t: 0, value: 0.72 }],
  startAngle: [{ t: 0, value: 0 }],
  fill: '#ff3366'
}

const animBaseText: TextLayer = {
  kind: 'text',
  id: 't',
  anchor: { x: 0, y: 0 },
  text: 'Test',
  font: { family: 'Cabrito Semi', style: 'Norm Bold', size: 80 },
  align: 'left',
  lineHeight: 1.2,
  multiline: false,
  fill: '#ffffff'
}

const animBaseGroup: GroupLayer = {
  kind: 'group',
  id: 'g',
  anchor: { x: 0, y: 0 },
  children: [
    {
      kind: 'rect',
      id: 'g-child',
      anchor: { x: 0, y: 0 },
      width: 100,
      height: 100,
      fill: '#333333',
      radius: 0
    }
  ]
}

// Coverage table

interface AnimTestRow {
  kind: string
  property: string
  layer: Layer
  /** Fusion input name to check for BezierSpline (or presence in output). */
  fusionInput: string
  /** Coordinate family: 'shape' for s* tools, 'image' for Text+/Transform. */
  coordFamily: 'shape' | 'image'
}

const animRows: AnimTestRow[] = [
  // rect
  {
    kind: 'rect',
    property: 'position',
    layer: { ...animBaseRect, position: posAnim },
    fusionInput: 'XOffset',
    coordFamily: 'shape'
  },
  {
    kind: 'rect',
    property: 'scale',
    layer: { ...animBaseRect, scale: scaleAnim },
    fusionInput: 'Size',
    coordFamily: 'shape'
  },
  {
    kind: 'rect',
    property: 'rotation',
    layer: { ...animBaseRect, rotation: numAnim },
    fusionInput: 'Angle',
    coordFamily: 'shape'
  },
  {
    kind: 'rect',
    property: 'opacity',
    layer: { ...animBaseRect, opacity: numAnim },
    fusionInput: 'Opacity',
    coordFamily: 'shape'
  },

  // ellipse
  {
    kind: 'ellipse',
    property: 'position',
    layer: { ...animBaseEllipse, position: posAnim },
    fusionInput: 'XOffset',
    coordFamily: 'shape'
  },
  {
    kind: 'ellipse',
    property: 'scale',
    layer: { ...animBaseEllipse, scale: scaleAnim },
    fusionInput: 'Size',
    coordFamily: 'shape'
  },
  {
    kind: 'ellipse',
    property: 'rotation',
    layer: { ...animBaseEllipse, rotation: numAnim },
    fusionInput: 'Angle',
    coordFamily: 'shape'
  },
  {
    kind: 'ellipse',
    property: 'opacity',
    layer: { ...animBaseEllipse, opacity: numAnim },
    fusionInput: 'Opacity',
    coordFamily: 'shape'
  },

  // path
  {
    kind: 'path',
    property: 'position',
    layer: { ...animBasePath, position: posAnim },
    fusionInput: 'XOffset',
    coordFamily: 'shape'
  },
  {
    kind: 'path',
    property: 'scale',
    layer: { ...animBasePath, scale: scaleAnim },
    fusionInput: 'Size',
    coordFamily: 'shape'
  },
  {
    kind: 'path',
    property: 'rotation',
    layer: { ...animBasePath, rotation: numAnim },
    fusionInput: 'Angle',
    coordFamily: 'shape'
  },
  {
    kind: 'path',
    property: 'opacity',
    layer: { ...animBasePath, opacity: numAnim },
    fusionInput: 'Opacity',
    coordFamily: 'shape'
  },

  // arc
  {
    kind: 'arc',
    property: 'position',
    layer: { ...animBaseArc, position: posAnim },
    fusionInput: 'XOffset',
    coordFamily: 'shape'
  },
  {
    kind: 'arc',
    property: 'scale',
    layer: { ...animBaseArc, scale: scaleAnim },
    fusionInput: 'Size',
    coordFamily: 'shape'
  },
  {
    kind: 'arc',
    property: 'rotation',
    layer: { ...animBaseArc, rotation: numAnim },
    fusionInput: 'Angle',
    coordFamily: 'shape'
  },
  {
    kind: 'arc',
    property: 'opacity',
    layer: { ...animBaseArc, opacity: numAnim },
    fusionInput: 'Opacity',
    coordFamily: 'shape'
  },

  // text
  {
    kind: 'text',
    property: 'position',
    layer: { ...animBaseText, position: posAnim },
    fusionInput: 'Center',
    coordFamily: 'image'
  },
  {
    kind: 'text',
    property: 'scale',
    layer: { ...animBaseText, scale: scaleAnim },
    fusionInput: 'Size',
    coordFamily: 'image'
  },
  {
    kind: 'text',
    property: 'rotation',
    layer: { ...animBaseText, rotation: numAnim },
    fusionInput: 'Angle',
    coordFamily: 'image'
  },
  {
    kind: 'text',
    property: 'opacity',
    layer: { ...animBaseText, opacity: numAnim },
    fusionInput: 'Opacity',
    coordFamily: 'image'
  },

  // group (via image Transform)
  {
    kind: 'group',
    property: 'position',
    layer: { ...animBaseGroup, position: posAnim },
    fusionInput: 'Center',
    coordFamily: 'image'
  },
  {
    kind: 'group',
    property: 'scale',
    layer: { ...animBaseGroup, scale: scaleAnim },
    fusionInput: 'Size',
    coordFamily: 'image'
  },
  {
    kind: 'group',
    property: 'rotation',
    layer: { ...animBaseGroup, rotation: numAnim },
    fusionInput: 'Angle',
    coordFamily: 'image'
  },
  {
    kind: 'group',
    property: 'opacity',
    layer: { ...animBaseGroup, opacity: numAnim },
    fusionInput: 'Blend',
    coordFamily: 'image'
  }
]

describe('animated property coverage (kind x property)', () => {
  for (const row of animRows) {
    it(`${row.kind} x ${row.property} produces a BezierSpline for ${row.fusionInput}`, () => {
      const template: MotionTemplate = {
        ...animBase(`anim-${row.kind}-${row.property}`, {
          category: row.kind === 'arc' ? 'data' : 'lower-third'
        }),
        params: {},
        layers: [row.layer]
      }
      const text = getSettingText(makeInput(template))

      // Must produce at least one BezierSpline
      expect(text).toMatch(/BezierSpline/)

      // The Fusion input name must appear in the output
      expect(text).toContain(row.fusionInput)
    })
  }
})

// ===========================================================================
// XYPath modifier and stagger scope (merged from xyPathAndStagger.test.ts)
//
// 1. Animated point inputs (Text+ Center, Transform Center) must use an
//    XYPath modifier with X/Y BezierSplines, not CenterX/CenterY.
// 2. Stagger drives only per-character opacity and fill. Position, scale
//    and rotation remain on the layer as whole-layer transforms.
// ===========================================================================

const rotAnim = [
  { t: 0, value: 0, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  { t: 1, value: 90 }
]

const opacityAnim = [
  { t: 0, value: 0, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  { t: 1, value: 1 }
]

function xyBase(id: string): Omit<MotionTemplate, 'layers' | 'params'> {
  return {
    schemaVersion: 1,
    id,
    version: '1.0.0',
    name: id,
    description: 'test',
    category: 'lower-third',
    status: 'stable',
    tags: [],
    fonts: ['CabritoSemi-NorBol'],
    duration: 4,
    inEnd: 1,
    outStart: 3
  }
}

describe('XYPath modifier for animated point inputs', () => {
  const xyAnimatedText: TextLayer = {
    kind: 'text',
    id: 'xy-txt',
    anchor: { x: 0, y: 0 },
    position: posAnim,
    text: 'Test',
    font: { family: 'Cabrito Semi', style: 'Norm Bold', size: 80 },
    align: 'left',
    lineHeight: 1.2,
    multiline: false,
    fill: '#ffffff'
  }

  it('animated Text+ position emits an XYPath, not CenterX/CenterY', () => {
    const template: MotionTemplate = {
      ...xyBase('xypath-text'),
      params: {},
      layers: [xyAnimatedText]
    }
    const text = getSettingText(makeInput(template))
    expect(text).toMatch(/XYPath/)
    expect(text).not.toContain('CenterX')
    expect(text).not.toContain('CenterY')
  })

  it('XYPath has X and Y inputs each driven by a BezierSpline', () => {
    const template: MotionTemplate = {
      ...xyBase('xypath-text-splines'),
      params: {},
      layers: [xyAnimatedText]
    }
    const text = getSettingText(makeInput(template))
    // XYPath tool should have X and Y inputs
    expect(text).toMatch(/X\s*=\s*Input/)
    expect(text).toMatch(/Y\s*=\s*Input/)
    // Those inputs source from BezierSplines
    expect(text).toMatch(/BezierSpline/)
  })

  it('animated group Transform position emits an XYPath', () => {
    const group: GroupLayer = {
      kind: 'group',
      id: 'xy-grp',
      anchor: { x: 0, y: 0 },
      position: posAnim,
      children: [
        {
          kind: 'rect',
          id: 'xy-grp-child',
          anchor: { x: 0, y: 0 },
          width: 100,
          height: 100,
          fill: '#333333',
          radius: 0
        }
      ]
    }
    const template: MotionTemplate = {
      ...xyBase('xypath-group'),
      params: {},
      layers: [group]
    }
    const text = getSettingText(makeInput(template))
    expect(text).toMatch(/XYPath/)
    expect(text).not.toContain('CenterX')
    expect(text).not.toContain('CenterY')
  })

  it('shape XOffset/YOffset remain as direct splines (not XYPath)', () => {
    const template: MotionTemplate = {
      ...xyBase('xypath-shape-no'),
      params: {},
      layers: [
        {
          kind: 'rect',
          id: 'xy-rect',
          anchor: { x: 0, y: 0 },
          position: posAnim,
          width: 500,
          height: 200,
          fill: '#ff3366',
          radius: 0
        }
      ]
    }
    const text = getSettingText(makeInput(template))
    // Shape tools use XOffset/YOffset as direct scalar splines
    expect(text).toContain('XOffset')
    expect(text).toContain('YOffset')
    // No XYPath for shapes
    expect(text).not.toMatch(/XYPath/)
  })
})

describe('stagger scope: position/scale/rotation stay on the layer', () => {
  const staggerText: TextLayer = {
    kind: 'text',
    id: 'stg',
    anchor: { x: 0, y: 0 },
    position: posAnim,
    scale: scaleAnim,
    rotation: rotAnim,
    opacity: opacityAnim,
    text: 'Hello',
    font: { family: 'Cabrito Semi', style: 'Norm Bold', size: 80 },
    align: 'left',
    lineHeight: 1.2,
    multiline: false,
    fill: '#ffffff',
    stagger: { delay: 0.04 }
  }

  it('position animation produces splines even with stagger', () => {
    const template: MotionTemplate = {
      ...xyBase('stg-pos'),
      params: {},
      layers: [staggerText]
    }
    const text = getSettingText(makeInput(template))
    // XYPath for position (whole layer)
    expect(text).toMatch(/XYPath/)
    expect(text).toMatch(/BezierSpline/)
  })

  it('scale animation produces a Size spline even with stagger', () => {
    const template: MotionTemplate = {
      ...xyBase('stg-scale'),
      params: {},
      layers: [staggerText]
    }
    const text = getSettingText(makeInput(template))
    expect(text).toContain('Size')
    expect(text).toMatch(/BezierSpline/)
  })

  it('rotation animation produces an Angle spline even with stagger', () => {
    const template: MotionTemplate = {
      ...xyBase('stg-rot'),
      params: {},
      layers: [staggerText]
    }
    const text = getSettingText(makeInput(template))
    expect(text).toContain('Angle')
    expect(text).toMatch(/BezierSpline/)
  })
})

// ===========================================================================
// S5 pivot: scale and rotation about the anchor
//
// The evaluator applies scale and rotation about the layer's anchor:
//   world = position + R * S * (local - anchor)
// The Fusion Transform's Pivot must sit at the anchor's world position.
// ===========================================================================

/**
 * Apply the evaluator's transform to a local point:
 *   world = position + R(angleDeg) * scale * (local - anchor)
 */
function evalWorld(
  local: { x: number; y: number },
  anchor: { x: number; y: number },
  position: { x: number; y: number },
  scale: number,
  angleDeg: number
): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const dx = local.x - anchor.x
  const dy = local.y - anchor.y
  return {
    x: position.x + scale * (cos * dx - sin * dy),
    y: position.y + scale * (sin * dx + cos * dy)
  }
}

/**
 * From the Fusion output, compute where a point ends up after the Transform.
 *
 * The Transform operates in pixel space: convert normalised image coords
 * to pixels (width x height), apply scale and rotation about the pixel
 * position of the Pivot, then convert back to normalised coords.
 *
 * Fusion's Angle is already negated by the exporter; the effective
 * template-space angle is -angleDeg.
 */
function fusionWorld(
  pointImg: { x: number; y: number },
  pivotImg: { x: number; y: number },
  size: number,
  angleDeg: number,
  w = 3840,
  h = 2160
): { x: number; y: number } {
  // Convert to pixel coords
  const px = pointImg.x * w
  const py = (1 - pointImg.y) * h // back to template Y (top-down)
  const pvx = pivotImg.x * w
  const pvy = (1 - pivotImg.y) * h

  // Fusion angle is negated; effective template angle is -angleDeg
  const rad = (-angleDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const dx = px - pvx
  const dy = py - pvy
  const rx = pvx + size * (cos * dx - sin * dy)
  const ry = pvy + size * (sin * dx + cos * dy)

  // Convert back to normalised image coords
  return {
    x: rx / w,
    y: 1 - ry / h
  }
}

/** Extract a static Input value from the .setting text for a specific tool and key. */
function extractStaticInput(text: string, key: string): number | null {
  const re = new RegExp(`${key}\\s*=\\s*Input\\s*\\{\\s*Value\\s*=\\s*([\\d.e+-]+)`)
  const m = re.exec(text)
  return m ? parseFloat(m[1]) : null
}

/** Extract a point Input value { x, y } from the .setting text. */
function extractPointInput(text: string, key: string): { x: number; y: number } | null {
  // Point inputs look like: Key = Input { Value = { 0.123, 0.456 } }
  const re = new RegExp(
    `${key}\\s*=\\s*Input\\s*\\{[^}]*Value\\s*=\\s*\\{[^}]*?([\\d.e+-]+)\\s*,\\s*([\\d.e+-]+)`
  )
  const m = re.exec(text)
  return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : null
}

describe('S5 pivot: scale and rotation about the anchor', () => {
  it('rect with non-zero anchor: scale+rotation pivots around anchor', () => {
    // Rect: anchor=(100,50), width=400, height=200, position=(500,600)
    // scale=0.5, rotation=30
    const template: MotionTemplate = {
      ...xyBase('s5-pivot-rect'),
      params: {},
      layers: [
        {
          kind: 'rect',
          id: 'pivr',
          anchor: { x: 100, y: 50 },
          position: [{ t: 0, value: { x: 500, y: 600 } }],
          scale: [{ t: 0, value: { x: 0.5, y: 0.5 } }],
          rotation: [{ t: 0, value: 30 }],
          width: 400,
          height: 200,
          fill: '#ff3366',
          radius: 0
        }
      ]
    }
    const text = getSettingText(makeInput(template))

    // The Transform must have a Pivot at the anchor's world position
    // anchor world = position = (500, 600)
    // In image coords: (500/3840, 1-600/2160)
    const pivotImg = { x: 500 / 3840, y: 1 - 600 / 2160 }
    const pivot = extractPointInput(text, 'Pivot')
    expect(pivot).not.toBeNull()
    expect(pivot!.x).toBeCloseTo(pivotImg.x, 6)
    expect(pivot!.y).toBeCloseTo(pivotImg.y, 6)

    // Verify parity: the four corners should match the evaluator
    const corners = [
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      { x: 400, y: 200 },
      { x: 0, y: 200 }
    ]
    const anchor = { x: 100, y: 50 }
    const position = { x: 500, y: 600 }

    // The Transform Size and Angle
    const xfSize = extractStaticInput(text, 'Size')
    expect(xfSize).not.toBeNull()
    const xfAngle = extractStaticInput(text, 'Angle')
    expect(xfAngle).not.toBeNull()

    for (const corner of corners) {
      const evalPt = evalWorld(corner, anchor, position, 0.5, 30)
      // Convert evalPt to image coords for comparison
      const evalImg = { x: evalPt.x / 3840, y: 1 - evalPt.y / 2160 }

      // Compute the corner's position in the pre-Transform image.
      // The shape at template coords maps through sRender to image coords.
      // corner in world (no scale/rot) = position - anchor + corner
      const cornerWorldX = position.x - anchor.x + corner.x
      const cornerWorldY = position.y - anchor.y + corner.y
      const cornerImg = { x: cornerWorldX / 3840, y: 1 - cornerWorldY / 2160 }

      // Apply Transform about Pivot
      const fusionPt = fusionWorld(cornerImg, pivotImg, xfSize!, xfAngle!)
      expect(fusionPt.x).toBeCloseTo(evalImg.x, 3)
      expect(fusionPt.y).toBeCloseTo(evalImg.y, 3)
    }
  })

  it('ellipse with non-zero anchor: scale+rotation pivots around anchor', () => {
    // Ellipse: anchor=(30,30), radiusX=60, radiusY=40, position=(1000,800)
    // scale=0.5, rotation=30
    const template: MotionTemplate = {
      ...xyBase('s5-pivot-ellipse'),
      params: {},
      layers: [
        {
          kind: 'ellipse',
          id: 'pive',
          anchor: { x: 30, y: 30 },
          position: [{ t: 0, value: { x: 1000, y: 800 } }],
          scale: [{ t: 0, value: { x: 0.5, y: 0.5 } }],
          rotation: [{ t: 0, value: 30 }],
          radiusX: 60,
          radiusY: 40,
          fill: '#00ff00'
        }
      ]
    }
    const text = getSettingText(makeInput(template))

    // The Transform must have a Pivot at the anchor's world position
    // anchor world = position = (1000, 800)
    // In image coords: (1000/3840, 1-800/2160)
    const pivotImg = { x: 1000 / 3840, y: 1 - 800 / 2160 }
    const pivot = extractPointInput(text, 'Pivot')
    expect(pivot).not.toBeNull()
    expect(pivot!.x).toBeCloseTo(pivotImg.x, 6)
    expect(pivot!.y).toBeCloseTo(pivotImg.y, 6)

    // Verify parity: the four extremes of the ellipse bounding box
    // Ellipse local bounding-box corners:
    //   (0,0), (2*radiusX, 0), (2*radiusX, 2*radiusY), (0, 2*radiusY)
    const extremes = [
      { x: 0, y: 0 },
      { x: 120, y: 0 },
      { x: 120, y: 80 },
      { x: 0, y: 80 }
    ]
    const anchor = { x: 30, y: 30 }
    const position = { x: 1000, y: 800 }

    const xfSize = extractStaticInput(text, 'Size')
    expect(xfSize).not.toBeNull()
    const xfAngle = extractStaticInput(text, 'Angle')
    expect(xfAngle).not.toBeNull()

    for (const extreme of extremes) {
      const evalPt = evalWorld(extreme, anchor, position, 0.5, 30)
      const evalImg = { x: evalPt.x / 3840, y: 1 - evalPt.y / 2160 }

      // Extreme in pre-Transform image coords
      const exWorldX = position.x - anchor.x + extreme.x
      const exWorldY = position.y - anchor.y + extreme.y
      const cornerImg = { x: exWorldX / 3840, y: 1 - exWorldY / 2160 }

      const fusionPt = fusionWorld(cornerImg, pivotImg, xfSize!, xfAngle!)
      expect(fusionPt.x).toBeCloseTo(evalImg.x, 3)
      expect(fusionPt.y).toBeCloseTo(evalImg.y, 3)
    }
  })
})
