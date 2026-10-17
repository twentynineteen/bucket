/**
 * svgGeometry tests - shared SVG helpers used by preview and renderer
 */
import { describe, expect, it } from 'vitest'
import { arcPath, matrixStr } from './svgGeometry'

describe('matrixStr', () => {
  it('formats a 2D affine matrix as an SVG attribute value', () => {
    expect(matrixStr([1, 0, 0, 1, 100, 200])).toBe('matrix(1 0 0 1 100 200)')
  })

  it('preserves decimal values', () => {
    expect(matrixStr([0.5, 0.1, -0.1, 0.5, 300.25, 400.75])).toBe(
      'matrix(0.5 0.1 -0.1 0.5 300.25 400.75)'
    )
  })
})

describe('arcPath', () => {
  it('returns empty for zero sweep', () => {
    expect(arcPath(0, 0, 100, 200, 0, 0)).toBe('')
  })

  it('returns empty for negative sweep', () => {
    expect(arcPath(0, 0, 100, 200, 0, -0.5)).toBe('')
  })

  it('produces a closed path with M, A, L, A, Z for a quarter turn', () => {
    const d = arcPath(0, 0, 100, 200, 0, 0.25)
    expect(d).toContain('M ')
    expect(d).toContain('A ')
    expect(d).toContain('L ')
    expect(d).toContain(' Z')
    // Quarter turn: largeArc should be 0
    expect(d).toMatch(/A \d+ \d+ 0 0 1/)
  })

  it('uses large-arc flag for sweeps over half a turn', () => {
    const d = arcPath(0, 0, 100, 200, 0, 0.75)
    expect(d).toMatch(/A \d+ \d+ 0 1 1/)
  })

  it('is deterministic for the same inputs', () => {
    const a = arcPath(100, 200, 50, 80, 45, 0.3)
    const b = arcPath(100, 200, 50, 80, 45, 0.3)
    expect(a).toBe(b)
  })
})
