/**
 * Frame renderer for Motion video export (issue #335)
 *
 * Serialises the SVG with fonts embedded as data URIs, composites
 * vector and particle layers onto a canvas, and encodes to PNG.
 *
 * Canvas-dependent logic is isolated behind a seam so the unit tests
 * can run in jsdom (which has no canvas). The seam is:
 *   - `buildSvgString()`: pure, testable in jsdom
 *   - `renderFrameToPng()`: needs a real canvas (browser or e2e)
 *   - `buildFrameList()`: pure, returns frame times
 */
import type { LayerState, MotionFormat, ResolvedTemplate } from '../types'

export interface FontData {
  family: string
  bytes: Uint8Array
}

/**
 * Build the SVG string for a single frame with fonts embedded as data URIs.
 * Pure function - no canvas needed.
 */
export function buildSvgString(
  states: LayerState[],
  width: number,
  height: number,
  fonts: FontData[]
): string {
  void states
  void width
  void height
  void fonts
  throw new Error('not implemented')
}

/**
 * Build the list of frame times for a render.
 * Frame count = round(duration * fps), time i = i / fps.
 */
export function buildFrameList(duration: number, fps: number): number[] {
  void duration
  void fps
  throw new Error('not implemented')
}

/**
 * Render a single frame to PNG bytes.
 * Requires a real canvas (browser environment).
 *
 * Steps:
 * 1. Build SVG string with embedded fonts
 * 2. Draw SVG onto canvas via Image + blob URL
 * 3. Draw particle canvas overlay
 * 4. Encode canvas to PNG ArrayBuffer
 */
export async function renderFrameToPng(
  resolved: ResolvedTemplate,
  t: number,
  format: MotionFormat,
  fonts: FontData[]
): Promise<Uint8Array> {
  void resolved
  void t
  void format
  void fonts
  throw new Error('not implemented')
}
