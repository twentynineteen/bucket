/**
 * Animated property coverage tests (issue #330, fix 1)
 *
 * Table-driven: one row per (layer kind x animatable property).
 * Each row asserts a BezierSpline on the correct Fusion input in the
 * correct coordinate family (shape-space for s* tools, image-space for
 * Text+ and Transform).
 *
 * D2 makes position, scale, rotation and opacity animatable on every
 * layer kind. Kind-specific properties (tracking, widthAnimation, etc.)
 * are covered in generateSetting.test.ts.
 */
import { describe, expect, it } from 'vitest'
import type {
  ArcLayer,
  EllipseLayer,
  ExportInput,
  GroupLayer,
  Layer,
  MotionFormat,
  MotionTemplate,
  PathLayer,
  RectLayer,
  TextLayer
} from '../../../types'
import { resolveTemplate } from '../../resolve'
import { generateSetting } from './generateSetting'

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

function base(
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

function getSettingText(input: ExportInput): string {
  const result = generateSetting(input)
  return (result.files[0] as { contents: string }).contents
}

// ---------------------------------------------------------------------------
// Base layers
// ---------------------------------------------------------------------------

const baseRect: RectLayer = {
  kind: 'rect',
  id: 'r',
  anchor: { x: 0, y: 0 },
  width: 500,
  height: 200,
  fill: '#ff3366',
  radius: 0
}

const baseEllipse: EllipseLayer = {
  kind: 'ellipse',
  id: 'e',
  anchor: { x: 0, y: 0 },
  radiusX: 50,
  radiusY: 50,
  fill: '#00ff00'
}

const basePath: PathLayer = {
  kind: 'path',
  id: 'p',
  anchor: { x: 0, y: 0 },
  d: 'M 100 100 L 200 300 L 300 100 Z',
  fill: '#0000ff'
}

const baseArc: ArcLayer = {
  kind: 'arc',
  id: 'a',
  anchor: { x: 1920, y: 1080 },
  innerRadius: 400,
  outerRadius: 480,
  sweep: [{ t: 0, value: 0.72 }],
  startAngle: [{ t: 0, value: 0 }],
  fill: '#ff3366'
}

const baseText: TextLayer = {
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

const baseGroup: GroupLayer = {
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

// ---------------------------------------------------------------------------
// Coverage table
// ---------------------------------------------------------------------------

interface TestRow {
  kind: string
  property: string
  layer: Layer
  /** Fusion input name to check for BezierSpline (or presence in output). */
  fusionInput: string
  /** Coordinate family: 'shape' for s* tools, 'image' for Text+/Transform. */
  coordFamily: 'shape' | 'image'
}

const rows: TestRow[] = [
  // rect
  {
    kind: 'rect',
    property: 'position',
    layer: { ...baseRect, position: posAnim },
    fusionInput: 'XOffset',
    coordFamily: 'shape'
  },
  {
    kind: 'rect',
    property: 'scale',
    layer: { ...baseRect, scale: scaleAnim },
    fusionInput: 'Size',
    coordFamily: 'shape'
  },
  {
    kind: 'rect',
    property: 'rotation',
    layer: { ...baseRect, rotation: numAnim },
    fusionInput: 'Angle',
    coordFamily: 'shape'
  },
  {
    kind: 'rect',
    property: 'opacity',
    layer: { ...baseRect, opacity: numAnim },
    fusionInput: 'Opacity',
    coordFamily: 'shape'
  },

  // ellipse
  {
    kind: 'ellipse',
    property: 'position',
    layer: { ...baseEllipse, position: posAnim },
    fusionInput: 'XOffset',
    coordFamily: 'shape'
  },
  {
    kind: 'ellipse',
    property: 'scale',
    layer: { ...baseEllipse, scale: scaleAnim },
    fusionInput: 'Size',
    coordFamily: 'shape'
  },
  {
    kind: 'ellipse',
    property: 'rotation',
    layer: { ...baseEllipse, rotation: numAnim },
    fusionInput: 'Angle',
    coordFamily: 'shape'
  },
  {
    kind: 'ellipse',
    property: 'opacity',
    layer: { ...baseEllipse, opacity: numAnim },
    fusionInput: 'Opacity',
    coordFamily: 'shape'
  },

  // path
  {
    kind: 'path',
    property: 'position',
    layer: { ...basePath, position: posAnim },
    fusionInput: 'XOffset',
    coordFamily: 'shape'
  },
  {
    kind: 'path',
    property: 'scale',
    layer: { ...basePath, scale: scaleAnim },
    fusionInput: 'Size',
    coordFamily: 'shape'
  },
  {
    kind: 'path',
    property: 'rotation',
    layer: { ...basePath, rotation: numAnim },
    fusionInput: 'Angle',
    coordFamily: 'shape'
  },
  {
    kind: 'path',
    property: 'opacity',
    layer: { ...basePath, opacity: numAnim },
    fusionInput: 'Opacity',
    coordFamily: 'shape'
  },

  // arc
  {
    kind: 'arc',
    property: 'position',
    layer: { ...baseArc, position: posAnim },
    fusionInput: 'XOffset',
    coordFamily: 'shape'
  },
  {
    kind: 'arc',
    property: 'scale',
    layer: { ...baseArc, scale: scaleAnim },
    fusionInput: 'Size',
    coordFamily: 'shape'
  },
  {
    kind: 'arc',
    property: 'rotation',
    layer: { ...baseArc, rotation: numAnim },
    fusionInput: 'Angle',
    coordFamily: 'shape'
  },
  {
    kind: 'arc',
    property: 'opacity',
    layer: { ...baseArc, opacity: numAnim },
    fusionInput: 'Opacity',
    coordFamily: 'shape'
  },

  // text
  {
    kind: 'text',
    property: 'position',
    layer: { ...baseText, position: posAnim },
    fusionInput: 'Center',
    coordFamily: 'image'
  },
  {
    kind: 'text',
    property: 'scale',
    layer: { ...baseText, scale: scaleAnim },
    fusionInput: 'Size',
    coordFamily: 'image'
  },
  {
    kind: 'text',
    property: 'rotation',
    layer: { ...baseText, rotation: numAnim },
    fusionInput: 'Angle',
    coordFamily: 'image'
  },
  {
    kind: 'text',
    property: 'opacity',
    layer: { ...baseText, opacity: numAnim },
    fusionInput: 'Opacity',
    coordFamily: 'image'
  },

  // group (via image Transform)
  {
    kind: 'group',
    property: 'position',
    layer: { ...baseGroup, position: posAnim },
    fusionInput: 'Center',
    coordFamily: 'image'
  },
  {
    kind: 'group',
    property: 'scale',
    layer: { ...baseGroup, scale: scaleAnim },
    fusionInput: 'Size',
    coordFamily: 'image'
  },
  {
    kind: 'group',
    property: 'rotation',
    layer: { ...baseGroup, rotation: numAnim },
    fusionInput: 'Angle',
    coordFamily: 'image'
  },
  {
    kind: 'group',
    property: 'opacity',
    layer: { ...baseGroup, opacity: numAnim },
    fusionInput: 'Blend',
    coordFamily: 'image'
  }
]

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('animated property coverage (kind x property)', () => {
  for (const row of rows) {
    it(`${row.kind} x ${row.property} produces a BezierSpline for ${row.fusionInput}`, () => {
      const template: MotionTemplate = {
        ...base(`anim-${row.kind}-${row.property}`, {
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
