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
import type {
  LayerState,
  MotionFormat,
  ParticlesLayerState,
  ResolvedTemplate,
  ShapeLayerState,
  TextLayerState
} from '../types'
import { evaluate } from './evaluate'

/** Exhaustiveness check: the compiler proves this is never called. */
function assertNever(x: never): never {
  throw new Error(`Unexpected layer kind: ${(x as { kind: string }).kind}`)
}

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

function matrixAttr(m: [number, number, number, number, number, number]): string {
  return `matrix(${m[0]} ${m[1]} ${m[2]} ${m[3]} ${m[4]} ${m[5]})`
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Build an SVG arc path for a ring segment (no stroke).
 * sweep is in turns (0-1), startAngle in degrees.
 */
function arcPath(
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

function renderShapeState(state: ShapeLayerState): string {
  const transform = matrixAttr(state.matrix)
  const fill = escapeXml(state.fill)

  if (state.kind === 'rect' && state.size) {
    return `<rect x="0" y="0" width="${state.size.w}" height="${state.size.h}" rx="${state.radius ?? 0}" fill="${fill}" opacity="${state.opacity}" transform="${transform}" />`
  }

  if (state.kind === 'ellipse') {
    const rx = state.radii?.rx ?? 0
    const ry = state.radii?.ry ?? 0
    return `<ellipse cx="0" cy="0" rx="${rx}" ry="${ry}" fill="${fill}" opacity="${state.opacity}" transform="${transform}" />`
  }

  if (state.kind === 'path' && state.d) {
    return `<path d="${escapeXml(state.d)}" fill="${fill}" opacity="${state.opacity}" transform="${transform}" />`
  }

  if (state.kind === 'arc' && state.arc) {
    const { innerRadius, outerRadius, sweep, startAngle } = state.arc
    // Arc is centred at the origin (transform handles placement)
    const d = arcPath(0, 0, innerRadius, outerRadius, startAngle, sweep)
    if (!d) return ''
    return `<path d="${d}" fill="${fill}" opacity="${state.opacity}" transform="${transform}" />`
  }

  assertNever(state.kind as never)
}

function alignToAnchor(align: 'left' | 'center' | 'right'): string {
  switch (align) {
    case 'center':
      return 'middle'
    case 'right':
      return 'end'
    default:
      return 'start'
  }
}

function renderTextState(state: TextLayerState): string {
  const transform = matrixAttr(state.matrix)
  const fontFamily = `"${escapeXml(state.font.family)}"`
  const fontSize = state.font.size
  const fill = escapeXml(state.fill)
  const anchor = alignToAnchor(state.align)

  // Staggered text: each unit is its own tspan
  if (state.units && state.units.length > 0) {
    const tspans = state.units
      .map(
        u =>
          `<tspan opacity="${u.opacity}" fill="${escapeXml(u.fill)}">${escapeXml(u.text)}</tspan>`
      )
      .join('')
    return `<text font-family=${fontFamily} font-size="${fontSize}" fill="${fill}" opacity="${state.opacity}" text-anchor="${anchor}" transform="${transform}">${tspans}</text>`
  }

  // Multiline text: one tspan per line
  if (state.multiline && state.text.includes('\n')) {
    const lines = state.text.split('\n')
    const lineAdvance = state.lineHeight * fontSize
    const tspans = lines
      .map((line, i) => {
        if (i === 0) {
          return `<tspan x="0">${escapeXml(line)}</tspan>`
        }
        return `<tspan x="0" dy="${lineAdvance}">${escapeXml(line)}</tspan>`
      })
      .join('')
    return `<text font-family=${fontFamily} font-size="${fontSize}" fill="${fill}" opacity="${state.opacity}" text-anchor="${anchor}" transform="${transform}">${tspans}</text>`
  }

  // Plain text
  return `<text font-family=${fontFamily} font-size="${fontSize}" fill="${fill}" opacity="${state.opacity}" text-anchor="${anchor}" transform="${transform}">${escapeXml(state.text)}</text>`
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

  const elements: string[] = []
  for (const state of states) {
    switch (state.kind) {
      case 'particles':
        continue // Particles go on canvas
      case 'text':
        elements.push(renderTextState(state))
        break
      case 'rect':
      case 'ellipse':
      case 'path':
      case 'arc':
        elements.push(renderShapeState(state))
        break
      default:
        assertNever(state)
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${style}${elements.join('')}</svg>`
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
