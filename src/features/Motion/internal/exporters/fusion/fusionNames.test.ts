/**
 * Fusion name allowlist test (issue #330)
 *
 * Validates that every tool type and input name the generator emits is a
 * known Fusion identifier, sourced from real .setting files and official
 * documentation. Prevents inventing API names that Resolve would silently
 * ignore.
 *
 * Sources per entry are in comments on the allowlist.
 */
import * as luaparse from 'luaparse'
import { describe, expect, it } from 'vitest'
import type { ExportInput, MotionFormat, MotionTemplate } from '../../../types'
import { resolveTemplate } from '../../resolve'
import {
  allAnimatedFixture,
  arcFixture,
  colourParamFixture,
  counterFixture,
  ellipseFixture,
  groupFixture,
  holdParamFixture,
  pathFixture,
  rectFixture,
  seriesFixture,
  textFixture
} from '../../testing/fixtures'
import { generateSetting } from './generateSetting'

// ---------------------------------------------------------------------------
// Allowlist: known Fusion tool types
// ---------------------------------------------------------------------------

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

  // Follower modifier - Blackmagic forum Text+ Follower threads
  // UNVERIFIED exact type ID; flagged for #339
  'StyledTextFollower'
])

// ---------------------------------------------------------------------------
// Allowlist: known Fusion input names per tool type
// ---------------------------------------------------------------------------

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
    'Center',
    'CenterX',
    'CenterY', // CenterX/CenterY: UNVERIFIED split; flagged for #339
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
  Transform: new Set([
    'Inputs',
    'Input',
    'Center',
    'CenterX',
    'CenterY',
    'Size',
    'Angle'
  ]),

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
// AST walker
// ---------------------------------------------------------------------------

interface ToolCall {
  name: string
  type: string
  inputs: string[]
}

/** Normalise call arguments to an array of expressions. */
function callArgs(
  expr:
    luaparse.CallExpression | luaparse.TableCallExpression | luaparse.StringCallExpression
): luaparse.Expression[] {
  if (expr.type === 'CallExpression') return expr.arguments
  if (expr.type === 'TableCallExpression') return [expr.arguments]
  if (expr.type === 'StringCallExpression') return [expr.argument]
  return []
}

type CallLike =
  luaparse.CallExpression | luaparse.TableCallExpression | luaparse.StringCallExpression

/** Visit a table constructor, recursing into its fields. */
function visitTable(
  table: luaparse.TableConstructorExpression,
  visit: (expr: luaparse.Expression, key?: string) => void
): void {
  for (const field of table.fields) {
    if (field.type === 'TableKeyString') visit(field.value, field.key.name)
    else if (field.type === 'TableValue') visit(field.value)
    else if (field.type === 'TableKey') visit(field.value)
  }
}

/** Visit a call expression, extracting the tool type and input keys. */
function visitCall(
  call: CallLike,
  parentKey: string | undefined,
  calls: ToolCall[],
  visit: (expr: luaparse.Expression, key?: string) => void
): void {
  const base = call.base
  if (base.type === 'Identifier') {
    const inputKeys: string[] = []
    for (const arg of callArgs(call)) {
      if (arg.type === 'TableConstructorExpression') {
        for (const field of arg.fields) {
          if (field.type === 'TableKeyString') {
            inputKeys.push(field.key.name)
            visit(field.value, field.key.name)
          }
        }
      }
    }
    calls.push({ name: parentKey ?? '', type: base.name, inputs: inputKeys })
  }
  for (const arg of callArgs(call)) visit(arg)
}

/** Walk the luaparse AST to extract all tool-type calls and their input keys. */
function extractToolCalls(ast: luaparse.Chunk): ToolCall[] {
  const calls: ToolCall[] = []

  function visit(expr: luaparse.Expression, parentKey?: string): void {
    if (expr.type === 'TableConstructorExpression') {
      visitTable(expr, visit)
    } else if (
      expr.type === 'CallExpression' ||
      expr.type === 'TableCallExpression' ||
      expr.type === 'StringCallExpression'
    ) {
      visitCall(expr as CallLike, parentKey, calls, visit)
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
// Helpers
// ---------------------------------------------------------------------------

const FMT: MotionFormat = { width: 3840, height: 2160, fps: 25 }

function makeInput(template: MotionTemplate): ExportInput {
  const resolved = resolveTemplate(template, {}, FMT)
  return {
    template,
    values: {},
    format: FMT,
    resolved,
    targets: ['resolve'],
    mogrt: false
  }
}

function utf8ToLatin1(text: string): string {
  const encoder = new TextEncoder()
  const bytes = encoder.encode(text)
  return Array.from(bytes, b => String.fromCharCode(b)).join('')
}

function getToolCalls(template: MotionTemplate): ToolCall[] {
  const result = generateSetting(makeInput(template))
  const text = (result.files[0] as { contents: string }).contents
  const latin1 = utf8ToLatin1(text)
  const ast = luaparse.parse('return ' + latin1, {
    luaVersion: '5.1',
    encodingMode: 'pseudo-latin1'
  })
  return extractToolCalls(ast)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const fixtures = [
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
  for (const fixture of fixtures) {
    describe(fixture.id, () => {
      it('emits only known tool types', () => {
        const calls = getToolCalls(fixture)
        const unknownTypes = calls.map(c => c.type).filter(t => !KNOWN_TOOL_TYPES.has(t))

        expect(
          unknownTypes,
          `Unknown tool types: ${[...new Set(unknownTypes)].join(', ')}`
        ).toEqual([])
      })

      it('emits only known input names per tool type', () => {
        const calls = getToolCalls(fixture)
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
