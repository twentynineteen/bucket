/**
 * README exporter (issue #331)
 *
 * Generates a README.md with install and run steps per selected target,
 * required fonts, image credits, and Premiere routes.
 */
import type { ExportInput } from '../../types'

/**
 * Generate the README.md Markdown for the given export input.
 * @param notes - exporter notes from other generators (e.g. Resolve Follower rounding)
 */
export function generateReadme(input: ExportInput, notes?: string[]): string {
  // Stub - implementation in the green commit
  void input
  void notes
  throw new Error('Not implemented')
}
