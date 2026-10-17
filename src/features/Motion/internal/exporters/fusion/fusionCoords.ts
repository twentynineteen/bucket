/**
 * Coordinate conversion for Fusion .setting files (issue #330)
 *
 * Two coordinate families:
 *
 * **Image tools** (Text+, Transform, Merge): normalised 0-1.
 *   x = templateX / width, y = 1 - templateY / height.
 *   (0.5, 0.5) is frame centre.
 *
 * **Shape tools** (sRectangle, sEllipse, sPolygon): centre-based, normalised to
 * frame width. (0, 0) is frame centre. Both X and Y are divided by width.
 *   x = (templateX - width/2) / width
 *   y = (height/2 - templateY) / width
 *
 * Source: Blackmagic Fusion 18.6 manual (sRectangle, sEllipse documentation) -
 * shape tools use offset from frame centre, normalised to frame width for both
 * axes. Confirmed by forum reports:
 * - https://forum.blackmagicdesign.com/viewtopic.php?t=154118 (sRectangle Y)
 * - https://jayaretv.com/fusion/sellipse-node/ (sEllipse documentation)
 * - https://www.steakunderwater.com/VFXPedia (Fusion 18.6 manual mirror)
 *
 * Size: relative to width (pixels / width).
 * Rotation: negated (template degrees -> -degrees in Fusion).
 */

/** Convert a template point to Fusion image-space coordinates. */
export function toImageCoords(
  x: number,
  y: number,
  width: number,
  height: number
): { x: number; y: number } {
  return {
    x: x / width,
    y: 1 - y / height
  }
}

/** Convert a template point to Fusion shape-space coordinates. */
export function toShapeCoords(
  x: number,
  y: number,
  width: number,
  height: number
): { x: number; y: number } {
  return {
    x: (x - width / 2) / width,
    y: (height / 2 - y) / width
  }
}

/** Convert a template size (pixels) to Fusion size (relative to width). */
export function toFusionSize(pixels: number, width: number): number {
  return pixels / width
}

/** Convert a template rotation (degrees) to Fusion rotation. */
export function toFusionRotation(degrees: number): number {
  return -degrees
}
