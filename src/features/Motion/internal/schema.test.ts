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
              fill: '#000'
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
              fill: '#000',
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
              fill: '#fff',
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
              fill: '#fff',
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
            fill: '#fff',
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
})
