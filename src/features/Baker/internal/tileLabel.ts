/**
 * Fits a project name into a storage-map tile.
 *
 * The rule, in order: break only between words; when the name does not all
 * fit, end on a complete word followed by an ellipsis; cut inside a word only
 * when that single word is wider than the tile, because a named tile is worth
 * more than an anonymous one. Widths come from a measuring function so the
 * result matches what the browser will draw, and so the logic can be tested
 * without one.
 */

/** Rendered width of a string, in the same unit as `maxWidth`. */
export type Measure = (text: string) => number

const ELLIPSIS = '…'
const LONE_DASH = /^[-–]$/
const TRAILING_DASH = /\s[-–]$/

/** Words of a name, with a lone dash kept on the word before it. */
function toWords(name: string): string[] {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .reduce<string[]>((words, word) => {
      if (LONE_DASH.test(word) && words.length > 0) words[words.length - 1] += ` ${word}`
      else words.push(word)
      return words
    }, [])
}

/** The longest prefix of one word that fits with an ellipsis after it. */
function cutWord(word: string, maxWidth: number, measure: Measure): string {
  let prefix = word
  while (prefix.length > 1 && measure(prefix + ELLIPSIS) > maxWidth) {
    prefix = prefix.slice(0, -1)
  }
  return measure(prefix + ELLIPSIS) <= maxWidth ? prefix + ELLIPSIS : ''
}

/**
 * A line shortened, whole words at a time, until an ellipsis fits after it.
 * Null when not even its first word leaves room for the ellipsis.
 */
function endWithEllipsis(
  line: string,
  maxWidth: number,
  measure: Measure
): string | null {
  let words = line.replace(TRAILING_DASH, '').split(' ')
  while (words.length > 1 && measure(words.join(' ') + ELLIPSIS) > maxWidth) {
    words = words.slice(0, -1)
    if (LONE_DASH.test(words[words.length - 1])) words = words.slice(0, -1)
  }
  const text = words.join(' ')
  return measure(text + ELLIPSIS) <= maxWidth ? text + ELLIPSIS : null
}

/**
 * Mark placed lines as cut short. The ellipsis goes after the last whole word
 * that leaves room for it, which can mean giving up the last line; only a
 * single remaining line is ever cut inside a word.
 */
function truncate(lines: string[], maxWidth: number, measure: Measure): string[] {
  const kept = [...lines]
  while (kept.length > 0) {
    const ended = endWithEllipsis(kept[kept.length - 1], maxWidth, measure)
    if (ended !== null) {
      kept[kept.length - 1] = ended
      return kept
    }
    if (kept.length === 1) {
      const cut = cutWord(kept[0].split(' ')[0], maxWidth, measure)
      return cut ? [cut] : []
    }
    kept.pop()
  }
  return kept
}

/**
 * Lines of `name` for a tile `maxWidth` wide with room for `maxLines` lines.
 * Returns an empty array when nothing legible fits.
 */
export function fitTileName(
  name: string,
  maxWidth: number,
  maxLines: number,
  measure: Measure
): string[] {
  const words = toWords(name)
  const lines: string[] = []
  let next = 0

  while (next < words.length && lines.length < maxLines) {
    const word = words[next]

    if (measure(word) > maxWidth) {
      // A word wider than the tile. With text already placed, stop there on a
      // whole word; with none, a cut word is the only way to name the tile.
      if (lines.length === 0) {
        const cut = cutWord(word, maxWidth, measure)
        return cut ? [cut] : []
      }
      return truncate(lines, maxWidth, measure)
    }

    let line = word
    next += 1
    while (next < words.length && measure(`${line} ${words[next]}`) <= maxWidth) {
      line = `${line} ${words[next]}`
      next += 1
    }
    lines.push(line)
  }

  return next < words.length ? truncate(lines, maxWidth, measure) : lines
}
