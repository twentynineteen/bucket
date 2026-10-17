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
 * Wrap text for a text layer with `wrap: true`.
 *
 * Splits on typed \n first, then wraps each segment independently.
 * Returns the wrapped text with \n at every break point.
 */
export function wrapText(
  _text: string,
  _width: number,
  _font: { family: string; size: number },
  _measurer: TextMeasurer
): string {
  throw new Error('not implemented')
}

/**
 * Count the number of lines in wrapped text.
 */
export function countLines(text: string): number {
  if (text === '') return 1
  return text.split('\n').length
}
