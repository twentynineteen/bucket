/**
 * Greedy line wrapping for text layers (issue #348)
 *
 * Breaks text at word boundaries so each line fits within a given width,
 * measured by an injected measurer. The measurer measures whole strings
 * (not sums of words), so kerning is included.
 *
 * Rules:
 * - A typed \n is always a hard break. Wrapping applies within each line.
 * - At a break, the first space becomes \n. Further spaces in that run
 *   are removed, so no line starts or ends with a space.
 * - A single word wider than width is broken between graphemes.
 * - Empty text, or text of only spaces, is returned unchanged.
 * - There is no hyphenation and no balancing; wrapping is greedy.
 */

import type { TextMeasurer } from './textOverflow'

/**
 * Split text into grapheme clusters using Intl.Segmenter.
 * Falls back to Array.from if Segmenter is unavailable.
 */
function segmentGraphemes(text: string): string[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    return Array.from(segmenter.segment(text), s => s.segment)
  }
  return Array.from(text)
}

/**
 * Break a single word (no spaces) that is wider than `width` between
 * graphemes so each piece fits. Returns the pieces joined by \n.
 */
function breakLongWord(
  word: string,
  width: number,
  font: { family: string; size: number },
  measurer: TextMeasurer
): string[] {
  const graphemes = segmentGraphemes(word)
  const pieces: string[] = []
  let current = ''

  for (const g of graphemes) {
    const candidate = current + g
    if (current !== '' && measurer.measure(candidate, font) > width) {
      pieces.push(current)
      current = g
    } else {
      current = candidate
    }
  }
  if (current !== '') {
    pieces.push(current)
  }
  return pieces
}

/**
 * Wrap a single typed line (no \n in it) to fit within `width`.
 * Returns an array of output lines.
 */
function wrapSingleLine(
  line: string,
  width: number,
  font: { family: string; size: number },
  measurer: TextMeasurer
): string[] {
  // Empty line or only spaces: return as-is
  if (line === '' || /^\s+$/.test(line)) return [line]

  // Split into words on space boundaries, keeping runs of spaces
  // as separate "words" so we can handle them at breaks
  const tokens: string[] = []
  let i = 0
  while (i < line.length) {
    if (line[i] === ' ') {
      let j = i
      while (j < line.length && line[j] === ' ') j++
      tokens.push(line.slice(i, j))
      i = j
    } else {
      let j = i
      while (j < line.length && line[j] !== ' ') j++
      tokens.push(line.slice(i, j))
      i = j
    }
  }

  const result: string[] = []
  let currentLine = ''

  for (const token of tokens) {
    // Skip space tokens at the start of a new line
    if (currentLine === '' && /^\s+$/.test(token)) continue

    const candidate = currentLine + token
    const candidateWidth = measurer.measure(candidate, font)

    if (candidateWidth <= width) {
      currentLine = candidate
    } else {
      // Token does not fit on current line
      if (/^\s+$/.test(token)) {
        // It is a space run - just break here, don't add the spaces
        if (currentLine !== '') {
          result.push(currentLine)
          currentLine = ''
        }
      } else {
        // It is a word
        if (currentLine !== '') {
          // Trim trailing spaces from the current line
          result.push(currentLine.replace(/ +$/, ''))
          currentLine = ''
        }
        // Check if this word fits alone on a line
        if (measurer.measure(token, font) <= width) {
          currentLine = token
        } else {
          // Word is wider than width - break between graphemes
          const pieces = breakLongWord(token, width, font, measurer)
          // Add all pieces except the last as separate lines
          for (let p = 0; p < pieces.length - 1; p++) {
            result.push(pieces[p])
          }
          currentLine = pieces[pieces.length - 1]
        }
      }
    }
  }

  if (currentLine !== '') {
    result.push(currentLine.replace(/ +$/, ''))
  }

  return result.length > 0 ? result : ['']
}

/**
 * Wrap text for a text layer with `wrap: true`.
 *
 * Splits on typed \n first, then wraps each segment independently.
 * Returns the wrapped text with \n at every break point.
 */
export function wrapText(
  text: string,
  width: number,
  font: { family: string; size: number },
  measurer: TextMeasurer
): string {
  // Empty text or only spaces: return unchanged
  if (text === '' || /^\s+$/.test(text)) return text

  // Split on typed \n, wrap each independently, rejoin
  const typedLines = text.split('\n')
  const outputLines: string[] = []
  for (const typedLine of typedLines) {
    const wrapped = wrapSingleLine(typedLine, width, font, measurer)
    outputLines.push(...wrapped)
  }
  return outputLines.join('\n')
}

/**
 * Count the number of lines in wrapped text.
 */
export function countLines(text: string): number {
  if (text === '') return 1
  return text.split('\n').length
}
