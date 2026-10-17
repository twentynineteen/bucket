/**
 * Expansion tests (F2.1-F2.6)
 *
 * Tests for macro-layer expansion: series, arc sweepFromParam and formatCounter.
 */
import { describe, expect, it } from 'vitest'
import type {
  ArcLayer,
  EllipseLayer,
  NumberListItem,
  PathLayer,
  TextLayer
} from '../types'
import { expandTemplate, formatCounter } from './expand'
import { arcFixture, seriesFixture } from './testing/fixtures'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Series data shared by multiple tests
// ---------------------------------------------------------------------------

const seriesItems: NumberListItem[] = [
  { label: 'Jan', value: 10 },
  { label: 'Feb', value: 50 },
  { label: 'Mar', value: 30 }
]

const seriesValues = { data: seriesItems }
const seriesParams = seriesFixture.params

describe('Expansion (internal/expand.ts)', () => {
  // F2.1 - series over [10, 50, 30] produces 3 dot ellipses at expected positions
  describe('F2.1 series expansion', () => {
    it('produces 3 dot ellipses at expected positions and labels, no series remains', () => {
      const result = expandTemplate(seriesFixture.layers, seriesParams, seriesValues)

      // No series layer remains
      expect(result.every(l => l.kind !== 'series')).toBe(true)

      // 3 dot ellipses
      const dots = result.filter(
        l => l.kind === 'ellipse' && l.id.includes('-dot-')
      ) as EllipseLayer[]
      expect(dots).toHaveLength(3)

      // Area: x=400, y=600, w=2000, h=800, valueRange [0, 100]
      // Point 0: x = 400, y = 600 + 800*(1 - 10/100) = 600 + 720 = 1320
      // Point 1: x = 400 + (1/2)*2000 = 1400, y = 600 + 800*(1 - 50/100) = 1000
      // Point 2: x = 400 + (2/2)*2000 = 2400, y = 600 + 800*(1 - 30/100) = 1040
      expect(dots[0].position![0].value).toEqual({ x: 400, y: 1320 })
      expect(dots[1].position![0].value).toEqual({ x: 1400, y: 1000 })
      expect(dots[2].position![0].value).toEqual({ x: 2400, y: 1160 })

      // 3 labels carrying the item labels
      const labels = result.filter(
        l => l.kind === 'text' && l.id.includes('-label-')
      ) as TextLayer[]
      expect(labels).toHaveLength(3)
      expect(labels[0].text).toBe('Jan')
      expect(labels[1].text).toBe('Feb')
      expect(labels[2].text).toBe('Mar')
    })
  })

  // F2.2 - connector dots between adjacent points
  it('F2.2 connector dots are produced between each pair, no strokes', () => {
    const result = expandTemplate(seriesFixture.layers, seriesParams, seriesValues)

    const connectors = result.filter(l => l.kind === 'ellipse' && l.id.includes('-conn-'))

    // Between 3 points there are 2 segments, each with some connector dots
    expect(connectors.length).toBeGreaterThan(0)

    // No layer has a stroke property (all ellipses are filled)
    for (const c of connectors) {
      expect(c).not.toHaveProperty('stroke')
      expect(c).not.toHaveProperty('strokeWidth')
    }
  })

  // F2.3 - marker with segmentDuration and ease
  it('F2.3 marker has position keyframes 0.4s apart with the marker ease', () => {
    const result = expandTemplate(seriesFixture.layers, seriesParams, seriesValues)

    const marker = result.find(l => l.kind === 'ellipse' && l.id.includes('-marker'))
    expect(marker).toBeDefined()
    expect(marker!.position).toBeDefined()
    expect(marker!.position).toHaveLength(3) // one per data point

    // Check times are 0.4s apart
    expect(marker!.position![0].t).toBe(0)
    expect(marker!.position![1].t).toBeCloseTo(0.4, 10)
    expect(marker!.position![2].t).toBeCloseTo(0.8, 10)

    // First two carry the ease, last omits it
    expect(marker!.position![0].ease).toEqual([0.16, 1, 0.3, 1])
    expect(marker!.position![1].ease).toEqual([0.16, 1, 0.3, 1])
    expect(marker!.position![2].ease).toBeUndefined()
  })

  // F2.4 - band/hatch
  describe('F2.4 hatch band', () => {
    it('with no fromIndex/toIndex and 4 points, hatch spans last two points', () => {
      const fourItems: NumberListItem[] = [
        { label: 'A', value: 10 },
        { label: 'B', value: 50 },
        { label: 'C', value: 30 },
        { label: 'D', value: 70 }
      ]
      const result = expandTemplate(seriesFixture.layers, seriesParams, {
        data: fourItems
      })

      const hatchPaths = result.filter(
        l => l.kind === 'path' && l.id.includes('-hatch-')
      ) as PathLayer[]
      expect(hatchPaths.length).toBeGreaterThan(0)

      // All hatch paths are closed (end with Z) and filled
      for (const p of hatchPaths) {
        expect(p.d).toMatch(/Z$/)
        expect(p.fill).toBeDefined()
      }

      // Hatch vertices should lie within the band rectangle spanning points 3 and 4
      // Area: x=400, y=600, w=2000, h=800, valueRange [0,100]
      // Point 2 (index 2): x = 400 + (2/3)*2000 = ~1733
      // Point 3 (index 3): x = 400 + (3/3)*2000 = 2400
      // The default band spans last two points (indices 2 and 3)
      const leftX = 400 + (2 / 3) * 2000
      const rightX = 2400

      // Extract numeric x values from the first hatch path d string
      const coords = hatchPaths[0].d.match(/-?\d+(\.\d+)?/g)!.map(Number)
      // Every x coordinate (even indices in the M/L pairs) should be >= leftX and <= rightX
      for (let i = 0; i < coords.length; i += 2) {
        expect(coords[i]).toBeGreaterThanOrEqual(leftX - 1)
        expect(coords[i]).toBeLessThanOrEqual(rightX + 1)
      }
    })

    it('stripes are parallel: every edge follows the hatch angle or lies on the band border', () => {
      const fourItems: NumberListItem[] = [
        { label: 'A', value: 10 },
        { label: 'B', value: 50 },
        { label: 'C', value: 30 },
        { label: 'D', value: 70 }
      ]
      const result = expandTemplate(seriesFixture.layers, seriesParams, {
        data: fourItems
      })
      const hatchPaths = result.filter(
        l => l.kind === 'path' && l.id.includes('-hatch-')
      ) as PathLayer[]
      expect(hatchPaths.length).toBeGreaterThan(2)

      // Band spans points 2 and 3: x 1733..2400, y between their values.
      const leftX = 400 + (2 / 3) * 2000
      const rightX = 2400
      const yOf = (v: number) => 600 + 800 - (v / 100) * 800
      const top = Math.min(yOf(30), yOf(70))
      const bottom = Math.max(yOf(30), yOf(70))
      const onBorder = (a: number[], b: number[]) =>
        (Math.abs(a[0] - b[0]) < 0.5 &&
          (Math.abs(a[0] - leftX) < 0.5 || Math.abs(a[0] - rightX) < 0.5)) ||
        (Math.abs(a[1] - b[1]) < 0.5 &&
          (Math.abs(a[1] - top) < 0.5 || Math.abs(a[1] - bottom) < 0.5))
      const hatchAngle = Math.PI / 4
      const parallel = (a: number[], b: number[]) => {
        const ang = Math.atan2(b[1] - a[1], b[0] - a[0])
        const diff = Math.abs(Math.sin(ang - hatchAngle))
        return diff < Math.sin((1 * Math.PI) / 180)
      }

      for (const p of hatchPaths) {
        const nums = p.d.match(/-?\d+(\.\d+)?/g)!.map(Number)
        const pts: number[][] = []
        for (let i = 0; i < nums.length; i += 2) pts.push([nums[i], nums[i + 1]])
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i]
          const b = pts[(i + 1) % pts.length]
          if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.5) continue
          expect(
            parallel(a, b) || onBorder(a, b),
            `${p.id} edge ${JSON.stringify(a)}->${JSON.stringify(b)}`
          ).toBe(true)
        }
      }
    })

    it('with 1 point or no band spec, no hatch paths are produced', () => {
      const oneItem: NumberListItem[] = [{ label: 'A', value: 10 }]
      const result = expandTemplate(seriesFixture.layers, seriesParams, { data: oneItem })

      const hatchPaths = result.filter(l => l.kind === 'path' && l.id.includes('-hatch-'))
      expect(hatchPaths).toHaveLength(0)
    })
  })

  // F2.5 - arc sweepFromParam
  it('F2.5 arc sweepFromParam with value 72 and max 100 sets final sweep to 0.72', () => {
    const result = expandTemplate(arcFixture.layers, arcFixture.params, { score: 72 })

    const arc = result.find(l => l.kind === 'arc') as ArcLayer
    expect(arc).toBeDefined()

    // sweepFromParam should be removed after expansion
    expect(arc.sweepFromParam).toBeUndefined()

    // The final sweep keyframe should be 0.72
    const lastSweep = arc.sweep[arc.sweep.length - 1]
    expect(lastSweep.value).toBeCloseTo(0.72, 10)

    // Earlier keyframes unchanged
    expect(arc.sweep[0].value).toBe(0)
  })

  // F2.6 - formatCounter
  describe('F2.6 formatCounter', () => {
    it('formats at progress 0.5 with value 72 as 36%', () => {
      expect(formatCounter(0.5, 72, 0, '', '%')).toBe('36%')
    })

    it('formats at progress 1 with value 72 as 72%', () => {
      expect(formatCounter(1, 72, 0, '', '%')).toBe('72%')
    })

    it('formats at progress 0.5 with decimals 1 and prefix as GBP36.0', () => {
      expect(formatCounter(0.5, 72, 1, '£', '')).toBe('£36.0')
    })
  })
})
