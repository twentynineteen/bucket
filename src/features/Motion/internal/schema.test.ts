/**
 * Schema tests (F1.1-F1.4)
 *
 * Tests for the zod-based template parser. Each behaviour from issue #327
 * maps to one or more test cases.
 */
import { describe, expect, it } from 'vitest'
import { parseTemplate } from './schema'
import {
  arcFixture,
  colourParamFixture,
  counterFixture,
  ellipseFixture,
  groupFixture,
  holdParamFixture,
  imageParamFixture,
  numberListParamFixture,
  numberParamFixture,
  particlesFixture,
  pathFixture,
  rectFixture,
  seriesFixture,
  textFixture,
  textParamFixture
} from './testing/fixtures'

describe('Schema (internal/schema.ts)', () => {
  // F1.1 - every fixture template parses successfully
  describe('F1.1 fixture templates parse successfully', () => {
    it.each([
      ['textFixture', textFixture],
      ['rectFixture', rectFixture],
      ['ellipseFixture', ellipseFixture],
      ['pathFixture', pathFixture],
      ['arcFixture', arcFixture],
      ['groupFixture', groupFixture],
      ['particlesFixture', particlesFixture],
      ['seriesFixture', seriesFixture],
      ['counterFixture', counterFixture],
      ['textParamFixture', textParamFixture],
      ['colourParamFixture', colourParamFixture],
      ['holdParamFixture', holdParamFixture],
      ['numberListParamFixture', numberListParamFixture],
      ['numberParamFixture', numberParamFixture],
      ['imageParamFixture', imageParamFixture]
    ])('%s parses successfully', (_name, fixture) => {
      const result = parseTemplate(fixture)
      expect(result.success).toBe(true)
    })
  })

  // F1.2 - schemaVersion 2 rejected
  it('F1.2 rejects schemaVersion 2 with unsupported schemaVersion message', () => {
    const bad = { ...textFixture, schemaVersion: 2 }
    const result = parseTemplate(bad)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('unsupported schemaVersion')
    }
  })

  // F1.3 - each defect is caught
  describe('F1.3 schema defects', () => {
    it.each([
      ['inEnd > outStart', { ...textFixture, inEnd: 4, outStart: 3 }],
      ['non-kebab id', { ...textFixture, id: 'FixtureText' }],
      ['non-semver version', { ...textFixture, version: 'notSemver' }],
      ['invalid category', { ...textFixture, category: 'invalid' }],
      ['invalid status', { ...textFixture, status: 'invalid' }],
      [
        'colour param bound to animated fill',
        {
          ...textFixture,
          params: {
            accent: {
              kind: 'colour',
              label: 'Accent',
              default: '#ff0000',
              binds: ['layers[0]']
            }
          },
          layers: [
            {
              kind: 'rect',
              id: 'rect-1',
              anchor: { x: 0, y: 0 },
              width: 100,
              height: 100,
              fill: '#ff0000',
              radius: 0,
              fillAnimation: [
                { t: 0, value: '#ff0000', ease: [0, 0, 1, 1] },
                { t: 1, value: '#0000ff' }
              ]
            }
          ]
        }
      ],
      [
        'open path (no Z)',
        {
          ...textFixture,
          params: {},
          layers: [
            {
              kind: 'path',
              id: 'p1',
              anchor: { x: 0, y: 0 },
              d: 'M 0 0 L 100 0 L 100 100',
              fill: '#000000'
            }
          ]
        }
      ],
      [
        'stagger on non-text layer',
        {
          ...textFixture,
          params: {},
          layers: [
            {
              kind: 'rect',
              id: 'r1',
              anchor: { x: 0, y: 0 },
              width: 100,
              height: 100,
              fill: '#000000',
              radius: 0,
              stagger: { delay: 0.1 }
            }
          ]
        }
      ],
      [
        'numberList with > 8 default items',
        {
          ...textFixture,
          params: {
            data: {
              kind: 'numberList',
              label: 'Data',
              default: Array.from({ length: 9 }, (_, i) => ({
                label: `${i}`,
                value: i
              })),
              valueMin: 0,
              valueMax: 100
            }
          }
        }
      ],
      [
        'image param without particles layer',
        {
          ...textFixture,
          params: {
            ...textFixture.params,
            img: { kind: 'image', label: 'Image' }
          }
        }
      ],
      [
        'primaryTextParam naming non-text param',
        {
          ...textFixture,
          params: {
            score: {
              kind: 'number',
              label: 'Score',
              default: 50,
              min: 0,
              max: 100
            }
          },
          primaryTextParam: 'score'
        }
      ],
      [
        'ease x1 outside [0,1]',
        {
          ...textFixture,
          params: {},
          layers: [
            {
              kind: 'text',
              id: 't1',
              anchor: { x: 0, y: 0 },
              text: 'Hi',
              font: { family: 'Arial', style: 'Bold', size: 72 },
              align: 'center',
              lineHeight: 1.2,
              multiline: false,
              fill: '#ffffff',
              opacity: [
                { t: 0, value: 0, ease: [-0.1, 1, 0.3, 1] },
                { t: 1, value: 1 }
              ]
            }
          ]
        }
      ],
      [
        'series param not a numberList',
        {
          ...seriesFixture,
          params: {
            data: {
              kind: 'number',
              label: 'Data',
              default: 50,
              min: 0,
              max: 100
            }
          }
        }
      ],
      [
        'counter param not a number',
        {
          ...counterFixture,
          params: {
            value: {
              kind: 'text',
              label: 'Score',
              maxLength: 10,
              default: '72',
              required: false
            }
          }
        }
      ],
      [
        'sweepFromParam param not a number',
        {
          ...textFixture,
          params: {
            score: {
              kind: 'text',
              label: 'Score',
              maxLength: 10,
              default: '72',
              required: false
            }
          },
          layers: [
            {
              kind: 'arc',
              id: 'a1',
              anchor: { x: 0, y: 0 },
              innerRadius: 400,
              outerRadius: 480,
              fill: '#ffffff',
              sweep: [
                { t: 0, value: 0, ease: [0, 0, 1, 1] },
                { t: 1, value: 1 }
              ],
              startAngle: [{ t: 0, value: 0 }],
              sweepFromParam: { param: 'score', max: 100 }
            }
          ]
        }
      ]
    ])('rejects %s', (_label, template) => {
      const result = parseTemplate(template)
      expect(result.success).toBe(false)
    })

    // S12 - path d restricted to M/L/H/V/Z
    it('rejects path d with curve commands (C, A, Q, S, T)', () => {
      const bad = {
        ...rectFixture,
        layers: [
          {
            kind: 'path',
            id: 'p1',
            anchor: { x: 0, y: 0 },
            d: 'M 0 0 C 10 20 30 40 50 60 Z',
            fill: '#000000'
          }
        ]
      }
      const result = parseTemplate(bad)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('d')
      }
    })

    // S12 - path d with relative commands rejected
    it('rejects path d with relative commands (m, l)', () => {
      const bad = {
        ...rectFixture,
        layers: [
          {
            kind: 'path',
            id: 'p1',
            anchor: { x: 0, y: 0 },
            d: 'm 0 0 l 100 0 l 0 100 z',
            fill: '#000000'
          }
        ]
      }
      const result = parseTemplate(bad)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('d')
      }
    })

    // S14 - fill fields validated as hex
    it('rejects non-hex fill on a rect layer', () => {
      const bad = {
        ...rectFixture,
        layers: [
          {
            kind: 'rect',
            id: 'r1',
            anchor: { x: 0, y: 0 },
            width: 100,
            height: 100,
            fill: 'red',
            radius: 0
          }
        ]
      }
      const result = parseTemplate(bad)
      expect(result.success).toBe(false)
    })

    // S14 - fillAnimation values validated as hex
    it('rejects non-hex fillAnimation values', () => {
      const bad = {
        ...rectFixture,
        layers: [
          {
            kind: 'rect',
            id: 'r1',
            anchor: { x: 0, y: 0 },
            width: 100,
            height: 100,
            fill: '#ff0000',
            radius: 0,
            fillAnimation: [
              { t: 0, value: 'not-a-hex', ease: [0, 0, 1, 1] },
              { t: 1, value: '#0000ff' }
            ]
          }
        ]
      }
      const result = parseTemplate(bad)
      expect(result.success).toBe(false)
    })

    // S14 - baseFill validated as hex
    it('rejects non-hex baseFill on particles layer', () => {
      const bad = {
        ...rectFixture,
        params: {
          image: { kind: 'image', label: 'Source image' }
        },
        layers: [
          {
            kind: 'particles',
            id: 'scatter',
            anchor: { x: 0, y: 0 },
            points: [{ x: 100, y: 200 }],
            seed: 42,
            assembleStart: 0,
            assembleEnd: 1,
            baseFill: 'invalid-colour',
            regionFills: {},
            pointRadius: 4
          }
        ]
      }
      const result = parseTemplate(bad)
      expect(result.success).toBe(false)
    })

    // S13 - hold param is the single source (no template.hold)
    it('accepts a template with a hold param but no top-level hold block', () => {
      const template = {
        ...rectFixture,
        params: {
          hold: {
            kind: 'hold',
            label: 'Hold duration',
            min: 1,
            max: 10,
            default: 3
          }
        }
      }
      const result = parseTemplate(template)
      expect(result.success).toBe(true)
    })

    // S13 - hold range refinement: hold delta must not push outStart before inEnd
    it('rejects hold param whose min pushes outStart before inEnd', () => {
      // inEnd=1, outStart=3, hold default=3
      // With hold min=0, delta = 0 - 3 = -3, outStart = 3 + (-3) = 0 < inEnd=1
      const bad = {
        ...rectFixture,
        inEnd: 1,
        outStart: 3,
        duration: 4,
        params: {
          hold: {
            kind: 'hold',
            label: 'Hold',
            min: 0,
            max: 10,
            default: 3
          }
        }
      }
      const result = parseTemplate(bad)
      expect(result.success).toBe(false)
    })

    it('allows inEnd == outStart (equal passes)', () => {
      const equal = { ...textFixture, inEnd: 2, outStart: 2, duration: 4 }
      const result = parseTemplate(equal)
      expect(result.success).toBe(true)
    })
  })

  // F1.4 - keyframe ease rules
  describe('F1.4 keyframe ease rules', () => {
    it('allows last keyframe to omit ease', () => {
      // textFixture already has this pattern (opacity ends without ease)
      const result = parseTemplate(textFixture)
      expect(result.success).toBe(true)
    })

    it('rejects non-last keyframe without ease', () => {
      const bad = {
        ...textFixture,
        params: {},
        layers: [
          {
            kind: 'text',
            id: 't1',
            anchor: { x: 0, y: 0 },
            text: 'Hi',
            font: { family: 'Arial', style: 'Bold', size: 72 },
            align: 'center',
            lineHeight: 1.2,
            multiline: false,
            fill: '#ffffff',
            opacity: [
              { t: 0, value: 0 }, // MISSING ease on non-last
              { t: 0.5, value: 0.5, ease: [0, 0, 1, 1] },
              { t: 1, value: 1 }
            ]
          }
        ]
      }
      const result = parseTemplate(bad)
      expect(result.success).toBe(false)
    })
  })

  // Sk8/Mi1 - restrict path d to M/L/Z only (no H/V)
  describe('Sk8 path d restricted to M/L/Z', () => {
    it('rejects path d with H command', () => {
      const bad = {
        ...rectFixture,
        layers: [
          {
            kind: 'path',
            id: 'p1',
            anchor: { x: 0, y: 0 },
            d: 'M 0 0 L 100 0 H 100 Z',
            fill: '#000000'
          }
        ]
      }
      const result = parseTemplate(bad)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('d')
      }
    })

    it('rejects path d with V command', () => {
      const bad = {
        ...rectFixture,
        layers: [
          {
            kind: 'path',
            id: 'p1',
            anchor: { x: 0, y: 0 },
            d: 'M 0 0 V 100 L 100 100 Z',
            fill: '#000000'
          }
        ]
      }
      const result = parseTemplate(bad)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('d')
      }
    })

    it('accepts path d with only M/L/Z', () => {
      const good = {
        ...rectFixture,
        layers: [
          {
            kind: 'path',
            id: 'p1',
            anchor: { x: 0, y: 0 },
            d: 'M 0 0 L 100 0 L 100 100 L 0 100 Z',
            fill: '#000000'
          }
        ]
      }
      const result = parseTemplate(good)
      expect(result.success).toBe(true)
    })
  })

  // Ar4 - validate bind targets against the layer tree
  describe('Ar4 colour bind target validation', () => {
    it('rejects a bind path that does not resolve to a layer', () => {
      const bad = {
        ...rectFixture,
        params: {
          accent: {
            kind: 'colour',
            label: 'Accent',
            default: '#ff3366',
            binds: ['layers[99]']
          }
        }
      }
      const result = parseTemplate(bad)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('does not resolve')
      }
    })

    it('rejects a bind path targeting a group layer', () => {
      const bad = {
        ...rectFixture,
        params: {
          accent: {
            kind: 'colour',
            label: 'Accent',
            default: '#ff3366',
            binds: ['layers[0]']
          }
        },
        layers: [
          {
            kind: 'group',
            id: 'grp',
            anchor: { x: 0, y: 0 },
            children: [
              {
                kind: 'rect',
                id: 'child',
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
      const result = parseTemplate(bad)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('not a fill-bearing primitive')
      }
    })

    it('rejects a bind path targeting a particles layer', () => {
      const bad = {
        ...rectFixture,
        params: {
          accent: {
            kind: 'colour',
            label: 'Accent',
            default: '#ff3366',
            binds: ['layers[0]']
          },
          image: { kind: 'image', label: 'Source' }
        },
        layers: [
          {
            kind: 'particles',
            id: 'scatter',
            anchor: { x: 0, y: 0 },
            points: [{ x: 10, y: 10 }],
            seed: 1,
            assembleStart: 0,
            assembleEnd: 1,
            baseFill: '#888888',
            regionFills: {},
            pointRadius: 4
          }
        ]
      }
      const result = parseTemplate(bad)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('not a fill-bearing primitive')
      }
    })

    it('accepts a bind path targeting a rect layer', () => {
      const result = parseTemplate(colourParamFixture)
      expect(result.success).toBe(true)
    })
  })

  // Ar6 - particle layers must come after all vector layers
  describe('Ar6 particles last in paint order', () => {
    it('rejects particles layer before a vector layer', () => {
      const bad = {
        ...rectFixture,
        params: {
          image: { kind: 'image', label: 'Source' }
        },
        layers: [
          {
            kind: 'particles',
            id: 'scatter',
            anchor: { x: 0, y: 0 },
            points: [{ x: 10, y: 10 }],
            seed: 1,
            assembleStart: 0,
            assembleEnd: 1,
            baseFill: '#888888',
            regionFills: {},
            pointRadius: 4
          },
          {
            kind: 'rect',
            id: 'overlay',
            anchor: { x: 0, y: 0 },
            width: 100,
            height: 100,
            fill: '#000000',
            radius: 0
          }
        ]
      }
      const result = parseTemplate(bad)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('particle layers must come after')
      }
    })

    it('accepts particles layer at the end', () => {
      const good = {
        ...rectFixture,
        params: {
          image: { kind: 'image', label: 'Source' }
        },
        layers: [
          {
            kind: 'rect',
            id: 'bg',
            anchor: { x: 0, y: 0 },
            width: 100,
            height: 100,
            fill: '#000000',
            radius: 0
          },
          {
            kind: 'particles',
            id: 'scatter',
            anchor: { x: 0, y: 0 },
            points: [{ x: 10, y: 10 }],
            seed: 1,
            assembleStart: 0,
            assembleEnd: 1,
            baseFill: '#888888',
            regionFills: {},
            pointRadius: 4
          }
        ]
      }
      const result = parseTemplate(good)
      expect(result.success).toBe(true)
    })
  })

  // Ar8 - at most one hold param, min <= default <= max
  describe('Ar8 hold param constraints', () => {
    it('rejects two hold params', () => {
      const bad = {
        ...rectFixture,
        params: {
          hold1: { kind: 'hold', label: 'Hold 1', min: 1, max: 5, default: 2 },
          hold2: { kind: 'hold', label: 'Hold 2', min: 1, max: 5, default: 3 }
        }
      }
      const result = parseTemplate(bad)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('at most one hold param')
      }
    })

    it('rejects hold param where default < min', () => {
      const bad = {
        ...rectFixture,
        inEnd: 0.5,
        outStart: 3,
        params: {
          hold: { kind: 'hold', label: 'Hold', min: 3, max: 10, default: 2 }
        }
      }
      const result = parseTemplate(bad)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('min <= default <= max')
      }
    })

    it('rejects hold param where default > max', () => {
      const bad = {
        ...rectFixture,
        params: {
          hold: { kind: 'hold', label: 'Hold', min: 1, max: 5, default: 7 }
        }
      }
      const result = parseTemplate(bad)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('min <= default <= max')
      }
    })
  })

  // Ar10 - stagger + fillAnimation on text layer rejected
  describe('Ar10 stagger + fillAnimation rejected', () => {
    it('rejects text layer with both stagger and fillAnimation', () => {
      const bad = {
        ...rectFixture,
        params: {},
        layers: [
          {
            kind: 'text',
            id: 't1',
            anchor: { x: 0, y: 0 },
            text: 'Hello',
            font: { family: 'Cabrito Semi', style: 'Norm Bold', size: 80 },
            align: 'left',
            lineHeight: 1.2,
            multiline: false,
            fill: '#ffffff',
            stagger: { delay: 0.02 },
            fillAnimation: [
              { t: 0, value: '#ff0000', ease: [0, 0, 1, 1] },
              { t: 1, value: '#0000ff' }
            ]
          }
        ]
      }
      const result = parseTemplate(bad)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('stagger and fillAnimation cannot be combined')
      }
    })

    it('accepts text layer with stagger but no fillAnimation', () => {
      const good = {
        ...rectFixture,
        params: {},
        layers: [
          {
            kind: 'text',
            id: 't1',
            anchor: { x: 0, y: 0 },
            text: 'Hello',
            font: { family: 'Cabrito Semi', style: 'Norm Bold', size: 80 },
            align: 'left',
            lineHeight: 1.2,
            multiline: false,
            fill: '#ffffff',
            stagger: { delay: 0.02 }
          }
        ]
      }
      const result = parseTemplate(good)
      expect(result.success).toBe(true)
    })
  })
})
