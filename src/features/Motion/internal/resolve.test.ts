/**
 * Resolve module tests (F3.1-F3.8)
 *
 * Tests for param resolution, validation, hold shift, format scaling,
 * frame snap, slug, target derivation and per-fps validity.
 */
import { describe, expect, it } from 'vitest'
import type { MotionFormat, MotionTemplate, RectLayer, TextLayer } from '../types'
import { loadBuiltins } from './builtins'
import {
  deriveTargets,
  exportFolderName,
  getHoldParam,
  resolveTemplate,
  slugify,
  validateParams,
  validFormats
} from './resolve'
import {
  holdParamFixture,
  particlesFixture,
  rectFixture,
  textFixture
} from './testing/fixtures'

const FORMAT_4K: MotionFormat = { width: 3840, height: 2160, fps: 50 }
const FORMAT_HD: MotionFormat = { width: 1920, height: 1080, fps: 25 }

describe('Resolve (internal/resolve.ts)', () => {
  // F3.1 - empty values uses defaults
  it('F3.1 empty values resolved to defaults, result is valid', () => {
    const resolved = resolveTemplate(textFixture, {}, FORMAT_4K)
    expect(resolved).toBeDefined()
    expect(resolved.id).toBe('fixture-text')
    expect(resolved.layers.length).toBeGreaterThan(0)
    // The text layer should have the default text
    const textLayer = resolved.layers.find(l => l.kind === 'text') as TextLayer
    expect(textLayer).toBeDefined()
    expect(textLayer.text).toBe('Jane Doe')
  })

  // F3.2 - param validation failures
  describe('F3.2 param validation failures', () => {
    it.each([
      ['required text set to empty', textFixture, { name: '' }],
      ['text exceeds maxLength', textFixture, { name: 'A'.repeat(41) }],
      [
        'non-hex colour',
        {
          ...rectFixture,
          params: {
            accent: {
              kind: 'colour' as const,
              label: 'Accent',
              default: '#ff3366',
              binds: []
            }
          }
        },
        { accent: 'not-a-hex' }
      ],
      [
        'numberList with 9 items',
        {
          ...rectFixture,
          params: {
            data: {
              kind: 'numberList' as const,
              label: 'Data',
              default: [],
              valueMin: 0,
              valueMax: 100
            }
          }
        },
        {
          data: Array.from({ length: 9 }, (_, i) => ({
            label: `${i}`,
            value: i
          }))
        }
      ],
      [
        'numberList item outside min/max',
        {
          ...rectFixture,
          params: {
            data: {
              kind: 'numberList' as const,
              label: 'Data',
              default: [],
              valueMin: 0,
              valueMax: 100
            }
          }
        },
        { data: [{ label: 'Over', value: 101 }] }
      ],
      [
        'number outside range',
        {
          ...rectFixture,
          params: {
            score: {
              kind: 'number' as const,
              label: 'Score',
              default: 50,
              min: 0,
              max: 100
            }
          }
        },
        { score: 101 }
      ],
      ['hold outside min/max', holdParamFixture, { hold: 11 }]
    ])('rejects %s and names the param', (_label, template, values) => {
      const errors = validateParams(template as MotionTemplate, values)
      expect(errors.length).toBeGreaterThan(0)
      // Each error names a param id
      for (const err of errors) {
        expect(err.paramId).toBeTruthy()
      }
    })
  })

  // F3.3 - hold shift
  describe('F3.3 hold shift', () => {
    // holdParamFixture: inEnd=1, outStart=3, duration=4, hold default=2
    // Keyframes at t=0, 1, 3, 3.5
    it('with hold=5, keys at 3 and 3.5 move to 6 and 6.5, duration grows by 3', () => {
      const resolved = resolveTemplate(holdParamFixture, { hold: 5 }, FORMAT_4K)
      // holdDelta = 5 - 2 = 3
      // Keys at t>=3 shift by +3
      const layer = resolved.layers[0]
      const opKfs = layer.opacity!
      // Original: [0, 1, 3, 3.5] -> After shift: [0, 1, 6, 6.5]
      expect(opKfs[0].t).toBe(0)
      expect(opKfs[1].t).toBe(1)
      expect(opKfs[2].t).toBe(6)
      expect(opKfs[3].t).toBe(6.5)
      // Eases unchanged
      expect(opKfs[0].ease).toEqual([0.16, 1, 0.3, 1])
      // outStart and duration grow by 3
      expect(resolved.outStart).toBe(6)
      expect(resolved.duration).toBe(7)
    })

    it('with hold=1, keys at 3 and 3.5 move to 2 and 2.5, both markers shrink by 1', () => {
      const resolved = resolveTemplate(holdParamFixture, { hold: 1 }, FORMAT_4K)
      // holdDelta = 1 - 2 = -1
      const layer = resolved.layers[0]
      const opKfs = layer.opacity!
      expect(opKfs[0].t).toBe(0)
      expect(opKfs[1].t).toBe(1)
      expect(opKfs[2].t).toBe(2)
      expect(opKfs[3].t).toBe(2.5)
      expect(resolved.outStart).toBe(2)
      expect(resolved.duration).toBe(3)
    })
  })

  // F3.4 - no hold param
  it('F3.4 no hold param means no keyframe movement and hasHold false', () => {
    const resolved = resolveTemplate(textFixture, {}, FORMAT_4K)
    expect(resolved.hasHold).toBe(false)
    // Keyframes should not have been shifted
    const layer = resolved.layers.find(l => l.kind === 'text')
    expect(layer).toBeDefined()
    expect(layer!.opacity![0].t).toBe(0)
  })

  // F3.5 - format scaling
  describe('F3.5 format scaling', () => {
    it('3840x2160 leaves values unchanged', () => {
      const resolved = resolveTemplate(rectFixture, {}, FORMAT_4K)
      const rect = resolved.layers.find(l => l.kind === 'rect') as RectLayer
      // rectFixture has width 1000, height 200, radius 24
      expect(rect.width).toBe(1000)
      expect(rect.height).toBe(200)
      expect(rect.radius).toBe(24)
    })

    it('1920x1080 halves positions, sizes, radii and font sizes; rotation, opacity unchanged', () => {
      const resolved = resolveTemplate(rectFixture, {}, FORMAT_HD)
      const rect = resolved.layers.find(l => l.kind === 'rect') as RectLayer
      expect(rect.width).toBe(500)
      expect(rect.height).toBe(100)
      expect(rect.radius).toBe(12)
      // Position halved
      expect(rect.position![0].value.x).toBe(50) // was 100
      expect(rect.position![0].value.y).toBe(50) // was 100

      // Test text font scaling
      const textResolved = resolveTemplate(textFixture, {}, FORMAT_HD)
      const text = textResolved.layers.find(l => l.kind === 'text') as TextLayer
      expect(text.font.size).toBe(40) // was 80, halved

      // Opacity is NOT scaled
      expect(text.opacity![0].value).toBe(0)
      expect(text.opacity![1].value).toBe(1)
    })
  })

  // F3.6 - frame snap
  describe('F3.6 frame snap', () => {
    it('snaps t=0.517 and t=1.01 at 25fps to 0.52 and 1.0', () => {
      const template: MotionTemplate = {
        ...textFixture,
        params: {},
        layers: [
          {
            kind: 'rect',
            id: 'r1',
            anchor: { x: 0, y: 0 },
            width: 100,
            height: 100,
            fill: '#000',
            radius: 0,
            position: [
              { t: 0, value: { x: 0, y: 0 }, ease: [0, 0, 1, 1] },
              { t: 4, value: { x: 100, y: 100 } }
            ],
            opacity: [
              { t: 0.517, value: 0, ease: [0, 0, 1, 1] },
              { t: 1.01, value: 1 }
            ]
          }
        ]
      }
      const resolved = resolveTemplate(template, {}, FORMAT_HD)
      const layer = resolved.layers[0]
      // 0.517 * 25 = 12.925 -> round to 13 -> 13/25 = 0.52
      expect(layer.opacity![0].t).toBeCloseTo(0.52, 10)
      // 1.01 * 25 = 25.25 -> round to 25 -> 25/25 = 1.0
      expect(layer.opacity![1].t).toBeCloseTo(1.0, 10)
    })

    it('collapsing keyframes with equal values at 24fps are kept', () => {
      // Two keyframes that snap to the same frame but have equal values
      const template: MotionTemplate = {
        ...textFixture,
        params: {},
        layers: [
          {
            kind: 'rect',
            id: 'r1',
            anchor: { x: 0, y: 0 },
            width: 100,
            height: 100,
            fill: '#000',
            radius: 0,
            opacity: [
              // At 24fps: 0.020 * 24 = 0.48 -> round to 0
              // and 0.021 * 24 = 0.504 -> round to 1
              // But let's make them really collapse:
              // 0.020 * 24 = 0.48 -> round 0 -> t = 0
              // 0.021 * 24 = 0.504 -> round 1 -> t = 1/24
              // Actually to collapse: t1=1.00, t2=1.02
              // 1.00 * 24 = 24 -> 24/24 = 1.0
              // 1.02 * 24 = 24.48 -> 24/24 = 1.0
              { t: 1.0, value: 0.5, ease: [0, 0, 1, 1] },
              { t: 1.02, value: 0.5 } // same value -> OK
            ]
          }
        ]
      }
      const formats = validFormats(template)
      // Should include 24fps since values are equal
      const has24 = formats.some(f => f.fps === 24)
      expect(has24).toBe(true)
    })

    it('collapsing keyframes with different values at 24fps make the format invalid', () => {
      const template: MotionTemplate = {
        ...textFixture,
        params: {},
        layers: [
          {
            kind: 'rect',
            id: 'r1',
            anchor: { x: 0, y: 0 },
            width: 100,
            height: 100,
            fill: '#000',
            radius: 0,
            opacity: [
              // At 24fps these collapse to the same frame
              { t: 1.0, value: 0, ease: [0, 0, 1, 1] },
              { t: 1.02, value: 1 } // different value -> invalid at 24fps
            ]
          }
        ]
      }
      const formats = validFormats(template)
      // 24fps should be excluded
      const has24 = formats.some(f => f.fps === 24)
      expect(has24).toBe(false)
      // Higher fps values should still be valid
      const has50 = formats.some(f => f.fps === 50)
      expect(has50).toBe(true)
    })
  })

  // F3.7 - slug and export folder name
  describe('F3.7 slug and export folder name', () => {
    it('slugifies accented text correctly', () => {
      expect(slugify('Zoë Ångström - CEO, Ünïcode Ltd')).toBe(
        'zoe-angstrom-ceo-unicode-ltd'
      )
    })

    it('caps at 40 characters with no leading or trailing dash', () => {
      const long = 'a'.repeat(50)
      const slug = slugify(long)
      expect(slug.length).toBeLessThanOrEqual(40)
      expect(slug).not.toMatch(/^-/)
      expect(slug).not.toMatch(/-$/)
    })

    it('returns empty for emoji or RTL-only input', () => {
      expect(slugify('🎉🎉')).toBe('')
      expect(slugify('مرحبا')).toBe('')
    })

    it('builds the export folder name correctly', () => {
      expect(exportFolderName('lower-third-glide', 'jane-doe')).toBe(
        'lower-third-glide-jane-doe'
      )
      expect(exportFolderName('lower-third-glide', '')).toBe('lower-third-glide')
    })
  })

  // F3.8 - target derivation
  describe('F3.8 target derivation', () => {
    it('particles template derives video and prompt only', () => {
      const targets = deriveTargets(particlesFixture)
      expect(targets).toEqual(['video', 'prompt'])
    })

    it('non-particles template derives all five targets', () => {
      const targets = deriveTargets(textFixture)
      expect(targets).toEqual(['ae', 'resolve', 'mogrt-via-ae', 'video', 'prompt'])
    })
  })

  describe('stagger delay quantisation', () => {
    const staggerFixture: MotionTemplate = {
      schemaVersion: 1,
      id: 'fixture-stagger-clamp',
      version: '1.0.0',
      name: 'Stagger clamp',
      description: 'Test fixture',
      category: 'lower-third',
      status: 'stable',
      tags: [],
      fonts: ['CabritoSemi-NorBol'],
      duration: 4,
      inEnd: 0.7,
      outStart: 3.4,
      params: {
        name: {
          kind: 'text' as const,
          label: 'Name',
          maxLength: 40,
          default: 'Jo',
          required: true
        }
      },
      layers: [
        {
          kind: 'text' as const,
          id: 'title',
          anchor: { x: 0, y: 0 },
          position: [
            {
              t: 0,
              value: { x: 300, y: 500 },
              ease: [0.16, 1, 0.3, 1] as [number, number, number, number]
            },
            { t: 0.7, value: { x: 400, y: 500 } }
          ],
          text: 'Jo',
          param: 'name',
          font: { family: 'Cabrito Semi', style: 'Norm Bold', size: 60 },
          align: 'left' as const,
          lineHeight: 1.2,
          multiline: false,
          fill: '#ffffff',
          stagger: { delay: 0.03 },
          width: 1500
        }
      ]
    }

    it('short name (2 chars) rounds the authored delay to the nearest whole frame', () => {
      // "Jo" = 2 graphemes, n = max(1, 2-1) = 1
      // budget = 0.4 * 0.7 = 0.28, maxFrames = floor(0.28 * 50 / 1) = 14
      // authoredFrames = max(1, round(0.03 * 50)) = round(1.5) = 2
      // min(2, 14) = 2 frames, quantised = 2/50 = 0.04
      const resolved = resolveTemplate(staggerFixture, { name: 'Jo' }, FORMAT_4K)
      const textLayer = resolved.layers.find(l => l.kind === 'text') as TextLayer
      expect(textLayer.stagger!.delay).toBe(0.04)
    })

    it('long name (30 chars) drops stagger entirely when one frame per character exceeds budget', () => {
      // "A very long name that is exact" = 30 graphemes, n = 29
      // budget = 0.4 * 0.7 = 0.28, maxFrames = floor(0.28 * 50 / 29) = floor(0.483) = 0
      // maxFrames is 0, so stagger is dropped (undefined, not delay 0)
      // so exporters do not emit a follower with delay 0
      const longName = 'A very long name that is exact'
      const resolved = resolveTemplate(staggerFixture, { name: longName }, FORMAT_4K)
      const textLayer = resolved.layers.find(l => l.kind === 'text') as TextLayer
      expect(textLayer.stagger).toBeUndefined()
    })
  })
})

