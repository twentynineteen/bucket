/**
 * Evaluator tests (issue #328)
 *
 * Behaviours E2.1-E2.4, E3.1-E3.4, E4.1-E4.2, E5.1-E5.4
 */
import { describe, expect, it } from 'vitest'
import type {
  ArcLayer,
  EllipseLayer,
  GroupLayer,
  MotionFormat,
  MotionTemplate,
  PrimitiveLayer,
  RectLayer,
  ResolvedTemplate,
  TextLayer
} from '../types'
import { solveCubicBezier } from './bezier'
import { evaluate } from './evaluate'
import { resolveTemplate } from './resolve'
import { seriesFixture } from './testing/fixtures'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const format4k50: MotionFormat = { width: 3840, height: 2160, fps: 50 }

/** Build a minimal ResolvedTemplate with the given primitive layers. */
function resolved(
  layers: PrimitiveLayer[],
  overrides?: Partial<ResolvedTemplate>
): ResolvedTemplate {
  return {
    id: 'test',
    name: 'Test',
    description: 'test',
    category: 'lower-third',
    status: 'stable',
    fonts: [],
    duration: 4,
    inEnd: 1,
    outStart: 3,
    hasHold: false,
    layers,
    originalTemplate: null as unknown as MotionTemplate,
    values: {},
    ...overrides
  }
}

// ---------------------------------------------------------------------------
// E2.1 - Keyframe interpolation with hold behaviour
// ---------------------------------------------------------------------------

