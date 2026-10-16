/**
 * XYPath modifier and stagger scope tests (issue #330, fix 3)
 *
 * 1. Animated point inputs (Text+ Center, Transform Center) must use an
 *    XYPath modifier with X/Y BezierSplines, not CenterX/CenterY.
 * 2. Stagger drives only per-character opacity and fill. Position, scale
 *    and rotation remain on the layer as whole-layer transforms.
 *
 * Sources for XYPath:
 * - Resolve 18.6 manual, XY Path modifier (steakunderwater.com)
 * - forum.blackmagicdesign.com viewtopic.php?f=22&t=67065 (motion path wiring)
 * - forum.blackmagicdesign.com viewtopic.php?f=22&t=223637 (AddModifier script)
 * - forum.blackmagicdesign.com viewtopic.php?f=22&t=75019 (BezierSpline on Center)
 */
import { describe, expect, it } from 'vitest'
import type {
  ExportInput,
  GroupLayer,
  MotionFormat,
  MotionTemplate,
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

function base(id: string): Omit<MotionTemplate, 'layers' | 'params'> {
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

const posAnim = [
  {
    t: 0,
    value: { x: 100, y: 100 },
    ease: [0.16, 1, 0.3, 1] as [number, number, number, number]
  },
  { t: 1, value: { x: 500, y: 500 } }
]

const scaleAnim = [
  {
    t: 0,
    value: { x: 1, y: 1 },
    ease: [0.16, 1, 0.3, 1] as [number, number, number, number]
  },
  { t: 1, value: { x: 2, y: 2 } }
]

const rotAnim = [
  { t: 0, value: 0, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  { t: 1, value: 90 }
]

const opacityAnim = [
  { t: 0, value: 0, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  { t: 1, value: 1 }
]

function getSettingText(template: MotionTemplate): string {
  const result = generateSetting(makeInput(template))
  return (result.files[0] as { contents: string }).contents
}

// ---------------------------------------------------------------------------
// XYPath tests
// ---------------------------------------------------------------------------

describe('XYPath modifier for animated point inputs', () => {
  const animatedText: TextLayer = {
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
      ...base('xypath-text'),
      params: {},
      layers: [animatedText]
    }
    const text = getSettingText(template)
    expect(text).toMatch(/XYPath/)
    expect(text).not.toContain('CenterX')
    expect(text).not.toContain('CenterY')
  })

  it('XYPath has X and Y inputs each driven by a BezierSpline', () => {
    const template: MotionTemplate = {
      ...base('xypath-text-splines'),
      params: {},
      layers: [animatedText]
    }
    const text = getSettingText(template)
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
      ...base('xypath-group'),
      params: {},
      layers: [group]
    }
    const text = getSettingText(template)
    expect(text).toMatch(/XYPath/)
    expect(text).not.toContain('CenterX')
    expect(text).not.toContain('CenterY')
  })

  it('shape XOffset/YOffset remain as direct splines (not XYPath)', () => {
    const template: MotionTemplate = {
      ...base('xypath-shape-no'),
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
    const text = getSettingText(template)
    // Shape tools use XOffset/YOffset as direct scalar splines
    expect(text).toContain('XOffset')
    expect(text).toContain('YOffset')
    // No XYPath for shapes
    expect(text).not.toMatch(/XYPath/)
  })
})

// ---------------------------------------------------------------------------
// Stagger scope tests
// ---------------------------------------------------------------------------

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
      ...base('stg-pos'),
      params: {},
      layers: [staggerText]
    }
    const text = getSettingText(template)
    // XYPath for position (whole layer)
    expect(text).toMatch(/XYPath/)
    expect(text).toMatch(/BezierSpline/)
  })

  it('scale animation produces a Size spline even with stagger', () => {
    const template: MotionTemplate = {
      ...base('stg-scale'),
      params: {},
      layers: [staggerText]
    }
    const text = getSettingText(template)
    expect(text).toContain('Size')
    expect(text).toMatch(/BezierSpline/)
  })

  it('rotation animation produces an Angle spline even with stagger', () => {
    const template: MotionTemplate = {
      ...base('stg-rot'),
      params: {},
      layers: [staggerText]
    }
    const text = getSettingText(template)
    expect(text).toContain('Angle')
    expect(text).toMatch(/BezierSpline/)
  })
})
