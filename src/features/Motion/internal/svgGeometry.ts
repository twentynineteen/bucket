/**
 * Shared SVG geometry helpers used by both the preview (MotionPreview.tsx)
 * and the frame renderer (frameRenderer.ts).
 *
 * Extracted to eliminate duplication so a change in one renderer cannot
 * silently diverge from the other.
 */

/** Format a 2D affine transform matrix as an SVG `matrix(...)` attribute value. */
export function matrixStr(m: [number, number, number, number, number, number]): string {
  return `matrix(${m[0]} ${m[1]} ${m[2]} ${m[3]} ${m[4]} ${m[5]})`
}

/**
 * Build an SVG arc path for a ring segment (no stroke).
 * sweep is in turns (0-1), startAngle in degrees.
 */
export function arcPath(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startAngleDeg: number,
  sweepTurns: number
): string {
  if (sweepTurns <= 0) return ''

  const startRad = ((startAngleDeg - 90) * Math.PI) / 180
  const endRad = startRad + sweepTurns * 2 * Math.PI

  const largeArc = sweepTurns > 0.5 ? 1 : 0

  const ox1 = cx + outerR * Math.cos(startRad)
  const oy1 = cy + outerR * Math.sin(startRad)
  const ox2 = cx + outerR * Math.cos(endRad)
  const oy2 = cy + outerR * Math.sin(endRad)
  const ix1 = cx + innerR * Math.cos(endRad)
  const iy1 = cy + innerR * Math.sin(endRad)
  const ix2 = cx + innerR * Math.cos(startRad)
  const iy2 = cy + innerR * Math.sin(startRad)

  return [
    `M ${ox1} ${oy1}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${ox2} ${oy2}`,
    `L ${ix1} ${iy1}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix2} ${iy2}`,
    'Z'
  ].join(' ')
}
