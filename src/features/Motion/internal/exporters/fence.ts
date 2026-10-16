/**
 * Fence utility (issue #331)
 *
 * Creates a Markdown fenced code block whose fence is longer than the longest
 * backtick run in the content, so the fence is never closed early.
 */

/**
 * Wrap `content` in a fenced code block with the given language tag.
 * The fence length is always at least 3 and always longer than the longest
 * backtick run inside the content.
 */
export function fence(lang: string, content: string): string {
  // Stub - implementation in the green commit
  void lang
  void content
  throw new Error('Not implemented')
}