describe('particle region tints resolve to colours', () => {
  it('series marker keys that collapse at low fps are rejected after expansion', () => {
    // A series with segmentDuration=0.03 at 24fps: 0.03*24=0.72
    // keys at t=0, 0.03, 0.06 => frames 0, 0.72, 1.44 => snapped 1, 1, 1
    // Different values on the same frame should invalidate 24fps
    const seriesTemplate: MotionTemplate = {
      schemaVersion: 1,
      id: 'fixture-series-collapse',
      version: '1.0.0',
      name: 'Series collapse',
      description: '',
      category: 'data',
      status: 'stable',
      tags: [],
      fonts: [],
      duration: 4,
      inEnd: 1,
      outStart: 3,
      params: {
        data: {
          kind: 'numberList' as const,
          label: 'Data',
          default: [
            { label: 'A', value: 10 },
            { label: 'B', value: 90 },
            { label: 'C', value: 30 }
          ],
          valueMin: 0,
          valueMax: 100
        }
      },
      layers: [
        {
          kind: 'series' as const,
          id: 'chart',
          anchor: { x: 0, y: 0 },
          series: {
            param: 'data',
            area: { x: 400, y: 600, w: 2000, h: 800 },
            valueRange: [0, 100],
            dot: { radiusX: 20, radiusY: 20, fill: '#ff3366' },
            connector: { dotSpacing: 40, radius: 4, fill: '#ff336680' },
            label: {
              font: { family: 'Cabrito Semi', style: 'Norm Bold', size: 32 },
              fill: '#ffffff',
              align: 'center' as const,
              offsetY: 40
            },
            marker: {
              ellipse: { radiusX: 30, radiusY: 30, fill: '#ffffff' },
              segmentDuration: 0.03,
              ease: [0.16, 1, 0.3, 1] as [number, number, number, number]
            }
          }
        }
      ]
    }
    const formats = validFormats(seriesTemplate)
    // 24fps should be rejected because the marker keys collapse after expansion
    const has24 = formats.some(f => f.fps === 24)
    expect(has24).toBe(false)
  })

  it('stagger delay is quantised to whole frames at the chosen fps', () => {
    const staggerTemplate: MotionTemplate = {
      schemaVersion: 1,
      id: 'fixture-stagger-quant',
      version: '1.0.0',
      name: 'Stagger quantisation',
      description: '',
      category: 'lower-third',
      status: 'stable',
      tags: [],
      fonts: [],
      duration: 4,
      inEnd: 1,
      outStart: 3,
      params: {},
      layers: [
        {
          kind: 'text' as const,
          id: 'title',
          anchor: { x: 0, y: 0 },
          position: [{ t: 0, value: { x: 200, y: 500 } }],
          opacity: [
            {
              t: 0,
              value: 0,
              ease: [0.16, 1, 0.3, 1] as [number, number, number, number]
            },
            { t: 0.5, value: 1 }
          ],
          text: 'Hello',
          font: { family: 'Cabrito Semi', style: 'Norm Bold', size: 80 },
          align: 'left' as const,
          lineHeight: 1.2,
          multiline: false,
          fill: '#ffffff',
          stagger: { delay: 0.03 }
        }
      ]
    }
    // At 50fps, 0.03s = 1.5 frames, which rounds to 2 frames = 0.04s.
    // "Hello" = 5 chars, n=4, budget = 0.4*1 = 0.4, maxFrames = floor(0.4*50/4) = 5.
    // min(2, 5) = 2 frames, result = 0.04, a whole number of frames.
    const resolved = resolveTemplate(staggerTemplate, {}, FORMAT_4K)
    const textLayer = resolved.layers.find(l => l.kind === 'text') as TextLayer
    expect(textLayer.stagger).toBeDefined()
    expect(textLayer.stagger!.delay).toBe(0.04)
  })

  it('a region tint naming a colour param takes that param value; unknown names fall back to the base fill', () => {
    const template = {
      schemaVersion: 1 as const,
      id: 'region-tints',
      version: '1.0.0',
      name: 'Region tints',
      description: '',
      category: 'data' as const,
      status: 'experimental' as const,
      tags: [],
      fonts: [],
      duration: 1,
      inEnd: 0.5,
      outStart: 0.5,
      params: {
        bodyTint: {
          kind: 'colour' as const,
          label: 'Body',
          default: '#C8E64A',
          binds: []
        }
      },
      layers: [
        {
          kind: 'particles' as const,
          id: 'runner',
          anchor: { x: 0, y: 0 },
          points: [{ x: 10, y: 10, region: 'hips' }],
          seed: 1,
          assembleStart: 0,
          assembleEnd: 0.5,
          baseFill: '#E6E6E6',
          regionFills: { hips: 'bodyTint', feet: '#123456', head: 'noSuchParam' },
          pointRadius: 4
        }
      ]
    }
    const format = { width: 3840, height: 2160, fps: 25 } as const
    const layerOf = (values: Record<string, string>) => {
      const r = resolveTemplate(template, values, format)
      const l = r.layers[0]
      if (l.kind !== 'particles') throw new Error('expected particles')
      return l
    }
    expect(layerOf({}).regionFills).toEqual({
      hips: '#C8E64A',
      feet: '#123456',
      head: '#E6E6E6'
    })
    expect(layerOf({ bodyTint: '#FF0000' }).regionFills.hips).toBe('#FF0000')
  })
})

