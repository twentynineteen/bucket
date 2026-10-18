/**
 * Frame renderer for Motion video export (issue #335)
 *
 * Serialises the SVG with fonts embedded as data URIs, composites
 * vector and particle layers onto a canvas, and encodes to PNG.
 *
 * The SVG content comes from the shared buildSvgTree (issue #341),
 * serialised to a string by serialiseSvgNodes. Adding a new layer kind
 * only touches buildSvgTree - this file stays unchanged.
 *
 * Canvas-dependent logic is isolated behind a seam so the unit tests
 * can run in jsdom (which has no canvas). The seam is:
 *   - `buildSvgString()`: pure, testable in jsdom
 *   - `renderFrameToPng()`: needs a real canvas (browser or e2e)
 *   - `buildFrameList()`: pure, returns frame times
 */
import type {
  LayerState,
  MotionFormat,
  ParticlesLayerState,
  ResolvedTemplate
} from '../types'
import { evaluate } from './evaluate'
import { serialiseSvgNodes } from './svgSerialise'
import { buildSvgTree } from './svgTree'

export interface FontData {
  family: string
  bytes: Uint8Array
}

// ---------------------------------------------------------------------------
// SVG helpers
// ---------------------------------------------------------------------------

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Font CSS memoisation
// ---------------------------------------------------------------------------

let cachedFontRef: FontData[] | null = null
let cachedFontCss = ''

/**
 * Build the @font-face CSS for a set of fonts, memoised by reference identity.
 * The same FontData[] array passed across frames of a single render avoids
 * re-encoding hundreds of KB of base64 per frame.
 */
function fontFaceCss(fonts: FontData[]): string {
  if (fonts === cachedFontRef) return cachedFontCss
  cachedFontRef = fonts
  cachedFontCss = fonts
    .map(
      f =>
        `@font-face { font-family: "${f.family}"; src: url("data:font/otf;base64,${uint8ToBase64(f.bytes)}"); }`
    )
    .join('\n')
  return cachedFontCss
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
  const fontFaces = fontFaceCss(fonts)

  const style = fontFaces ? `<defs><style>${fontFaces}</style></defs>` : ''

  const tree = buildSvgTree(states)
  const body = serialiseSvgNodes(tree)

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" text-rendering="geometricPrecision">${style}${body}</svg>`
}

/**
 * Build the list of frame times for a render.
 * Frame count = round(duration * fps), time i = i / fps.
 */
export function buildFrameList(duration: number, fps: number): number[] {
  const count = Math.round(duration * fps)
  const frames: number[] = []
  for (let i = 0; i < count; i++) {
    frames.push(i / fps)
  }
  return frames
}

/**
 * Draw particle points onto a canvas context.
 */
function drawParticles(ctx: CanvasRenderingContext2D, state: ParticlesLayerState): void {
  const [a, b, c, d, tx, ty] = state.matrix
  ctx.save()
  ctx.transform(a, b, c, d, tx, ty)
  ctx.globalAlpha = state.opacity

  for (const pt of state.points) {
    if (pt.opacity <= 0) continue
    ctx.globalAlpha = state.opacity * pt.opacity
    ctx.fillStyle = pt.fill
    ctx.beginPath()
    ctx.arc(pt.x, pt.y, state.pointRadius, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()
}

/**
 * Render a single frame to PNG bytes.
 * Requires a real canvas (browser environment).
 *
 * Steps:
 * 1. Evaluate the template at time t
 * 2. Build SVG string with embedded fonts for vector layers
 * 3. Draw SVG onto canvas via Image + blob URL
 * 4. Draw particle canvas overlay
 * 5. Encode canvas to PNG ArrayBuffer
 */
export async function renderFrameToPng(
  resolved: ResolvedTemplate,
  t: number,
  format: MotionFormat,
  fonts: FontData[]
): Promise<Uint8Array> {
  const states = evaluate(resolved, t)
  const { width, height } = format

  // Build SVG for vector layers
  const svgStr = buildSvgString(states, width, height, fonts)

  // Create the output canvas
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!

  // Draw SVG onto canvas via blob URL
  const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)

  try {
    const img = new Image()
    img.width = width
    img.height = height

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('SVG render failed'))
      img.src = url
    })

    ctx.drawImage(img, 0, 0, width, height)
  } finally {
    URL.revokeObjectURL(url)
  }

  // Draw particles on top
  const particleStates = states.filter(
    (s): s is ParticlesLayerState => s.kind === 'particles'
  )
  for (const ps of particleStates) {
    drawParticles(ctx, ps)
  }

  // Encode to PNG
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(b => {
      if (b) resolve(b)
      else reject(new Error('Canvas toBlob failed'))
    }, 'image/png')
  })

  const buffer = await blob.arrayBuffer()
  return new Uint8Array(buffer)
}
