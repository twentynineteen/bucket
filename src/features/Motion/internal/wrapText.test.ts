/**
 * wrapText tests (issue #348)
 *
 * Pure breaking logic with a stub measurer (10 units per character).
 * Behaviours W2.1-W2.5.
 */
import { describe, expect, it } from 'vitest'
import type { TextMeasurer } from './textOverflow'
import { countLines, wrapText } from './wrapText'

/** Stub measurer: each character is 10 units wide. */
function charMeasurer(charWidth = 10): TextMeasurer {
  return {
    measure(text: string): number {
      return text.length * charWidth
    }
  }
}

const font = { family: 'Test', size: 80 }

describe('wrapText', () => {
  it('W2.1 wraps "aaaa bbbb cccc" at width 100 (10/char)', () => {
    // "aaaa bbbb" = 9 chars = 90 fits, "aaaa bbbb cccc" = 14 chars = 140 does not
    const result = wrapText('aaaa bbbb cccc', 100, font, charMeasurer())
    expect(result).toBe('aaaa bbbb\ncccc')
  })

  it('W2.2 typed \\n is a hard break, each line wraps independently', () => {
    // "aaaa bbbb\ncccc dddd" - each part is 9 chars, fits at width 100
    const result = wrapText('aaaa bbbb\ncccc dddd', 100, font, charMeasurer())
    expect(result).toBe('aaaa bbbb\ncccc dddd')
  })

  it('W2.2 wrapping within a typed line preserves the typed break', () => {
    // "aaaa bbbb cccc\ndddd" - first segment wraps, typed break stays
    const result = wrapText('aaaa bbbb cccc\ndddd', 100, font, charMeasurer())
    expect(result).toBe('aaaa bbbb\ncccc\ndddd')
  })

  it('W2.3 single word wider than width is broken between graphemes', () => {
    // "aaaaaaaaaaaa" = 12 chars = 120, width 100, so must break
    const result = wrapText('aaaaaaaaaaaa', 100, font, charMeasurer())
    expect(result).toContain('\n')
    // Each piece must fit within 100 = 10 chars max
    const lines = result.split('\n')
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(10)
      expect(line.length).toBeGreaterThan(0)
    }
  })

  it('W2.3 emoji is never split', () => {
    // An emoji sequence (flag, ZWJ) should stay as one unit
    const measurer: TextMeasurer = {
      measure(text: string): number {
        // Use grapheme-aware measurement
        const graphemes =
          typeof Intl !== 'undefined' && 'Segmenter' in Intl
            ? Array.from(
                new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text),
                s => s.segment
              )
            : Array.from(text)
        return graphemes.length * 50
      }
    }
    // Each emoji is 50 wide; width 80 fits one but not two
    const result = wrapText('\u{1F389}\u{1F389}\u{1F389}', 80, font, measurer)
    // Each line should contain only whole emoji
    const lines = result.split('\n')
    for (const line of lines) {
      // No surrogate pair should be split
      expect(line).not.toMatch(/[\uD800-\uDBFF]$/)
    }
  })

  it('W2.4 text that fits on one line is unchanged', () => {
    const result = wrapText('aaaa', 100, font, charMeasurer())
    expect(result).toBe('aaaa')
  })

  it('W2.4 empty text is unchanged', () => {
    const result = wrapText('', 100, font, charMeasurer())
    expect(result).toBe('')
  })

  it('W2.4 text of only spaces is unchanged', () => {
    const result = wrapText('   ', 100, font, charMeasurer())
    expect(result).toBe('   ')
  })

  it('W2.5 break inside a run of spaces: no trailing or leading spaces', () => {
    // "aaaa    bbbb" = 12 chars = 120, width 100
    // Should break as "aaaa" + "bbbb" (spaces removed)
    const result = wrapText('aaaa    bbbb cccc', 100, font, charMeasurer())
    const lines = result.split('\n')
    for (const line of lines) {
      expect(line).not.toMatch(/^ /)
      expect(line).not.toMatch(/ $/)
    }
  })

  it('wraps three words into three lines when each word + space exceeds width', () => {
    // "aaaaaa bbbbb ccccc" with width 70 (7 chars)
    const result = wrapText('aaaaaa bbbbb ccccc', 70, font, charMeasurer())
    expect(countLines(result)).toBe(3)
  })
})

describe('wrapText balancing (W2.9)', () => {
  it('W2.9 evens out lines instead of leaving a short tail', () => {
    // Greedy at 140 gives "aaaa bbbb cccc" / "dd". Balanced keeps two lines
    // at the narrowest width that still fits them (90): "aaaa bbbb" / "cccc dd".
    const result = wrapText('aaaa bbbb cccc dd', 140, font, charMeasurer())
    expect(result).toBe('aaaa bbbb\ncccc dd')
  })

  it('W2.9 never adds a line or splits a word to balance', () => {
    // Widest word is 10 chars (100); balancing must not go below it.
    const result = wrapText('aaaaaaaaaa b c', 120, font, charMeasurer())
    expect(result.split('\n')).toHaveLength(2)
    expect(result.split('\n')[0]).toBe('aaaaaaaaaa')
  })

  it('W2.9 balances each typed line on its own', () => {
    const result = wrapText('aaaa bbbb cccc dd\nee', 140, font, charMeasurer())
    expect(result).toBe('aaaa bbbb\ncccc dd\nee')
  })
})

describe('countLines', () => {
  it('single line', () => {
    expect(countLines('hello')).toBe(1)
  })

  it('empty string', () => {
    expect(countLines('')).toBe(1)
  })

  it('two lines', () => {
    expect(countLines('hello\nworld')).toBe(2)
  })

  it('three lines', () => {
    expect(countLines('a\nb\nc')).toBe(3)
  })
})