// ---------------------------------------------------------------------------
// stagger budget holds at every fps for every built-in
// ---------------------------------------------------------------------------

describe('stagger budget after quantisation', () => {
  it('stagger is dropped for a 31-char name at 50 fps (budget exceeded)', () => {
    const staggerFixture: MotionTemplate = {
      schemaVersion: 1,
      id: 'fixture-stagger-budget',
      version: '1.0.0',
      name: 'Stagger budget',
      description: 'Test fixture',
      category: 'lower-third',
      status: 'stable',
      tags: [],
      fonts: ['CabritoSemi-NorBol'],
      duration: 4,
      inEnd: 0.7,
      outStart: 3.4,
      params: {
        name: {
          kind: 'text' as const,
          label: 'Name',
          maxLength: 40,
          default: 'A very long name that is exact!',
          required: true
        }
      },
      layers: [
        {
          kind: 'text' as const,
          id: 'title',
          anchor: { x: 0, y: 0 },
          position: [{ t: 0, value: { x: 300, y: 500 } }],
          text: 'A very long name that is exact!',
          param: 'name',
          font: { family: 'Cabrito Semi', style: 'Norm Bold', size: 60 },
          align: 'left' as const,
          lineHeight: 1.2,
          multiline: false,
          fill: '#ffffff',
          stagger: { delay: 0.03 },
          width: 1500
        }
      ]
    }
    const format50: MotionFormat = { width: 3840, height: 2160, fps: 50 }
    const resolved = resolveTemplate(staggerFixture, {}, format50)
    const textLayer = resolved.layers.find(l => l.kind === 'text') as TextLayer
    // 31 chars, n = 30, budget = 0.4 * 0.7 = 0.28
    // maxFrames = floor(0.28 * 50 / 30 + 1e-9) = floor(0.467) = 0
    // Stagger is dropped entirely
    expect(textLayer.stagger).toBeUndefined()
  })

  it('every built-in satisfies budget at 24, 25 and 50 fps with default text', () => {
    const { templates: builtins } = loadBuiltins()
    const fpsValues = [24, 25, 50] as const

    for (const template of builtins as MotionTemplate[]) {
      for (const fps of fpsValues) {
        const format: MotionFormat = { width: 3840, height: 2160, fps }
        const resolved = resolveTemplate(template, {}, format)

        // Check every text layer with stagger
        const checkLayers = (layers: typeof resolved.layers) => {
          for (const layer of layers) {
            if (layer.kind === 'group') {
              checkLayers(layer.children as typeof resolved.layers)
              continue
            }
            if (layer.kind === 'text' && layer.stagger && layer.stagger.delay > 0) {
              const text = layer.text
              const charCount = Array.from(text).length
              const n = Math.max(1, charCount - 1)
              const totalStagger = n * layer.stagger.delay
              expect(
                totalStagger,
                `${template.id} at ${fps}fps: layer "${layer.id}" stagger total ${totalStagger.toFixed(4)}s > 40% of inEnd (${(0.4 * template.inEnd).toFixed(4)}s)`
              ).toBeLessThanOrEqual(0.4 * template.inEnd + 1e-9)
            }
          }
        }
        checkLayers(resolved.layers)
      }
    }
  })

  it('every built-in satisfies budget at 24, 25 and 50 fps with maxLength text', () => {
    const { templates: builtins2 } = loadBuiltins()
    const fpsValues = [24, 25, 50] as const

    for (const template of builtins2 as MotionTemplate[]) {
      // Find text params and set them to maxLength
      const maxValues: Record<string, string> = {}
      for (const [id, def] of Object.entries(template.params)) {
        if (def.kind === 'text') {
          maxValues[id] = 'X'.repeat(def.maxLength)
        }
      }
      if (Object.keys(maxValues).length === 0) continue

      for (const fps of fpsValues) {
        const format: MotionFormat = { width: 3840, height: 2160, fps }
        const resolved = resolveTemplate(template, maxValues, format)

        const checkLayers = (layers: typeof resolved.layers) => {
          for (const layer of layers) {
            if (layer.kind === 'group') {
              checkLayers(layer.children as typeof resolved.layers)
              continue
            }
            if (layer.kind === 'text' && layer.stagger && layer.stagger.delay > 0) {
              const text = layer.text
              const charCount = Array.from(text).length
              const n = Math.max(1, charCount - 1)
              const totalStagger = n * layer.stagger.delay
              expect(
                totalStagger,
                `${template.id} at ${fps}fps maxLength: layer "${layer.id}" stagger total ${totalStagger.toFixed(4)}s > 40% of inEnd (${(0.4 * template.inEnd).toFixed(4)}s)`
              ).toBeLessThanOrEqual(0.4 * template.inEnd + 1e-9)
            }
          }
        }
        checkLayers(resolved.layers)
      }
    }
  })
})