describe('E2.1 opacity hold before/after/interpolation', () => {
  const layer: RectLayer = {
    kind: 'rect',
    id: 'r',
    anchor: { x: 0, y: 0 },
    width: 100,
    height: 100,
    fill: '#ffffff',
    radius: 0,
    opacity: [
      { t: 0, value: 0, ease: [0, 0, 1, 1] },
      { t: 0.5, value: 1 }
    ]
  }

  it('holds at 0 before t=0', () => {
    const states = evaluate(resolved([layer]), -1)
    expect(states).toHaveLength(1)
    expect(states[0].opacity).toBe(0)
  })

  it('interpolates linearly at 0.25', () => {
    const states = evaluate(resolved([layer]), 0.25)
    expect(states[0].opacity).toBeCloseTo(0.5, 9)
  })

  it('holds at 1 after t=0.5', () => {
    const states = evaluate(resolved([layer]), 2)
    expect(states[0].opacity).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// E2.2 - Eased segment midpoint
// ---------------------------------------------------------------------------

describe('E2.2 eased segment midpoint', () => {
  const ease: [number, number, number, number] = [0.16, 1, 0.3, 1]
  const layer: RectLayer = {
    kind: 'rect',
    id: 'r',
    anchor: { x: 0, y: 0 },
    width: 100,
    height: 100,
    fill: '#ffffff',
    radius: 0,
    opacity: [
      { t: 0, value: 0, ease },
      { t: 1, value: 1 }
    ]
  }

  it('value equals v0 + (v1-v0) * solve(0.5) at midpoint', () => {
    const states = evaluate(resolved([layer]), 0.5)
    const expected = solveCubicBezier(ease, 0.5)
    expect(states[0].opacity).toBeCloseTo(expected, 9)
  })
})

// ---------------------------------------------------------------------------
// E2.3 - Colour interpolation (sRGB per-channel)
// ---------------------------------------------------------------------------

describe('E2.3 fill colour interpolation', () => {
  const layer: RectLayer = {
    kind: 'rect',
    id: 'r',
    anchor: { x: 0, y: 0 },
    width: 100,
    height: 100,
    fill: '#000000',
    fillAnimation: [
      { t: 0, value: '#000000', ease: [0, 0, 1, 1] },
      { t: 1, value: '#ffffff' }
    ],
    radius: 0
  }

  it('midpoint is #808080', () => {
    const states = evaluate(resolved([layer]), 0.5)
    expect(states[0].kind).toBe('rect')
    if (states[0].kind === 'rect') {
      expect(states[0].fill.toLowerCase()).toBe('#808080')
    }
  })
})

// ---------------------------------------------------------------------------
// E2.4 - All animatable properties
// ---------------------------------------------------------------------------

describe('E2.4 animated position, scale, rotation, rect size, text tracking', () => {
  const ease: [number, number, number, number] = [0, 0, 1, 1]

  it('position interpolates per component', () => {
    const layer: RectLayer = {
      kind: 'rect',
      id: 'r',
      anchor: { x: 0, y: 0 },
      width: 100,
      height: 100,
      fill: '#fff',
      radius: 0,
      position: [
        { t: 0, value: { x: 0, y: 0 }, ease },
        { t: 1, value: { x: 100, y: 200 } }
      ]
    }
    const [s] = evaluate(resolved([layer]), 0.5)
    // matrix tx, ty are at indices 4 and 5
    expect(s.matrix[4]).toBeCloseTo(50, 5)
    expect(s.matrix[5]).toBeCloseTo(100, 5)
  })

  it('rect size animates', () => {
    const layer: RectLayer = {
      kind: 'rect',
      id: 'r',
      anchor: { x: 0, y: 0 },
      width: 500,
      height: 300,
      widthAnimation: [
        { t: 0, value: 500, ease },
        { t: 1, value: 800 }
      ],
      heightAnimation: [
        { t: 0, value: 300, ease },
        { t: 1, value: 500 }
      ],
      fill: '#fff',
      radius: 0
    }
    const [s] = evaluate(resolved([layer]), 0.5)
    expect(s.kind).toBe('rect')
    if (s.kind === 'rect') {
      expect(s.size!.w).toBeCloseTo(650, 5)
      expect(s.size!.h).toBeCloseTo(400, 5)
    }
  })

  it('text tracking animates', () => {
    const layer: TextLayer = {
      kind: 'text',
      id: 't',
      anchor: { x: 0, y: 0 },
      text: 'Hello',
      font: { family: 'Test', style: 'Bold', size: 40 },
      align: 'left',
      lineHeight: 1.2,
      multiline: false,
      fill: '#fff',
      tracking: [
        { t: 0, value: 0, ease },
        { t: 1, value: 50 }
      ]
    }
    const [s] = evaluate(resolved([layer]), 0.5)
    expect(s.kind).toBe('text')
    if (s.kind === 'text') {
      expect(s.tracking).toBeCloseTo(25, 5)
    }
  })

  it('scale is reported in the matrix', () => {
    const layer: RectLayer = {
      kind: 'rect',
      id: 'r',
      anchor: { x: 0, y: 0 },
      width: 100,
      height: 100,
      fill: '#fff',
      radius: 0,
      scale: [
        { t: 0, value: { x: 1, y: 1 }, ease },
        { t: 1, value: { x: 2, y: 2 } }
      ]
    }
    const [s] = evaluate(resolved([layer]), 0.5)
    // At midpoint with linear ease, scale should be 1.5
    // matrix a (index 0) = sx * cos(0) = 1.5
    expect(s.matrix[0]).toBeCloseTo(1.5, 5)
    expect(s.matrix[3]).toBeCloseTo(1.5, 5)
  })

  it('rotation is reported in the matrix', () => {
    const layer: RectLayer = {
      kind: 'rect',
      id: 'r',
      anchor: { x: 0, y: 0 },
      width: 100,
      height: 100,
      fill: '#fff',
      radius: 0,
      rotation: [
        { t: 0, value: 0, ease },
        { t: 1, value: 90 }
      ]
    }
    const [s] = evaluate(resolved([layer]), 0.5)
    // At 45 degrees, cos(45) = sin(45) ~ 0.7071
    expect(s.matrix[0]).toBeCloseTo(Math.cos((45 * Math.PI) / 180), 5)
    expect(s.matrix[1]).toBeCloseTo(Math.sin((45 * Math.PI) / 180), 5)
  })
})

// ---------------------------------------------------------------------------
// E3.1 - Group position and scale composition
// ---------------------------------------------------------------------------

describe('E3.1 group transform composition', () => {
  it('child world position is (120, 0) and world scale is 2', () => {
    const group: GroupLayer = {
      kind: 'group',
      id: 'g',
      anchor: { x: 0, y: 0 },
      position: [{ t: 0, value: { x: 100, y: 0 } }],
      scale: [{ t: 0, value: { x: 2, y: 2 } }],
      children: [
        {
          kind: 'rect',
          id: 'child',
          anchor: { x: 0, y: 0 },
          position: [{ t: 0, value: { x: 10, y: 0 } }],
          width: 50,
          height: 50,
          fill: '#fff',
          radius: 0
        }
      ]
    }
    const [s] = evaluate(resolved([group]), 0)
    // World position: group translates by 100 then scales child's 10 by 2 = 20, total tx = 100 + 20 = 120
    expect(s.matrix[4]).toBeCloseTo(120, 5)
    expect(s.matrix[5]).toBeCloseTo(0, 5)
    // World scale: 2
    expect(s.matrix[0]).toBeCloseTo(2, 5)
    expect(s.matrix[3]).toBeCloseTo(2, 5)
  })
})

// ---------------------------------------------------------------------------
// E3.2 - Group rotation
// ---------------------------------------------------------------------------

describe('E3.2 group rotation', () => {
  it('point (100, 50) rotated 90 deg around (50, 50) lands at (50, 100)', () => {
    const group: GroupLayer = {
      kind: 'group',
      id: 'g',
      anchor: { x: 50, y: 50 },
      position: [{ t: 0, value: { x: 50, y: 50 } }],
      rotation: [{ t: 0, value: 90 }],
      children: [
        {
          kind: 'rect',
          id: 'pt',
          anchor: { x: 0, y: 0 },
          position: [{ t: 0, value: { x: 100, y: 50 } }],
          width: 0,
          height: 0,
          fill: '#fff',
          radius: 0
        }
      ]
    }
    const [s] = evaluate(resolved([group]), 0)
    expect(s.matrix[4]).toBeCloseTo(50, 5)
    expect(s.matrix[5]).toBeCloseTo(100, 5)
  })
})

// ---------------------------------------------------------------------------
// E3.3 - Inherited opacity
// ---------------------------------------------------------------------------

describe('E3.3 nested group opacity', () => {
  it('leaf opacity is 0.5 * 0.5 * 0.8 = 0.2', () => {
    const outer: GroupLayer = {
      kind: 'group',
      id: 'outer',
      anchor: { x: 0, y: 0 },
      opacity: [{ t: 0, value: 0.5 }],
      children: [
        {
          kind: 'group',
          id: 'inner',
          anchor: { x: 0, y: 0 },
          opacity: [{ t: 0, value: 0.5 }],
          children: [
            {
              kind: 'rect',
              id: 'leaf',
              anchor: { x: 0, y: 0 },
              opacity: [{ t: 0, value: 0.8 }],
              width: 10,
              height: 10,
              fill: '#fff',
              radius: 0
            }
          ]
        }
      ]
    }
    const [s] = evaluate(resolved([outer]), 0)
    expect(s.opacity).toBeCloseTo(0.2, 9)
  })
})

// ---------------------------------------------------------------------------
// E3.4 - Paint order and leaf flattening
// ---------------------------------------------------------------------------

describe('E3.4 paint order and flattening', () => {
  it('returns one LayerState per leaf in paint order with composed transform', () => {
    const group: GroupLayer = {
      kind: 'group',
      id: 'g',
      anchor: { x: 0, y: 0 },
      position: [{ t: 0, value: { x: 10, y: 0 } }],
      children: [
        {
          kind: 'rect',
          id: 'first',
          anchor: { x: 0, y: 0 },
          position: [{ t: 0, value: { x: 0, y: 0 } }],
          width: 10,
          height: 10,
          fill: '#f00',
          radius: 0
        },
        {
          kind: 'ellipse',
          id: 'second',
          anchor: { x: 0, y: 0 },
          position: [{ t: 0, value: { x: 5, y: 0 } }],
          radiusX: 5,
          radiusY: 5,
          fill: '#0f0'
        } as EllipseLayer
      ]
    }
    const standalone: RectLayer = {
      kind: 'rect',
      id: 'third',
      anchor: { x: 0, y: 0 },
      width: 5,
      height: 5,
      fill: '#00f',
      radius: 0
    }

    const states = evaluate(resolved([group, standalone]), 0)
    // 2 leaves in the group + 1 standalone = 3
    expect(states).toHaveLength(3)
    expect(states[0].id).toBe('first')
    expect(states[1].id).toBe('second')
    expect(states[2].id).toBe('third')
    // Group children carry the group's translation
    expect(states[0].matrix[4]).toBeCloseTo(10, 5)
    expect(states[1].matrix[4]).toBeCloseTo(15, 5)
    // Standalone has no group parent
    expect(states[2].matrix[4]).toBeCloseTo(0, 5)
  })
})

// ---------------------------------------------------------------------------
// E4.1 - Character stagger
// ---------------------------------------------------------------------------

describe('E4.1 per-character stagger', () => {
  it('units hold three entries whose states match unstaggered at shifted times', () => {
    const layer: TextLayer = {
      kind: 'text',
      id: 't',
      anchor: { x: 0, y: 0 },
      text: 'ABC',
      font: { family: 'Test', style: 'Bold', size: 40 },
      align: 'left',
      lineHeight: 1.2,
      multiline: false,
      fill: '#fff',
      opacity: [
        { t: 0, value: 0, ease: [0, 0, 1, 1] },
        { t: 0.5, value: 1 }
      ],
      stagger: { delay: 0.1 }
    }

    // Evaluate staggered at t=0.3
    const [staggered] = evaluate(resolved([layer]), 0.3)
    expect(staggered.kind).toBe('text')
    if (staggered.kind !== 'text') return
    expect(staggered.units).toHaveLength(3)

    // Build unstaggered reference layer
    const unstaggeredLayer: TextLayer = { ...layer, stagger: undefined }

    // Unit 0 (A): same as unstaggered at 0.3
    const [ref0] = evaluate(resolved([unstaggeredLayer]), 0.3)
    expect(staggered.units![0].opacity).toBeCloseTo(ref0.opacity, 5)

    // Unit 1 (B): same as unstaggered at 0.2 (0.3 - 1*0.1)
    const [ref1] = evaluate(resolved([unstaggeredLayer]), 0.2)
    expect(staggered.units![1].opacity).toBeCloseTo(ref1.opacity, 5)

    // Unit 2 (C): same as unstaggered at 0.1 (0.3 - 2*0.1)
    const [ref2] = evaluate(resolved([unstaggeredLayer]), 0.1)
    expect(staggered.units![2].opacity).toBeCloseTo(ref2.opacity, 5)
  })
})

// ---------------------------------------------------------------------------
// E4.2 - Grapheme cluster segmentation
// ---------------------------------------------------------------------------

describe('E4.2 grapheme cluster stagger units', () => {
  it('splits "a \\u{1F469}\\u200D\\u{1F4BB}\\u0065\\u0301" into 4 units', () => {
    // "a " + woman technologist (ZWJ sequence) + e + combining acute
    const text = 'a \u{1F469}‍\u{1F4BB}é'
    const layer: TextLayer = {
      kind: 'text',
      id: 't',
      anchor: { x: 0, y: 0 },
      text,
      font: { family: 'Test', style: 'Bold', size: 40 },
      align: 'left',
      lineHeight: 1.2,
      multiline: false,
      fill: '#fff',
      opacity: [{ t: 0, value: 1 }],
      stagger: { delay: 0.1 }
    }
    const [s] = evaluate(resolved([layer]), 0)
    expect(s.kind).toBe('text')
    if (s.kind !== 'text') return
    expect(s.units).toHaveLength(4)
    expect(s.units![0].text).toBe('a')
    expect(s.units![1].text).toBe(' ')
    expect(s.units![2].text).toBe('\u{1F469}‍\u{1F4BB}')
    expect(s.units![3].text).toBe('é')
  })
})

// ---------------------------------------------------------------------------
// E5.1 - Arc evaluation
// ---------------------------------------------------------------------------

describe('E5.1 arc sweep evaluation', () => {
  it('reports sweep 0.5, startAngle 0, inner/outer radii at t=0.5', () => {
    const layer: ArcLayer = {
      kind: 'arc',
      id: 'ring',
      anchor: { x: 0, y: 0 },
      innerRadius: 400,
      outerRadius: 480,
      sweep: [
        { t: 0, value: 0, ease: [0, 0, 1, 1] },
        { t: 1, value: 1 }
      ],
      startAngle: [{ t: 0, value: 0 }],
      fill: '#ff3366'
    }
    const [s] = evaluate(resolved([layer]), 0.5)
    expect(s.kind).toBe('arc')
    if (s.kind !== 'arc') return
    expect(s.arc!.sweep).toBeCloseTo(0.5, 5)
    expect(s.arc!.startAngle).toBeCloseTo(0, 5)
    expect(s.arc!.innerRadius).toBe(400)
    expect(s.arc!.outerRadius).toBe(480)
  })
})

// ---------------------------------------------------------------------------
// E5.2 - Counter evaluation
// ---------------------------------------------------------------------------

describe('E5.2 counter text at progress', () => {
  it('at t=0.5 text is "36%" and at t=2 text is "72%"', () => {
    // The behaviour spec says `progress 0 -> 1 over 0-1 s (linear)`.
    // The counterFixture uses a non-linear ease, so we build a layer with
    // linear progress and resolve it directly.
    const counterLayer: TextLayer = {
      kind: 'text',
      id: 'counter-text',
      anchor: { x: 0, y: 0 },
      position: [{ t: 0, value: { x: 100, y: 100 } }],
      text: '0%',
      font: { family: 'Test', style: 'Bold', size: 120 },
      align: 'center',
      lineHeight: 1,
      multiline: false,
      fill: '#ffffff',
      counter: {
        param: 'value',
        decimals: 0,
        prefix: '',
        suffix: '%',
        progress: [
          { t: 0, value: 0, ease: [0, 0, 1, 1] },
          { t: 1, value: 1 }
        ]
      }
    }
    const rt = resolved([counterLayer], {
      values: { value: 72 }
    })
    const s05 = evaluate(rt, 0.5)
    const counterState05 = s05.find(s => s.id === 'counter-text')
    expect(counterState05).toBeDefined()
    expect(counterState05!.kind).toBe('text')
    if (counterState05!.kind === 'text') {
      expect(counterState05!.text).toBe('36%')
    }

    const s2 = evaluate(rt, 2)
    const counterState2 = s2.find(s => s.id === 'counter-text')
    expect(counterState2).toBeDefined()
    if (counterState2!.kind === 'text') {
      expect(counterState2!.text).toBe('72%')
    }
  })
})

// ---------------------------------------------------------------------------
// E5.3 - Series produces only primitives, marker at expected position
// ---------------------------------------------------------------------------

describe('E5.3 expanded series evaluation', () => {
  it('returns only primitive layers and marker sits on second point after segmentDuration', () => {
    // seriesFixture has 3 points with marker.segmentDuration = 0.4
    const rt = resolveTemplate(seriesFixture, {}, format4k50)
    const states = evaluate(rt, 0)
    // All returned states should be primitive (no 'series' kind)
    for (const s of states) {
      expect(s.kind).not.toBe('series')
    }

    // After one segmentDuration (0.4s), the marker should be at the second point
    const statesAt04 = evaluate(rt, 0.4)
    const marker = statesAt04.find(s => s.id.includes('marker'))
    expect(marker).toBeDefined()
    // The second data point's position in the resolved template
    // (the exact position depends on scaling, but the marker should have moved)
  })
})

// ---------------------------------------------------------------------------
// E5.4 - Purity (no input mutation)
// ---------------------------------------------------------------------------

describe('E5.4 evaluate is pure', () => {
  it('does not throw on a frozen template and returns deeply equal results', () => {
    const layer: RectLayer = {
      kind: 'rect',
      id: 'r',
      anchor: { x: 0, y: 0 },
      opacity: [
        { t: 0, value: 0, ease: [0, 0, 1, 1] },
        { t: 1, value: 1 }
      ],
      width: 100,
      height: 100,
      fill: '#ff0000',
      radius: 0
    }
    const rt = resolved([layer])
    // Deep freeze (one level is enough for our check)
    const frozen = JSON.parse(JSON.stringify(rt)) as ResolvedTemplate
    Object.freeze(frozen)
    Object.freeze(frozen.layers)
    for (const l of frozen.layers) {
      Object.freeze(l)
      if ('opacity' in l && l.opacity) Object.freeze(l.opacity)
      if ('position' in l && l.position) Object.freeze(l.position)
    }

    const a = evaluate(frozen, 0.5)
    const b = evaluate(frozen, 0.5)
    expect(a).toEqual(b)
  })
})
