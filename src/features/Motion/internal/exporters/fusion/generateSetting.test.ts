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

/** Minimal tool call info extracted from the Lua AST. */
interface ToolCallInfo {
  name: string
  type: string
}

/** Walk the luaparse AST to extract tool-type calls (name = Type { ... }). */
function extractAllToolCalls(ast: luaparse.Chunk): ToolCallInfo[] {
  const calls: ToolCallInfo[] = []

  function visit(expr: luaparse.Expression, parentKey?: string): void {
    if (expr.type === 'TableConstructorExpression') {
      for (const field of expr.fields) {
        if (field.type === 'TableKeyString') visit(field.value, field.key.name)
        else if (field.type === 'TableValue') visit(field.value)
        else if (field.type === 'TableKey') visit(field.value)
      }
    } else if (
      expr.type === 'CallExpression' ||
      expr.type === 'TableCallExpression' ||
      expr.type === 'StringCallExpression'
    ) {
      const base =
        expr.type === 'CallExpression' || expr.type === 'TableCallExpression'
          ? expr.base
          : expr.base
      if (base.type === 'Identifier') {
        calls.push({ name: parentKey ?? '', type: base.name })
      }
      const args =
        expr.type === 'CallExpression'
          ? expr.arguments
          : expr.type === 'TableCallExpression'
            ? [expr.arguments]
            : [expr.argument]
      for (const arg of args) visit(arg)
    }
  }

  for (const stmt of ast.body) {
    if (stmt.type === 'ReturnStatement') {
      for (const arg of stmt.arguments) visit(arg)
    }
  }

  return calls
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

describe('RES6.2: fractional delay rounding', () => {
  it('rounds 0.75 frame to 1 frame and adds a note', () => {
    // 0.03s at 25fps = 0.75 frames -> round to 1
    const baseText = textFixture.layers[0] as TextLayer
    const staggerTemplate: MotionTemplate = {
      ...textFixture,
      id: 'res6-fractional',
      layers: [{ ...baseText, stagger: { delay: 0.03 } }]
    }
    const result = generateSetting(makeInput(staggerTemplate))
    const text = (result.files[0] as { contents: string }).contents
    expect(text).toMatch(/Delay\s*=\s*Input\s*\{\s*Value\s*=\s*1\s*[,}]/)
    expect(result.notes.length).toBeGreaterThan(0)
    expect(result.notes.some(n => /stagger.*round/i.test(n))).toBe(true)
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
    const ast = parseSetting(text)
    const calls = extractAllToolCalls(ast)
    // Background tools should only appear for hatch/bezier fallbacks, not colour params
    const bgTools = calls.filter(
      c => c.type === 'Background' && c.name.includes('colour_bg')
    )
    expect(bgTools).toEqual([])
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