// ---------------------------------------------------------------------------
// resolveTemplate fills an explicit position track when absent
// ---------------------------------------------------------------------------

describe('explicit position track', () => {
  it('layer without position gets a single key at the origin after resolve', () => {
    const template: MotionTemplate = {
      ...textFixture,
      params: {},
      layers: [
        {
          kind: 'rect',
          id: 'no-pos',
          anchor: { x: 100, y: 50 },
          // no position field
          width: 200,
          height: 100,
          fill: '#000000',
          radius: 0
        }
      ]
    }
    const resolved = resolveTemplate(template, {}, FORMAT_4K)
    const layer = resolved.layers[0]
    expect(layer.position).toBeDefined()
    expect(layer.position!.length).toBe(1)
    expect(layer.position![0].value).toEqual({ x: 0, y: 0 })
  })
})

// ---------------------------------------------------------------------------
// getHoldParam helper
// ---------------------------------------------------------------------------

describe('getHoldParam', () => {
  it('returns null when no hold param exists', () => {
    expect(getHoldParam(textFixture)).toBeNull()
  })

  it('returns the hold param entry when one exists', () => {
    const result = getHoldParam(holdParamFixture)
    expect(result).not.toBeNull()
    expect(result!.id).toBe('hold')
    expect(result!.def.kind).toBe('hold')
  })
})

