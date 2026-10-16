/**
 * After Effects .jsx exporter (issue #329)
 *
 * Pure function: takes an ExportInput (template, resolved values, format,
 * already scaled and frame-snapped by resolve.ts) and returns an ExportResult
 * containing the .jsx text file and optional notes. Never writes files.
 *
 * The generated script is ES3-only ExtendScript, ASCII-only, wrapped in
 * beginUndoGroup/endUndoGroup, with no JSON object references.
 */

import type { ExportInput, ExportResult } from '../../../types'

/**
 * Generate an After Effects .jsx script from the resolved export input.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function generateJsx(input: ExportInput): ExportResult {
  throw new Error('Not implemented')
}
