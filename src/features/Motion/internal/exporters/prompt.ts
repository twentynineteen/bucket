/**
 * Claude prompt exporter (issue #331)
 *
 * Generates a self-contained Markdown prompt that can be pasted into Claude
 * to rebuild or modify the graphic. Sections: intent, template JSON, timing
 * and easing, format, and target constraints.
 */
import type { ExportInput } from '../../types'

/**
 * Generate the Claude prompt Markdown for the given export input.
 */
export function generatePrompt(input: ExportInput): string {
  // Stub - implementation in the green commit
  void input
  throw new Error('Not implemented')
}