// ---------------------------------------------------------------------------
// depth-2 colour bind: resolve colours the right nested layer
// ---------------------------------------------------------------------------

describe('depth-2 colour bind resolved to the correct layer', () => {
  it('a colour param bound to layers[0].children[0].children[0] colours the leaf', () => {
    const template: MotionTemplate = {
      schemaVersion: 1,
      id: 'fixture-depth-2-bind',
      version: '1.0.0',
      name: 'Depth 2 bind',
      description: '',
      category: 'lower-third',
      status: 'stable',
      tags: [],
      fonts: [],
      duration: 4,
      inEnd: 1,
      outStart: 3,
      params: {
        accent: {
          kind: 'colour' as const,
          label: 'Accent',
          default: '#ff3366',
          binds: ['layers[0].children[0].children[0]']
        }
      },
      layers: [
        {
          kind: 'group' as const,
          id: 'outer',
          anchor: { x: 0, y: 0 },
          children: [
            {
              kind: 'group' as const,
              id: 'inner',
              anchor: { x: 0, y: 0 },
              children: [
                {
                  kind: 'rect' as const,
                  id: 'leaf',
                  anchor: { x: 0, y: 0 },
                  width: 100,
                  height: 100,
                  fill: '#000000',
                  radius: 0
                }
              ]
            }
          ]
        }
      ]
    }
    const resolved = resolveTemplate(template, { accent: '#00ff00' }, FORMAT_4K)
    // Walk into the nested structure
    const outer = resolved.layers[0]
    expect(outer.kind).toBe('group')
    if (outer.kind !== 'group') return
    const inner = outer.children[0]
    expect(inner.kind).toBe('group')
    if (inner.kind !== 'group') return
    const leaf = inner.children[0]
    expect(leaf.kind).toBe('rect')
    if (leaf.kind === 'rect') {
      expect(leaf.fill).toBe('#00ff00')
    }
  })
})

