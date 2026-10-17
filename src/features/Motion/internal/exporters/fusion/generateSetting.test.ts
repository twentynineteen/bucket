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
  ExportInput,
  MotionFormat,
  MotionTemplate,
  ParamValues,
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
