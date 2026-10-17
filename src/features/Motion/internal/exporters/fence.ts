/**
 * Fence utility (issue #331)
 *
 * Creates a Markdown fenced code block whose fence is longer than the longest
 * backtick run in the content, so the fence is never closed early.
 */

/**
 * Find the length of the longest consecutive backtick run in `text`.
 * Returns 0 when the text contains no backticks.
 */
function longestBacktickRun(text: string): number {
  let max = 0
  let current = 0
  for (const ch of text) {
    if (ch === '`') {
      current++
      if (current > max) max = current
    } else {
      current = 0
    }
  }
  return max
}

/**
 * Wrap `content` in a fenced code block with the given language tag.
 * The fence length is always at least 3 and always longer than the longest
 * backtick run inside the content.
 */
export function fence(lang: string, content: string): string {
  const minFence = 3
  const longest = longestBacktickRun(content)
  const fenceLen = longest >= minFence ? longest + 1 : minFence
  const ticks = '`'.repeat(fenceLen)
  return `${ticks}${lang}\n${content}\n${ticks}`
}