// ---------------------------------------------------------------------------
// W2, W3, W4: wrap wiring through the resolve pipeline
// ---------------------------------------------------------------------------

describe('W2 wrap in resolver', () => {
  /** A template with a wrap-enabled text layer. */
  const wrapFixture: MotionTemplate = {
    schemaVersion: 1,
    id: 'fixture-wrap',
    version: '1.0.0',
    name: 'Wrap test',
    description: 'Test fixture for wrapping',
    category: 'title-card',
    status: 'stable',
    tags: ['test'],
    fonts: ['CabritoSemi-NorBol'],
    duration: 4,
    inEnd: 1,
    outStart: 3,
    params: {
      quote: {
        kind: 'text',
        label: 'Quote',
        maxLength: 120,
        default: 'Short text that fits',
        required: true
      }
    },
    layers: [
      {
        kind: 'text',
        id: 'quote-text',
        anchor: { x: 0, y: 0 },
        position: [{ t: 0, value: { x: 1920, y: 1000 } }],
        opacity: [
          { t: 0, value: 0, ease: [0.16, 1, 0.3, 1] },
          { t: 0.6, value: 1 }
        ],
        text: 'Short text that fits',
        param: 'quote',
        font: { family: 'Cabrito Semi', style: 'Norm Bold', size: 88 },
        align: 'center',
        lineHeight: 1.4,
        multiline: true,
        fill: '#ffffff',
        width: 3400,
        wrap: true,
        maxLines: 3
      }
    ]
  }

  it('W2.7 break positions are identical at 3840x2160 and 1920x1080', () => {
    // A text that wraps: 20 chars x 88 x 0.6 = 1056, fits in 3400.
    // Use a text that triggers wrapping: chars x size x 0.6 > width
    // 3400 / (88 * 0.6) = ~64 chars per line
    const longText = 'The quick brown fox jumps over the lazy dog and then runs away fast'
    const r4k = resolveTemplate(wrapFixture, { quote: longText }, FORMAT_4K)
    const rHd = resolveTemplate(wrapFixture, { quote: longText }, FORMAT_HD)
    const text4k = (r4k.layers.find(l => l.id === 'quote-text') as TextLayer).text
    const textHd = (rHd.layers.find(l => l.id === 'quote-text') as TextLayer).text
    expect(text4k).toBe(textHd)
  })

  it('W2.8 ResolvedTemplate.values keeps the typed value, not the wrapped text', () => {
    const longText = 'The quick brown fox jumps over the lazy dog and then runs away fast'
    const resolved = resolveTemplate(wrapFixture, { quote: longText }, FORMAT_4K)
    expect(resolved.values.quote).toBe(longText)
  })

  it('W2.6 layer without wrap is never changed, even when it overflows', () => {
    const noWrap: MotionTemplate = {
      ...wrapFixture,
      id: 'fixture-no-wrap',
      layers: [
        {
          ...wrapFixture.layers[0],
          wrap: undefined,
          maxLines: undefined
        } as TextLayer
      ]
    }
    const longText = 'x'.repeat(200)
    const resolved = resolveTemplate(noWrap, { quote: longText }, FORMAT_4K)
    const text = (resolved.layers.find(l => l.id === 'quote-text') as TextLayer).text
    expect(text).toBe(longText)
  })
})

