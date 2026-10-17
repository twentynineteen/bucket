/**
 * Resolve module tests (F3.1-F3.8)
 *
 * Tests for param resolution, validation, hold shift, format scaling,
 * frame snap, slug, target derivation and per-fps validity.
 */
import { describe, expect, it } from 'vitest'
import type { MotionFormat, MotionTemplate, RectLayer, TextLayer } from '../types'
import {
  deriveTargets,
  exportFolderName,
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

  // S3.3 stagger clamp (added by #332)
  describe('stagger delay clamping', () => {
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

    it('short name (2 chars) keeps the template delay unclamped but quantises to frames', () => {
      // "Jo" = 2 graphemes, budget = 0.4 * 0.7 / max(1, 2-1) = 0.28
      // Template delay 0.03 < 0.28, so it stays before quantisation
      // At 50fps: 0.03 * 50 = 1.5 frames -> round to 2 -> 2/50 = 0.04
      const resolved = resolveTemplate(staggerFixture, { name: 'Jo' }, FORMAT_4K)
      const textLayer = resolved.layers.find(l => l.kind === 'text') as TextLayer
      expect(textLayer.stagger!.delay).toBe(0.04)
    })

    it('long name (30 chars) clamps the delay to fit the budget then quantises', () => {
      // "A very long name that is exact" = 30 graphemes
      // budget = 0.4 * 0.7 / max(1, 30-1) = 0.28 / 29 ~= 0.00966
      // Template delay 0.03 > 0.00966, so it clamps to ~0.00966
      // At 50fps: 0.00966 * 50 = 0.483 frames -> round to 1 -> 1/50 = 0.02
      const longName = 'A very long name that is exact'
      const resolved = resolveTemplate(staggerFixture, { name: longName }, FORMAT_4K)
      const textLayer = resolved.layers.find(l => l.kind === 'text') as TextLayer
      expect(textLayer.stagger!.delay).toBe(0.02)
      expect(textLayer.stagger!.delay).toBeLessThan(0.03)
    })
  })
})

describe('particle region tints resolve to colours', () => {
  // S11 - validFormats must check expanded, hold-shifted layers
  it('S11 series marker keys that collapse at low fps are rejected after expansion', () => {
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

  // A1 - stagger delays quantised to whole frames
  it('A1 stagger delay is quantised to whole frames at the chosen fps', () => {
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
    // At 50fps, 0.03s = 1.5 frames. Should round to 2 frames = 0.04s
    const resolved = resolveTemplate(staggerTemplate, {}, FORMAT_4K)
    const textLayer = resolved.layers.find(l => l.kind === 'text') as TextLayer
    expect(textLayer.stagger).toBeDefined()
    // 0.03 * 50 = 1.5 => round to 2 => 2/50 = 0.04
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
