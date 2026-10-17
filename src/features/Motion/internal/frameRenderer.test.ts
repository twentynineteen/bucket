/**
 * Frame renderer tests (issue #335)
 *
 * Tests the pure functions (buildSvgString, buildFrameList) in jsdom.
 * renderFrameToPng requires a real canvas and is tested in the e2e spec.
 *
 * Includes an Ar2 parity test that ensures MotionPreview and frameRenderer
 * produce equivalent SVG from the same evaluated states.
 */
import { describe, expect, it } from 'vitest'
import type { LayerState, MotionFormat, ShapeLayerState, TextLayerState } from '../types'
import { evaluate } from './evaluate'
import { buildFrameList, buildSvgString, type FontData } from './frameRenderer'
import { resolveTemplate } from './resolve'
import { arcFixture, ellipseFixture, rectFixture, textFixture } from './testing/fixtures'

const IDENTITY: [number, number, number, number, number, number] = [1, 0, 0, 1, 0, 0]

describe('buildSvgString', () => {
  it('draws an ellipse at its own radii, not a 1px dot', () => {
    const states: LayerState[] = [
      {
        kind: 'ellipse',
        id: 'dot',
        matrix: [1, 0, 0, 1, 100, 100],
        opacity: 1,
        fill: '#00ff00',
        radii: { rx: 50, ry: 30 }
      }
    ]
    const svg = buildSvgString(states, 1920, 1080, [])
    expect(svg).toContain('rx="50"')
    expect(svg).toContain('ry="30"')
  })

  // P5.1: font embedding as data URI
  it('p5_1_embeds_font_as_data_uri', () => {
    const fontBytes = new Uint8Array([0x4f, 0x54, 0x54, 0x4f]) // "OTTO" header
    const fonts: FontData[] = [{ family: 'Cabrito Semi', bytes: fontBytes }]

    const states: LayerState[] = [
      {
        kind: 'text',
        id: 't1',
        matrix: IDENTITY,
        opacity: 1,
        fill: '#ffffff',
        text: 'Test',
        font: { family: 'Cabrito Semi', style: 'Norm Bold', size: 80 },
        align: 'left',
        lineHeight: 1.2,
        multiline: false,
        tracking: 0
      }
    ]

    const svg = buildSvgString(states, 3840, 2160, fonts)

    // Contains @font-face with data URI
    expect(svg).toContain('@font-face')
    expect(svg).toContain('Cabrito Semi')
    expect(svg).toContain('data:font/otf;base64,')

    // Base64 of the font bytes
    const b64 = btoa(String.fromCharCode(...fontBytes))
    expect(svg).toContain(b64)

    // No external url() references
    const urlMatches = svg.match(/url\([^)]*\)/g) ?? []
    for (const m of urlMatches) {
      expect(m).toMatch(/url\(['"]?data:/)
    }
  })

  it('p5_1_no_external_url_references', () => {
    const states: LayerState[] = []
    const fonts: FontData[] = []
    const svg = buildSvgString(states, 1920, 1080, fonts)

    // No external url() references at all
    const urlMatches = svg.match(/url\([^)]*\)/g) ?? []
    for (const m of urlMatches) {
      if (m.includes('url(')) {
        expect(m).toMatch(/url\(['"]?data:|url\(['"]?#/)
      }
    }
  })

  it('renders_rect_with_correct_fill_and_opacity', () => {
    const states: LayerState[] = [
      {
        kind: 'rect',
        id: 'bg',
        matrix: IDENTITY,
        opacity: 0.8,
        fill: '#ff3366',
        size: { w: 500, h: 200 },
        radius: 12
      }
    ]

    const svg = buildSvgString(states, 3840, 2160, [])
    expect(svg).toContain('fill="#ff3366"')
    expect(svg).toContain('opacity="0.8"')
    expect(svg).toContain('rx="12"')
  })

  it('renders_arc_as_path', () => {
    const states: LayerState[] = [
      {
        kind: 'arc',
        id: 'ring',
        matrix: IDENTITY,
        opacity: 1,
        fill: '#ff3366',
        arc: {
          innerRadius: 400,
          outerRadius: 480,
          sweep: 0.5,
          startAngle: 0
        }
      }
    ]

    const svg = buildSvgString(states, 3840, 2160, [])
    // Arc is rendered as a path element
    expect(svg).toContain('<path')
    expect(svg).toContain('fill="#ff3366"')
  })

  it('s14_escapes_xml_special_chars_in_fill_attribute', () => {
    const states: LayerState[] = [
      {
        kind: 'rect',
        id: 'bg',
        matrix: IDENTITY,
        opacity: 1,
        fill: '"><script>alert(1)</script>',
        size: { w: 500, h: 200 },
        radius: 0
      }
    ]
    const svg = buildSvgString(states, 1920, 1080, [])
    // The fill value must be XML-escaped, not injected raw
    expect(svg).not.toContain('<script>')
    expect(svg).toContain('&lt;script&gt;')
    expect(svg).toContain('&quot;')
  })

  it('s14_escapes_text_fill_attribute', () => {
    const states: LayerState[] = [
      {
        kind: 'text',
        id: 't1',
        matrix: IDENTITY,
        opacity: 1,
        fill: '"><img onerror=alert(1)>',
        text: 'Hello',
        font: { family: 'Cabrito Semi', style: 'Norm Bold', size: 80 },
        align: 'left',
        lineHeight: 1.2,
        multiline: false,
        tracking: 0
      }
    ]
    const svg = buildSvgString(states, 1920, 1080, [])
    expect(svg).not.toContain('<img')
    expect(svg).toContain('&quot;')
  })

  it('s6_text_align_center_maps_to_text_anchor_middle', () => {
    const states: LayerState[] = [
      {
        kind: 'text',
        id: 't1',
        matrix: IDENTITY,
        opacity: 1,
        fill: '#ffffff',
        text: 'Centred',
        font: { family: 'Cabrito Semi', style: 'Norm Bold', size: 80 },
        align: 'center',
        lineHeight: 1.2,
        multiline: false,
        tracking: 0
      }
    ]
    const svg = buildSvgString(states, 1920, 1080, [])
    expect(svg).toContain('text-anchor="middle"')
  })

  it('s6_text_align_right_maps_to_text_anchor_end', () => {
    const states: LayerState[] = [
      {
        kind: 'text',
        id: 't1',
        matrix: IDENTITY,
        opacity: 1,
        fill: '#ffffff',
        text: 'Right',
        font: { family: 'Cabrito Semi', style: 'Norm Bold', size: 80 },
        align: 'right',
        lineHeight: 1.2,
        multiline: false,
        tracking: 0
      }
    ]
    const svg = buildSvgString(states, 1920, 1080, [])
    expect(svg).toContain('text-anchor="end"')
  })

  it('s6_text_align_left_maps_to_text_anchor_start', () => {
    const states: LayerState[] = [
      {
        kind: 'text',
        id: 't1',
        matrix: IDENTITY,
        opacity: 1,
        fill: '#ffffff',
        text: 'Left',
        font: { family: 'Cabrito Semi', style: 'Norm Bold', size: 80 },
        align: 'left',
        lineHeight: 1.2,
        multiline: false,
        tracking: 0
      }
    ]
    const svg = buildSvgString(states, 1920, 1080, [])
    expect(svg).toContain('text-anchor="start"')
  })

  it('s15_font_css_is_memoised_across_frames', () => {
    const fontBytes = new Uint8Array([0x4f, 0x54, 0x54, 0x4f])
    const fonts: FontData[] = [{ family: 'Cabrito Semi', bytes: fontBytes }]
    const states: LayerState[] = []

    const svg1 = buildSvgString(states, 1920, 1080, fonts)
    const svg2 = buildSvgString(states, 1920, 1080, fonts)

    // Both should contain the font-face (basic correctness)
    expect(svg1).toContain('@font-face')
    expect(svg2).toContain('@font-face')
    // Memoisation is an internal optimisation - the output should be identical
    expect(svg1).toBe(svg2)
  })
})

// ---------------------------------------------------------------------------
// Ar2: parity test - MotionPreview and frameRenderer agree on vector SVG
// ---------------------------------------------------------------------------

/**
 * Normalise an SVG string for comparison: canonicalise self-closing tags,
 * round numbers to 4 decimal places, strip whitespace differences.
 */
function normaliseSvg(svg: string): string {
  // Round all numbers to 4 decimal places
  let result = svg.replace(/-?\d+\.\d{5,}/g, match => {
    return Number(parseFloat(match).toFixed(4)).toString()
  })
  // Canonicalise self-closing tags: <foo .../> and <foo ...></foo> both become <foo .../>
  result = result.replace(/<(\w+)([^>]*?)><\/\1>/g, '<$1$2 />')
  // Normalise self-closing whitespace: " />" and "/>" both become " />"
  result = result.replace(/\s*\/>/g, ' />')
  // Collapse whitespace
  result = result.replace(/\s+/g, ' ').trim()
  return result
}

/**
 * Extract the body elements (everything between the first > and last <) from
 * an SVG string, skipping the wrapper <svg ...> and </svg>.
 */
function extractSvgBody(svg: string): string {
  // Remove the outer <svg...> and </svg>
  const startIdx = svg.indexOf('>') + 1
  const endIdx = svg.lastIndexOf('</svg>')
  if (startIdx <= 0 || endIdx < 0) return svg
  return svg.substring(startIdx, endIdx)
}

/**
 * Build "preview-style" SVG for a set of layer states, matching what
 * MotionPreview would render (minus the React JSX layer).
 *
 * This duplicates the preview logic intentionally - the test's job is to
 * detect when the two diverge.
 */
function previewSvg(states: LayerState[], w: number, h: number): string {
  const parts: string[] = []
  for (const state of states) {
    if (state.kind === 'particles') continue

    if (state.kind === 'text') {
      parts.push(previewTextSvg(state))
      continue
    }

    parts.push(previewShapeSvg(state))
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${parts.join('')}</svg>`
}

function matrixStr(m: [number, number, number, number, number, number]): string {
  return `matrix(${m[0]} ${m[1]} ${m[2]} ${m[3]} ${m[4]} ${m[5]})`
}

function previewShapeSvg(state: ShapeLayerState): string {
  const transform = matrixStr(state.matrix)

  if (state.kind === 'rect' && state.size) {
    return `<rect x="0" y="0" width="${state.size.w}" height="${state.size.h}" rx="${state.radius ?? 0}" fill="${state.fill}" opacity="${state.opacity}" transform="${transform}"></rect>`
  }
  if (state.kind === 'ellipse' && state.radii) {
    return `<ellipse cx="0" cy="0" rx="${state.radii.rx}" ry="${state.radii.ry}" fill="${state.fill}" opacity="${state.opacity}" transform="${transform}"></ellipse>`
  }
  if (state.kind === 'arc' && state.arc) {
    const { innerRadius, outerRadius, sweep, startAngle } = state.arc
    const d = arcPathParity(0, 0, innerRadius, outerRadius, startAngle, sweep)
    if (!d) return ''
    return `<path d="${d}" fill="${state.fill}" opacity="${state.opacity}" transform="${transform}"></path>`
  }
  if (state.kind === 'path' && state.d) {
    return `<path d="${state.d}" fill="${state.fill}" opacity="${state.opacity}" transform="${transform}"></path>`
  }
  return ''
}

function arcPathParity(
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

function previewTextSvg(state: TextLayerState): string {
  const transform = matrixStr(state.matrix)
  const fontFamily = `"${state.font.family}"`
  let anchor: string
  switch (state.align) {
    case 'center':
      anchor = 'middle'
      break
    case 'right':
      anchor = 'end'
      break
    default:
      anchor = 'start'
  }

  if (state.units && state.units.length > 0) {
    const tspans = state.units
      .map(u => `<tspan opacity="${u.opacity}" fill="${u.fill}">${u.text}</tspan>`)
      .join('')
    return `<text font-family=${fontFamily} font-size="${state.font.size}" fill="${state.fill}" opacity="${state.opacity}" text-anchor="${anchor}" transform="${transform}">${tspans}</text>`
  }

  if (state.multiline && state.text.includes('\n')) {
    const lines = state.text.split('\n')
    const lineAdvance = state.lineHeight * state.font.size
    const tspans = lines
      .map((line, i) => {
        if (i === 0) return `<tspan x="0">${line}</tspan>`
        return `<tspan x="0" dy="${lineAdvance}">${line}</tspan>`
      })
      .join('')
    return `<text font-family=${fontFamily} font-size="${state.font.size}" fill="${state.fill}" opacity="${state.opacity}" text-anchor="${anchor}" transform="${transform}">${tspans}</text>`
  }

  return `<text font-family=${fontFamily} font-size="${state.font.size}" fill="${state.fill}" opacity="${state.opacity}" text-anchor="${anchor}" transform="${transform}">${state.text}</text>`
}

describe('Ar2 parity: preview vs. frameRenderer SVG', () => {
  const FORMAT: MotionFormat = { width: 3840, height: 2160, fps: 50 }

  it('ar2_rect_fixture_at_t05_matches', () => {
    const resolved = resolveTemplate(rectFixture, {}, FORMAT)
    const states = evaluate(resolved, 0.5)

    const rendererSvg = buildSvgString(states, 3840, 2160, [])
    const rendererBody = extractSvgBody(rendererSvg)

    const previewBody = extractSvgBody(previewSvg(states, 3840, 2160))

    expect(normaliseSvg(rendererBody)).toBe(normaliseSvg(previewBody))
  })

  it('ar2_ellipse_fixture_at_t05_matches', () => {
    const resolved = resolveTemplate(ellipseFixture, {}, FORMAT)
    const states = evaluate(resolved, 0.5)

    const rendererSvg = buildSvgString(states, 3840, 2160, [])
    const rendererBody = extractSvgBody(rendererSvg)
    const previewBody = extractSvgBody(previewSvg(states, 3840, 2160))

    expect(normaliseSvg(rendererBody)).toBe(normaliseSvg(previewBody))
  })

  it('ar2_arc_fixture_at_t05_matches', () => {
    const resolved = resolveTemplate(arcFixture, { score: 72 }, FORMAT)
    const states = evaluate(resolved, 0.5)

    const rendererSvg = buildSvgString(states, 3840, 2160, [])
    const rendererBody = extractSvgBody(rendererSvg)
    const previewBody = extractSvgBody(previewSvg(states, 3840, 2160))

    expect(normaliseSvg(rendererBody)).toBe(normaliseSvg(previewBody))
  })

  it('ar2_text_with_centre_align_at_t05_matches', () => {
    // Create a centre-aligned staggered text fixture
    const centredStaggerFixture = {
      ...textFixture,
      id: 'centred-stagger',
      layers: [
        {
          ...textFixture.layers[0],
          align: 'center' as const,
          stagger: { delay: 0.02 }
        }
      ]
    }

    const resolved = resolveTemplate(centredStaggerFixture, { name: 'Hello' }, FORMAT)
    const states = evaluate(resolved, 0.3) // During stagger

    const rendererSvg = buildSvgString(states, 3840, 2160, [])
    const rendererBody = extractSvgBody(rendererSvg)
    const previewBody = extractSvgBody(previewSvg(states, 3840, 2160))

    expect(normaliseSvg(rendererBody)).toBe(normaliseSvg(previewBody))
  })
})

describe('buildFrameList', () => {
  // P5.2: frame count and timing
  it('p5_2_correct_frame_count_and_times_for_2s_at_25fps', () => {
    const frames = buildFrameList(2, 25)

    // round(2 * 25) = 50 frames
    expect(frames).toHaveLength(50)

    // Time i = i / 25
    expect(frames[0]).toBeCloseTo(0)
    expect(frames[1]).toBeCloseTo(1 / 25)
    expect(frames[24]).toBeCloseTo(24 / 25)
    expect(frames[49]).toBeCloseTo(49 / 25)
  })

  it('p5_2_correct_frame_count_for_2_03s_at_25fps', () => {
    const frames = buildFrameList(2.03, 25)

    // round(2.03 * 25) = round(50.75) = 51 frames
    expect(frames).toHaveLength(51)
  })

  it('frame_list_1920x1080_format_dimensions', () => {
    // This just tests the frame count for a different fps
    const frames = buildFrameList(4, 30)
    // round(4 * 30) = 120
    expect(frames).toHaveLength(120)
    expect(frames[0]).toBe(0)
    expect(frames[119]).toBeCloseTo(119 / 30)
  })
})