describe('W4 validateParams line-count errors', () => {
  const wrapTemplate: MotionTemplate = {
    schemaVersion: 1,
    id: 'wrap-validate',
    version: '1.0.0',
    name: 'Wrap validate',
    description: 'Test',
    category: 'title-card',
    status: 'stable',
    tags: [],
    fonts: [],
    duration: 4,
    inEnd: 1,
    outStart: 3,
    params: {
      quote: {
        kind: 'text',
        label: 'Quote',
        maxLength: 120,
        default: 'Test',
        required: true
      }
    },
    layers: [
      {
        kind: 'text',
        id: 'txt',
        anchor: { x: 0, y: 0 },
        text: 'Test',
        param: 'quote',
        font: { family: 'Cabrito Semi', style: 'Norm Bold', size: 88 },
        align: 'center',
        lineHeight: 1.4,
        multiline: true,
        fill: '#ffffff',
        width: 3400,
        wrap: true,
        maxLines: 3
      }
    ]
  }

  it('W4.1 value that wraps to maxLines + 1 produces a line-count error', () => {
    // At the approximation (chars * 88 * 0.6 = chars * 52.8), width 3400
    // fits ~64 chars per line. 3 lines = ~192 chars, so 200 chars = 4 lines
    const longText = 'word '.repeat(40).trim() // 40 words, ~200 chars
    const errors = validateParams(wrapTemplate, { quote: longText })
    const lineError = errors.find(
      e => e.paramId === 'quote' && e.message.includes('lines')
    )
    expect(lineError).toBeDefined()
  })

  it('W4.2 value shortened to fit clears the error', () => {
    const shortText = 'Short text'
    const errors = validateParams(wrapTemplate, { quote: shortText })
    const lineError = errors.find(
      e => e.paramId === 'quote' && e.message.includes('lines')
    )
    expect(lineError).toBeUndefined()
  })
})

describe('stagger stays visible when the budget allows a frame', () => {
  it('a sub-frame authored delay rounds to at least one frame when the budget has room (Glide name at 25 fps)', () => {
    // 25 ms at 25 fps is 0.625 of a frame. Flooring it to 0 would switch the
    // stagger off at the UK house rate even though "Jane Doe" fits one frame
    // per character inside 40% of a 0.7 s entrance (7 x 0.04 = 0.28 s).
    const glide = loadBuiltins().templates.find(t => t.id === 'lower-third-glide')!
    const resolved = resolveTemplate(glide, {}, { width: 3840, height: 2160, fps: 25 })
    const name = resolved.layers.find(l => l.id === 'name-text')
    expect(name?.kind === 'text' && name.stagger?.delay).toBeCloseTo(0.04, 10)
  })
})
