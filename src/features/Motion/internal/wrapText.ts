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
 * - Lines are balanced: greedy wrapping sets the line count, then the
 *   narrowest width that keeps that count is used, so a paragraph does not
 *   end on a short tail (the same idea as CSS `text-wrap: balance`). The
 *   width never goes below the widest word, so balancing never splits one.
 * - There is no hyphenation.
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
 * Tokenise a line into alternating word and space-run tokens.
 */
function tokenise(line: string): string[] {
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
  return tokens
}

/** Whether a string is only spaces. */
function isSpaceRun(s: string): boolean {
  return /^\s+$/.test(s)
}

/** Handle a word that does not fit on the current line. */
function handleOverflowWord(
  token: string,
  width: number,
  font: { family: string; size: number },
  measurer: TextMeasurer,
  result: string[]
): string {
  if (measurer.measure(token, font) <= width) {
    return token
  }
  // Word is wider than width - break between graphemes
  const pieces = breakLongWord(token, width, font, measurer)
  for (let p = 0; p < pieces.length - 1; p++) {
    result.push(pieces[p])
  }
  return pieces[pieces.length - 1]
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
  if (line === '' || isSpaceRun(line)) return [line]

  const tokens = tokenise(line)
  const result: string[] = []
  let currentLine = ''

  for (const token of tokens) {
    if (currentLine === '' && isSpaceRun(token)) continue

    const candidateWidth = measurer.measure(currentLine + token, font)
    if (candidateWidth <= width) {
      currentLine += token
      continue
    }

    // Token does not fit on current line
    if (isSpaceRun(token)) {
      if (currentLine !== '') {
        result.push(currentLine)
        currentLine = ''
      }
    } else {
      if (currentLine !== '') {
        result.push(currentLine.replace(/ +$/, ''))
        currentLine = ''
      }
      currentLine = handleOverflowWord(token, width, font, measurer, result)
    }
  }

  if (currentLine !== '') {
    result.push(currentLine.replace(/ +$/, ''))
  }

  return result.length > 0 ? result : ['']
}

/**
 * Wrap one typed line, then narrow the width as far as the greedy line
 * count allows so the lines come out even.
 */
function balanceSingleLine(
  line: string,
  width: number,
  font: { family: string; size: number },
  measurer: TextMeasurer
): string[] {
  const greedy = wrapSingleLine(line, width, font, measurer)
  if (greedy.length < 2) return greedy

  const widestWord = Math.max(
    ...tokenise(line)
      .filter(t => !isSpaceRun(t))
      .map(t => measurer.measure(t, font))
  )
  // A word wider than the box is split by greedy wrapping; balancing below
  // its width would change those splits, so leave such lines greedy.
  if (widestWord > width) return greedy

  let lo = widestWord
  let hi = width
  let best = greedy
  for (let i = 0; i < 20 && hi - lo > 0.5; i++) {
    const mid = (lo + hi) / 2
    const candidate = wrapSingleLine(line, mid, font, measurer)
    if (candidate.length === greedy.length) {
      best = candidate
      hi = mid
    } else {
      lo = mid
    }
  }
  const atFloor = wrapSingleLine(line, lo, font, measurer)
  return atFloor.length === greedy.length ? atFloor : best
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
    const wrapped = balanceSingleLine(typedLine, width, font, measurer)
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
