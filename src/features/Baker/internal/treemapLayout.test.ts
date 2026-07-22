/**
 * Treemap Layout Tests
 *
 * The layout is pure math, so these tests verify the geometric invariants:
 * full tiling of the bounding box, area proportional to weight, no overlaps,
 * and graceful handling of degenerate inputs.
 */

import { describe, expect, it } from 'vitest'

import { computeTreemapLayout } from './treemapLayout'
import type { TreemapItem, TreemapRect } from './treemapLayout'

const area = (r: TreemapRect) => r.width * r.height

const rectsOverlap = (a: TreemapRect, b: TreemapRect) => {
  const epsilon = 1e-6
  return (
    a.x + a.width > b.x + epsilon &&
    b.x + b.width > a.x + epsilon &&
    a.y + a.height > b.y + epsilon &&
    b.y + b.height > a.y + epsilon
  )
}

describe('computeTreemapLayout', () => {
  it('tiles the bounding box completely (areas sum to width*height)', () => {
    const items: TreemapItem[] = [
      { key: 'a', weight: 6 },
      { key: 'b', weight: 6 },
      { key: 'c', weight: 4 },
      { key: 'd', weight: 3 },
      { key: 'e', weight: 2 },
      { key: 'f', weight: 2 },
      { key: 'g', weight: 1 }
    ]
    const rects = computeTreemapLayout(items, 600, 400)
    const total = rects.reduce((acc, r) => acc + area(r), 0)
    expect(total).toBeCloseTo(600 * 400, 4)
  })

  it('gives each item area proportional to its weight', () => {
    const items: TreemapItem[] = [
      { key: 'big', weight: 300 },
      { key: 'medium', weight: 100 },
      { key: 'small', weight: 50 }
    ]
    const rects = computeTreemapLayout(items, 450, 200)
    const totalArea = 450 * 200
    const totalWeight = 450

    for (const item of items) {
      const rect = rects.find((r) => r.key === item.key)!
      expect(area(rect)).toBeCloseTo((item.weight / totalWeight) * totalArea, 4)
    }
  })

  it('produces no overlapping rectangles', () => {
    const items: TreemapItem[] = Array.from({ length: 12 }, (_, i) => ({
      key: `p${i}`,
      weight: (i + 1) * 7
    })).reverse()
    const rects = computeTreemapLayout(items, 800, 500)
    const positive = rects.filter((r) => area(r) > 0)

    for (let i = 0; i < positive.length; i++) {
      for (let j = i + 1; j < positive.length; j++) {
        expect(
          rectsOverlap(positive[i], positive[j]),
          `${positive[i].key} overlaps ${positive[j].key}`
        ).toBe(false)
      }
    }
  })

  it('keeps every rectangle inside the bounding box', () => {
    const items: TreemapItem[] = [
      { key: 'a', weight: 10 },
      { key: 'b', weight: 5 },
      { key: 'c', weight: 1 }
    ]
    const rects = computeTreemapLayout(items, 300, 300)
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(-1e-6)
      expect(r.y).toBeGreaterThanOrEqual(-1e-6)
      expect(r.x + r.width).toBeLessThanOrEqual(300 + 1e-6)
      expect(r.y + r.height).toBeLessThanOrEqual(300 + 1e-6)
    }
  })

  it('preserves input ordering in the output', () => {
    const items: TreemapItem[] = [
      { key: 'first', weight: 1 },
      { key: 'second', weight: 100 },
      { key: 'third', weight: 10 }
    ]
    const rects = computeTreemapLayout(items, 100, 100)
    expect(rects.map((r) => r.key)).toEqual(['first', 'second', 'third'])
  })

  it('returns zero-area rects for zero and negative weights', () => {
    const items: TreemapItem[] = [
      { key: 'real', weight: 42 },
      { key: 'empty', weight: 0 },
      { key: 'negative', weight: -5 }
    ]
    const rects = computeTreemapLayout(items, 200, 100)
    expect(area(rects.find((r) => r.key === 'real')!)).toBeCloseTo(200 * 100, 4)
    expect(area(rects.find((r) => r.key === 'empty')!)).toBe(0)
    expect(area(rects.find((r) => r.key === 'negative')!)).toBe(0)
  })

  it('handles an empty item list', () => {
    expect(computeTreemapLayout([], 100, 100)).toEqual([])
  })

  it('handles all-zero weights without dividing by zero', () => {
    const items: TreemapItem[] = [
      { key: 'a', weight: 0 },
      { key: 'b', weight: 0 }
    ]
    const rects = computeTreemapLayout(items, 100, 100)
    expect(rects.every((r) => area(r) === 0)).toBe(true)
  })

  it('handles a degenerate bounding box', () => {
    const items: TreemapItem[] = [{ key: 'a', weight: 10 }]
    const rects = computeTreemapLayout(items, 0, 100)
    expect(area(rects[0])).toBe(0)
  })

  it('keeps aspect ratios reasonable for similar weights', () => {
    const items: TreemapItem[] = Array.from({ length: 9 }, (_, i) => ({
      key: `p${i}`,
      weight: 100 + i
    }))
    const rects = computeTreemapLayout(items, 600, 600)
    for (const r of rects) {
      const ratio = Math.max(r.width / r.height, r.height / r.width)
      // Squarified layouts of near-equal weights should stay well under 3:1.
      expect(ratio).toBeLessThan(3)
    }
  })
})
