/**
 * Text overflow tests (issue #337)
 *
 * M3.1: Given a measurer reporting 1,250 px for a text box 1,200 px wide,
 * when checked, then the layer is reported as overflowing (at 1,200 px it
 * is not).
 */
import { describe, expect, it } from 'vitest'
import { checkTextOverflow, type TextMeasurer } from './textOverflow'

function stubMeasurer(widthMap: Record<string, number>): TextMeasurer {
  return {
    measure(text: string) {
      return widthMap[text] ?? 0
    }
  }
}

describe('checkTextOverflow', () => {
  it('M3.1 - reports overflow when measured width exceeds box width', () => {
    const layers = [
      {
        kind: 'text' as const,
        id: 'title',
        text: 'A long name here',
        font: { family: 'Cabrito Semi', size: 80 },
        width: 1200
      }
    ]
    const measurer = stubMeasurer({ 'A long name here': 1250 })

    const results = checkTextOverflow(layers, measurer)
    expect(results).toHaveLength(1)
    expect(results[0].overflowing).toBe(true)
    expect(results[0].measuredWidth).toBe(1250)
    expect(results[0].boxWidth).toBe(1200)
  })

  it('M3.1 - reports not overflowing when measured width equals box width', () => {
    const layers = [
      {
        kind: 'text' as const,
        id: 'title',
        text: 'Exact fit',
        font: { family: 'Cabrito Semi', size: 80 },
        width: 1200
      }
    ]
    const measurer = stubMeasurer({ 'Exact fit': 1200 })

    const results = checkTextOverflow(layers, measurer)
    expect(results).toHaveLength(1)
    expect(results[0].overflowing).toBe(false)
  })

  it('skips text layers without a width property', () => {
    const layers = [
      {
        kind: 'text' as const,
        id: 'no-box',
        text: 'Free text',
        font: { family: 'Cabrito Semi', size: 80 }
      }
    ]
    const measurer = stubMeasurer({ 'Free text': 9999 })

    const results = checkTextOverflow(layers, measurer)
    expect(results).toHaveLength(0)
  })

  it('skips non-text layers', () => {
    const layers = [
      {
        kind: 'rect' as const,
        id: 'bg',
        text: '',
        font: { family: 'Cabrito Semi', size: 80 },
        width: 100
      }
    ]
    const measurer = stubMeasurer({})

    const results = checkTextOverflow(layers, measurer)
    expect(results).toHaveLength(0)
  })

  it('W4.3 multiline text: overflow measures the widest line, not the whole string', () => {
    const layers = [
      {
        kind: 'text' as const,
        id: 'multi',
        text: 'Short\nA very long line here',
        font: { family: 'Cabrito Semi', size: 80 },
        width: 1200
      }
    ]
    // Measurer returns different widths per line vs the whole string
    const measurer: TextMeasurer = {
      measure(text: string): number {
        if (text === 'Short') return 400
        if (text === 'A very long line here') return 1600
        return 2000 // whole string - old code would use this
      }
    }

    const results = checkTextOverflow(layers, measurer)
    expect(results).toHaveLength(1)
    // Should report the widest LINE (1600), not the whole string (2000)
    expect(results[0].measuredWidth).toBe(1600)
    expect(results[0].overflowing).toBe(true)
  })
})
