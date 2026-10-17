/**
 * Hex colour parser (refactored from duplicated parsers in evaluate,
 * generateJsx and generateSetting).
 *
 * Accepts the same format as the schema's hexColourSchema: `#rrggbb` or
 * `#rrggbbaa` (6 or 8 hex digits after the hash). Returns the RGB channels
 * as 0-255 integers. The optional alpha byte is ignored because no
 * exporter currently uses it.
 */

/**
 * Parse a hex colour string into its red, green and blue components
 * as integers in the 0-255 range.
 *
 * @param hex - A string matching `#rrggbb` or `#rrggbbaa`.
 * @returns A three-element tuple `[r, g, b]`.
 */
export function parseHexColour(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}
