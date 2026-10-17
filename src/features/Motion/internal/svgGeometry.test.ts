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

  it('produces a closed path for a quarter turn with correct geometry', () => {
    const d = arcPath(0, 0, 100, 200, 0, 0.25)
    // A quarter turn from 12 o'clock (startAngle=0) to 3 o'clock.
    // Compute expected values from the same formula:
    const startRad = -Math.PI / 2
    const endRad = 0
    const expected = [
      `M ${200 * Math.cos(startRad)} ${200 * Math.sin(startRad)}`,
      `A 200 200 0 0 1 ${200 * Math.cos(endRad)} ${200 * Math.sin(endRad)}`,
      `L ${100 * Math.cos(endRad)} ${100 * Math.sin(endRad)}`,
      `A 100 100 0 0 0 ${100 * Math.cos(startRad)} ${100 * Math.sin(startRad)}`,
      'Z'
    ].join(' ')
    expect(d).toBe(expected)
  })

  it('uses large-arc flag for sweeps over half a turn', () => {
    const d = arcPath(0, 0, 100, 200, 0, 0.75)
    expect(d).toMatch(/A \d+ \d+ 0 1 1/)
  })
})
