/**
 * Timing rules and built-in template tests (issue #332)
 *
 * Behaviours S2.1 - S2.7 (templates) and S3.1 - S3.6 (timing rules).
 *
 * Each timing rule is tested twice:
 *   1. Against a deliberately broken fixture (the checker reports that rule)
 *   2. Over all ten built-ins (no violations)
 */
import { readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { MotionFormat, MotionTemplate } from '../../types'
import { loadBuiltins } from '../builtins'
import { evaluate } from '../evaluate'
import { expandTemplate } from '../expand'
import { resolveTemplate, validFormats } from '../resolve'
import { parseTemplate } from '../schema'
import {
  checkEaseDirection,
  checkEntranceQuality,
  checkInDuration,
  checkOutInRatio,
  checkStaggerBudget,
  checkTextBoxWidth,
  checkTitleSafe
} from './timingRules'

// ---------------------------------------------------------------------------
// Load built-ins
// ---------------------------------------------------------------------------

const { templates: builtins } = loadBuiltins()

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Make a minimal broken fixture from a valid template with overrides. */
function brokenFixture(
  overrides: Partial<MotionTemplate> & { id: string }
): MotionTemplate {
  return {
    schemaVersion: 1,
    version: '1.0.0',
    name: 'Broken fixture',
    description: 'Testing',
    category: 'lower-third',
    status: 'stable',
    tags: [],
    fonts: ['CabritoSemi-NorBol'],
    duration: 4,
    inEnd: 0.8,
    outStart: 3.4,
    params: {},
    layers: [
      {
        kind: 'rect',
        id: 'bg',
        anchor: { x: 0, y: 0 },
        position: [{ t: 0, value: { x: 500, y: 500 } }],
        opacity: [
          { t: 0, value: 0, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
          {
            t: 0.8,
            value: 1,
            ease: [0.16, 1, 0.3, 1] as [number, number, number, number]
          },
          {
            t: 3.4,
            value: 1,
            ease: [0.7, 0, 1, 0.5] as [number, number, number, number]
          },
          { t: 4, value: 0 }
        ],
        width: 600,
        height: 100,
        fill: '#333333',
        radius: 12
      }
    ],
    ...overrides
  }
}

// ---------------------------------------------------------------------------
// S2.1: every built-in passes the schema
// ---------------------------------------------------------------------------

describe('S2.1: every built-in passes the schema', () => {
  it('each built-in passes the schema with a semver version', () => {
    for (const t of builtins) {
      const result = parseTemplate(t)
      expect(
        result.success,
        `${t.id} failed schema: ${'error' in result ? result.error : ''}`
      ).toBe(true)
      expect(t.version).toMatch(/^\d+\.\d+\.\d+$/)
    }
  })

  it('no two built-ins share an id', () => {
    const ids = builtins.map(t => t.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })
})

// ---------------------------------------------------------------------------
// S2.2: Cabrito font usage
// ---------------------------------------------------------------------------

describe('S2.2: Cabrito font in text layers', () => {
  function collectFontsFromLayers(layers: MotionTemplate['layers']): string[] {
    const fonts: string[] = []
    for (const l of layers) {
      if (l.kind === 'text') {
        fonts.push(`${l.font.family} ${l.font.style}`)
      }
      if (l.kind === 'group') {
        fonts.push(...collectFontsFromLayers(l.children))
      }
    }
    return fonts
  }

  it('every built-in with text layers uses Cabrito Semi Norm Bold', () => {
    for (const t of builtins) {
      const fonts = collectFontsFromLayers(t.layers)
      if (fonts.length === 0) continue
      expect(t.fonts, `${t.id} missing CabritoSemi-NorBol in fonts`).toContain(
        'CabritoSemi-NorBol'
      )
      for (const f of fonts) {
        expect(f, `${t.id} text layer uses wrong font`).toBe('Cabrito Semi Norm Bold')
      }
    }
  })
})

// ---------------------------------------------------------------------------
// Spread map: stipple figure check
// ---------------------------------------------------------------------------

describe('Spread map stipple forms a figure', () => {
  it('points cover a silhouette, not their whole bounding box', () => {
    // An inverted cut-out mask fills the rectangle around the subject and
    // leaves the figure as a hole. A real silhouette leaves most of its
    // bounding box empty.
    const t = builtins.find(b => b.id === 'spread-map')!
    const layer = t.layers.find(l => l.kind === 'particles')
    if (!layer || layer.kind !== 'particles')
      throw new Error('spread-map has no particles')
    const xs = layer.points.map(p => p.x)
    const ys = layer.points.map(p => p.y)
    const [x0, x1, y0, y1] = [
      Math.min(...xs),
      Math.max(...xs),
      Math.min(...ys),
      Math.max(...ys)
    ]
    const cells = 24
    const occupied = new Set(
      layer.points.map(
        p =>
          `${Math.min(cells - 1, Math.floor(((p.x - x0) / (x1 - x0)) * cells))},` +
          `${Math.min(cells - 1, Math.floor(((p.y - y0) / (y1 - y0)) * cells))}`
      )
    )
    expect(occupied.size / (cells * cells)).toBeLessThan(0.6)
  })
})

// ---------------------------------------------------------------------------
// Score ring: 72 -> 0.72 sweep
// ---------------------------------------------------------------------------

describe('Score ring sweep expansion', () => {
  it('passing 72 to the number param produces a final sweep of 0.72', () => {
    const sr = builtins.find(t => t.id === 'score-ring')!
    const numParam = Object.entries(sr.params).find(([, p]) => p.kind === 'number')!
    const [numId] = numParam
    const arc = sr.layers.find(l => l.kind === 'arc' && l.sweepFromParam)!
    const expanded = expandTemplate(sr.layers, sr.params, { [numId]: 72 })
    const expandedArc = expanded.find(l => l.id === arc.id)!
    if (expandedArc.kind === 'arc') {
      const lastSweep = expandedArc.sweep[expandedArc.sweep.length - 1]
      expect(lastSweep.value).toBeCloseTo(0.72, 5)
    }
  })
})

// ---------------------------------------------------------------------------
// S2.6: all formats valid at 24 fps
// ---------------------------------------------------------------------------

describe('S2.6: built-ins valid at all fps including 24', () => {
  const ALL_FORMATS: MotionFormat[] = []
  for (const width of [3840, 1920] as const) {
    const height = width === 3840 ? 2160 : 1080
    for (const fps of [24, 25, 30, 50, 60] as const) {
      ALL_FORMATS.push({
        width: width as 3840 | 1920,
        height: height as 2160 | 1080,
        fps: fps as 24 | 25 | 30 | 50 | 60
      })
    }
  }

  it.each(builtins.map(t => [t.id, t] as [string, MotionTemplate]))(
    '%s valid at every format',
    (_id, t) => {
      const formats = validFormats(t)
      for (const fmt of ALL_FORMATS) {
        const found = formats.some(f => f.width === fmt.width && f.fps === fmt.fps)
        expect(found, `${t.id} invalid at ${fmt.width}x${fmt.height}@${fmt.fps}fps`).toBe(
          true
        )
      }
    }
  )
})

// ---------------------------------------------------------------------------
// S2.7: only .json files in templates directory
// ---------------------------------------------------------------------------

describe('S2.7: templates directory contains only .json', () => {
  it('no non-json files in internal/templates/', () => {
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = dirname(__filename)
    const templatesDir = join(__dirname, '..', 'templates')
    const files = readdirSync(templatesDir)
    const realFiles = files.filter(f => f !== '.gitkeep')
    for (const f of realFiles) {
      expect(f, `non-JSON file in templates: ${f}`).toMatch(/\.json$/)
    }
  })
})

// ---------------------------------------------------------------------------
// S3.1: in-duration rule
// ---------------------------------------------------------------------------

describe('S3.1: in-duration 0.5-1s', () => {
  it('broken fixture (too short) reports violation', () => {
    const t = brokenFixture({ id: 'broken-in-short', inEnd: 0.3 })
    const violations = checkInDuration(t)
    expect(violations.length).toBeGreaterThan(0)
    expect(violations[0].rule).toBe('S3.1')
  })

  it('broken fixture (too long) reports violation', () => {
    const t = brokenFixture({ id: 'broken-in-long', inEnd: 1.5, outStart: 3.4 })
    const violations = checkInDuration(t)
    expect(violations.length).toBeGreaterThan(0)
    expect(violations[0].rule).toBe('S3.1')
  })

  it('all built-ins pass', () => {
    for (const t of builtins) {
      const violations = checkInDuration(t)
      expect(violations, `${t.id} failed S3.1`).toEqual([])
    }
  })
})

// ---------------------------------------------------------------------------
// S3.2: out/in ratio rule
// ---------------------------------------------------------------------------

describe('S3.2: out/in ratio 0.5-0.8', () => {
  it('broken fixture (ratio too low) reports violation', () => {
    // inEnd=0.8, outStart=3.8, duration=4 -> outDur=0.2, ratio=0.25
    const t = brokenFixture({
      id: 'broken-ratio-low',
      inEnd: 0.8,
      outStart: 3.8,
      duration: 4
    })
    const violations = checkOutInRatio(t)
    expect(violations.length).toBeGreaterThan(0)
    expect(violations[0].rule).toBe('S3.2')
  })

  it('broken fixture (ratio too high) reports violation', () => {
    // inEnd=0.5, outStart=3, duration=4 -> outDur=1, ratio=2.0
    const t = brokenFixture({
      id: 'broken-ratio-high',
      inEnd: 0.5,
      outStart: 3,
      duration: 4
    })
    const violations = checkOutInRatio(t)
    expect(violations.length).toBeGreaterThan(0)
    expect(violations[0].rule).toBe('S3.2')
  })

  it('all built-ins pass', () => {
    for (const t of builtins) {
      const violations = checkOutInRatio(t)
      expect(violations, `${t.id} failed S3.2`).toEqual([])
    }
  })
})

// ---------------------------------------------------------------------------
// S3.3: stagger budget rule
// ---------------------------------------------------------------------------

describe('S3.3: stagger total <= 40% of entrance', () => {
  it('broken fixture (stagger too long) reports violation', () => {
    const t: MotionTemplate = {
      ...brokenFixture({ id: 'broken-stagger' }),
      params: {
        name: {
          kind: 'text',
          label: 'Name',
          maxLength: 30,
          default: 'Test long enough to bust',
          required: true
        }
      },
      layers: [
        {
          kind: 'text',
          id: 'title',
          anchor: { x: 0, y: 0 },
          position: [{ t: 0, value: { x: 500, y: 500 } }],
          text: 'Test long enough to bust',
          param: 'name',
          font: { family: 'Cabrito Semi', style: 'Norm Bold', size: 60 },
          align: 'left',
          lineHeight: 1.2,
          multiline: false,
          fill: '#ffffff',
          stagger: { delay: 0.05 }, // 0.05 * 23 = 1.15 >> 40% of 0.8 = 0.32
          width: 1200
        }
      ]
    }
    const violations = checkStaggerBudget(t)
    expect(violations.length).toBeGreaterThan(0)
    expect(violations[0].rule).toBe('S3.3')
  })

  it('all built-ins pass', () => {
    for (const t of builtins) {
      const violations = checkStaggerBudget(t)
      expect(violations, `${t.id} failed S3.3`).toEqual([])
    }
  })
})

// ---------------------------------------------------------------------------
// S3.4: title-safe rule
// ---------------------------------------------------------------------------

describe('S3.4: title-safe and action-safe bounds', () => {
  it('broken fixture (text outside safe area) reports violation', () => {
    const t = brokenFixture({
      id: 'broken-safe',
      layers: [
        {
          kind: 'text',
          id: 'offscreen',
          anchor: { x: 0, y: 0 },
          position: [{ t: 0, value: { x: 50, y: 50 } }],
          text: 'Offscreen',
          font: { family: 'Cabrito Semi', style: 'Norm Bold', size: 60 },
          align: 'left',
          lineHeight: 1.2,
          multiline: false,
          fill: '#ffffff'
        }
      ]
    })
    const violations = checkTitleSafe(t)
    expect(violations.length).toBeGreaterThan(0)
    expect(violations[0].rule).toBe('S3.4')
  })

  it('rect whose position is safe but whose width overhangs the right edge reports violation', () => {
    const t = brokenFixture({
      id: 'broken-safe-wide-rect',
      layers: [
        {
          kind: 'rect',
          id: 'overhang',
          anchor: { x: 0, y: 0 },
          position: [{ t: 0, value: { x: 3000, y: 1700 } }],
          width: 900,
          height: 100,
          fill: '#333333',
          radius: 0
        }
      ]
    })
    const violations = checkTitleSafe(t)
    expect(violations.map(v => v.rule)).toContain('S3.4')
    expect(violations[0].message).toContain('overhang')
  })

  it('child inside a group is checked at its world position, including the group offset', () => {
    const t = brokenFixture({
      id: 'broken-safe-group-offset',
      layers: [
        {
          kind: 'group',
          id: 'shifted',
          anchor: { x: 0, y: 0 },
          position: [{ t: 0, value: { x: 3500, y: 0 } }],
          children: [
            {
              kind: 'rect',
              id: 'child-bar',
              anchor: { x: 0, y: 0 },
              position: [{ t: 0, value: { x: 300, y: 1700 } }],
              width: 100,
              height: 100,
              fill: '#333333',
              radius: 0
            }
          ]
        }
      ]
    })
    const violations = checkTitleSafe(t)
    expect(violations.map(v => v.rule)).toContain('S3.4')
    expect(violations[0].message).toContain('child-bar')
  })

  it('all built-ins pass', () => {
    for (const t of builtins) {
      const violations = checkTitleSafe(t)
      expect(violations, `${t.id} failed S3.4`).toEqual([])
    }
  })
})

// ---------------------------------------------------------------------------
// S3.5: text box width rule
// ---------------------------------------------------------------------------

describe('S3.5: text box >= maxLength x fontSize x 0.6', () => {
  it('broken fixture (box too narrow) reports violation', () => {
    const t: MotionTemplate = {
      ...brokenFixture({ id: 'broken-textbox' }),
      params: {
        title: {
          kind: 'text',
          label: 'Title',
          maxLength: 40,
          default: 'Test',
          required: true
        }
      },
      layers: [
        {
          kind: 'text',
          id: 'narrow',
          anchor: { x: 0, y: 0 },
          position: [{ t: 0, value: { x: 500, y: 500 } }],
          text: 'Test',
          param: 'title',
          font: { family: 'Cabrito Semi', style: 'Norm Bold', size: 80 },
          align: 'left',
          lineHeight: 1.2,
          multiline: false,
          fill: '#ffffff',
          width: 500 // 40 * 80 * 0.6 = 1920
        }
      ]
    }
    const violations = checkTextBoxWidth(t)
    expect(violations.length).toBeGreaterThan(0)
    expect(violations[0].rule).toBe('S3.5')
  })

  it('all built-ins pass', () => {
    for (const t of builtins) {
      const violations = checkTextBoxWidth(t)
      expect(violations, `${t.id} failed S3.5`).toEqual([])
    }
  })
})

// ---------------------------------------------------------------------------
// S3.6: ease direction rule
// ---------------------------------------------------------------------------

describe('S3.6: ease direction (entrance out, exit in)', () => {
  it('broken fixture (entrance eases in) reports violation', () => {
    const t = brokenFixture({
      id: 'broken-ease',
      layers: [
        {
          kind: 'rect',
          id: 'wrong-ease',
          anchor: { x: 0, y: 0 },
          position: [{ t: 0, value: { x: 500, y: 500 } }],
          opacity: [
            // Entrance segment: ease in (y1 < x1) - WRONG
            {
              t: 0,
              value: 0,
              ease: [0.7, 0.2, 0.84, 0] as [number, number, number, number]
            },
            { t: 0.8, value: 1 }
          ],
          width: 600,
          height: 100,
          fill: '#333333',
          radius: 12
        }
      ]
    })
    const violations = checkEaseDirection(t)
    expect(violations.length).toBeGreaterThan(0)
    expect(violations[0].rule).toBe('S3.6')
  })

  it('all built-ins pass', () => {
    for (const t of builtins) {
      const violations = checkEaseDirection(t)
      expect(violations, `${t.id} failed S3.6`).toEqual([])
    }
  })
})

// ---------------------------------------------------------------------------
// Accent overlap guard: no thin rect strikes through text at hold time
// ---------------------------------------------------------------------------

describe('accent overlap guard: no thin rect strikes through text at hold', () => {
  const FORMAT: MotionFormat = { width: 3840, height: 2160, fps: 25 }

  for (const tmpl of builtins) {
    it(`${tmpl.id}: thin rects clear of text at hold`, () => {
      const holdTime = (tmpl.inEnd + tmpl.outStart) / 2
      const values: Record<string, string | number> = {}
      for (const [id, p] of Object.entries(tmpl.params)) {
        if ('default' in p) values[id] = p.default
      }
      const resolved = resolveTemplate(tmpl, values, FORMAT)
      const states = evaluate(resolved, holdTime)

      // Collect thin rects (height <= 12) and text layers
      const thinRects: {
        id: string
        top: number
        bottom: number
        left: number
        right: number
      }[] = []
      const textBoxes: {
        id: string
        top: number
        bottom: number
        left: number
        right: number
      }[] = []

      for (const s of states) {
        if (s.kind === 'rect' && s.size && s.size.h <= 12) {
          // Rect top-left is at the matrix translation (anchor is 0,0)
          const x = s.matrix[4]
          const y = s.matrix[5]
          thinRects.push({
            id: s.id,
            top: y,
            bottom: y + s.size.h,
            left: x,
            right: x + s.size.w
          })
        }

        if (s.kind === 'text') {
          // Estimated text box: baseline - 0.75*size to baseline + 0.25*size
          const baseline = s.matrix[5]
          const x = s.matrix[4]
          const size = s.font.size
          // For text-anchor "middle", the text is centred at x
          // We estimate width from the text length and font size
          const estimatedWidth = s.text.length * size * 0.6
          let left: number
          let right: number
          if (s.align === 'center') {
            left = x - estimatedWidth / 2
            right = x + estimatedWidth / 2
          } else if (s.align === 'right') {
            left = x - estimatedWidth
            right = x
          } else {
            left = x
            right = x + estimatedWidth
          }

          textBoxes.push({
            id: s.id,
            top: baseline - 0.75 * size,
            bottom: baseline + 0.25 * size,
            left,
            right
          })
        }
      }

      // Check no thin rect overlaps any text box both vertically and horizontally
      for (const rect of thinRects) {
        for (const text of textBoxes) {
          const vOverlap = rect.top < text.bottom && rect.bottom > text.top
          const hOverlap = rect.left < text.right && rect.right > text.left
          if (vOverlap && hOverlap) {
            expect.fail(
              `${tmpl.id}: thin rect "${rect.id}" (y ${rect.top.toFixed(0)}-${rect.bottom.toFixed(0)}) ` +
                `overlaps text "${text.id}" (y ${text.top.toFixed(0)}-${text.bottom.toFixed(0)})`
            )
          }
        }
      }
    })
  }
})

// ---------------------------------------------------------------------------
// S3.7: entrance quality rule (at least one position/scale animation)
// ---------------------------------------------------------------------------

describe('S3.7: entrance has position or scale animation', () => {
  it('broken fixture (opacity-only entrance) reports violation', () => {
    const t = brokenFixture({
      id: 'broken-quality',
      layers: [
        {
          kind: 'rect',
          id: 'fade-only',
          anchor: { x: 0, y: 0 },
          position: [{ t: 0, value: { x: 500, y: 500 } }],
          opacity: [
            {
              t: 0,
              value: 0,
              ease: [0.16, 1, 0.3, 1] as [number, number, number, number]
            },
            { t: 0.8, value: 1 }
          ],
          width: 600,
          height: 100,
          fill: '#333333',
          radius: 12
        }
      ]
    })
    const violations = checkEntranceQuality(t)
    expect(violations.length).toBeGreaterThan(0)
    expect(violations[0].rule).toBe('S3.7')
  })

  it('all non-transition built-ins pass', () => {
    for (const t of builtins) {
      if (t.category === 'transition') continue
      const violations = checkEntranceQuality(t)
      expect(violations, `${t.id} failed S3.7`).toEqual([])
    }
  })
})
