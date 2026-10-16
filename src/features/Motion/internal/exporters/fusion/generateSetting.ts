/**
 * DaVinci Resolve Fusion .setting exporter (issue #330)
 *
 * Generates a Fusion title macro (Lua table text) from a resolved template.
 * Values are baked in; text and colour params are exposed as InstanceInputs
 * so they stay editable in the Inspector.
 *
 * Tool chain: shape tools (sRectangle, sEllipse, sPolygon) -> sMerge -> sRender
 * -> Merge with Text+ tools (and Background tools for fallback layers).
 * Group transforms become image Transform tools after the sRender, not sTransform.
 *
 * sPolygon bezier handles: UNVERIFIED. This exporter assumes sPolygon does NOT
 * accept explicit bezier handles (could not be confirmed in Resolve). Paths with
 * bezier curves and hatch bands fall back to a Polygon mask on a Background tool.
 * Flagged for manual verification in #339.
 *
 * Follower fractional delay: UNVERIFIED. This exporter rounds fractional frame
 * delays to the nearest integer >= 1 frame. Flagged for manual verification in #339.
 *
 * Works in Resolve Free and Studio. No scripting API.
 */

import type { ExportInput, ExportResult } from '../../../types'

/**
 * Generate a DaVinci Resolve Fusion .setting file from the resolved template.
 *
 * @param input - The export input with resolved template, values and format
 * @returns The export result with one .setting file and any notes
 * @throws If the template contains particles layers
 */
export function generateSetting(input: ExportInput): ExportResult {
  void input
  throw new Error('Not implemented')
}
