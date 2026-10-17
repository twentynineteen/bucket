/**
 * Frame renderer tests (issue #335)
 *
 * Tests the pure functions (buildSvgString, buildFrameList) in jsdom.
 * renderFrameToPng requires a real canvas and is tested in the e2e spec.
 *
 * Includes a parity test that renders the real MotionPreview component
 * via renderToStaticMarkup and compares its SVG body against buildSvgString,
 * so a change in either renderer is caught.
 */
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import MotionPreview from '../components/MotionPreview'
import type { LayerState, MotionFormat, MotionTemplate, ParamValues } from '../types'
import { loadBuiltins } from './builtins'
import { evaluate } from './evaluate'
import { buildFrameList, buildSvgString, type FontData } from './frameRenderer'
import { resolveTemplate } from './resolve'
import { layerKindFixtures, textFixture } from './testing/fixtures'

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

  it('embeds font as data URI', () => {
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

  it('no external url references', () => {
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

  it('escapes XML special chars in fill attribute', () => {
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

  it('escapes text fill attribute', () => {
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

  it('center align maps to text-anchor middle', () => {
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

  it('right align maps to text-anchor end', () => {
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

  it('left align maps to text-anchor start', () => {
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

  it('font CSS is memoised across frames', () => {
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
// Parity test: MotionPreview and frameRenderer agree on vector SVG
//
// Renders the real MotionPreview component via renderToStaticMarkup under
// the test clock and compares its SVG body with buildSvgString, across
// every built-in fixture template at entrance, hold and exit times.
// Particle layers are excluded because they draw on canvas, not SVG.
// ---------------------------------------------------------------------------

/**
 * Normalise an SVG string for comparison: canonicalise attribute order,
 * round numbers to 4 decimal places, standardise self-closing tags and
 * whitespace.
 */
/** Decode HTML entities in an attribute value. */
function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function normaliseSvg(svg: string): string {
  let result = svg
  // Round all numbers to 4 decimal places
  result = result.replace(/-?\d+\.\d{5,}/g, match => {
    return Number(parseFloat(match).toFixed(4)).toString()
  })
  // Canonicalise self-closing tags: <foo ...></foo> becomes <foo .../>
  result = result.replace(/<(\w+)([^>]*?)><\/\1>/g, '<$1$2/>')
  // Sort attributes on each tag (both opening and self-closing).
  // Decode entities inside values so &quot; and raw " compare equally.
  result = result.replace(/<(\w+)\s+([^>]*?)(\/?)>/g, (full, tag, attrs, slash) => {
    const pairs: string[] = []
    const attrRegex = /([\w-]+)="([^"]*)"/g
    let m
    while ((m = attrRegex.exec(attrs)) !== null) {
      const key = m[1]
      let val = decodeEntities(m[2])
      // Strip CSS quotes around font-family names - both renderers
      // intend the same font; they differ only in HTML escaping of the
      // CSS-level quotes.
      if (key === 'font-family') {
        val = val.replace(/^"+|"+$/g, '')
      }
      pairs.push(`${key}="${val}"`)
    }
    if (pairs.length === 0) return full
    pairs.sort()
    const closing = slash ? ' /' : ''
    return `<${tag} ${pairs.join(' ')}${closing}>`
  })
  // Normalise self-closing whitespace
  result = result.replace(/\s*\/>/g, ' />')
  // Collapse whitespace
  result = result.replace(/\s+/g, ' ').trim()
  return result
}

/**
 * Extract the body elements (everything between the first > and last <) from
 * an SVG string, skipping the wrapper <svg ...> and </svg>.
 * Also strips any <defs>...</defs> block (font CSS) so only layer markup is compared.
 */
function extractSvgBody(svg: string): string {
  const startIdx = svg.indexOf('>') + 1
  const endIdx = svg.lastIndexOf('</svg>')
  if (startIdx <= 0 || endIdx < 0) return svg
  let body = svg.substring(startIdx, endIdx)
  // Remove defs (font CSS in renderer output, absent in preview)
  body = body.replace(/<defs>[\s\S]*?<\/defs>/g, '')
  return body
}

/**
 * Extract the <svg>...</svg> from the full HTML that renderToStaticMarkup
 * produces (which includes the outer wrapper div and possibly a canvas tag).
 */
function extractSvgElement(html: string): string {
  const svgStart = html.indexOf('<svg ')
  const svgEnd = html.indexOf('</svg>') + '</svg>'.length
  if (svgStart < 0 || svgEnd <= svgStart) return ''
  return html.substring(svgStart, svgEnd)
}

/** Set the global test-clock value that MotionPreview reads. */
function setTestClock(t: number) {
  ;(globalThis as Record<string, unknown>).__BUCKET_MOTION_CLOCK__ = t
}

function clearTestClock() {
  delete (globalThis as Record<string, unknown>).__BUCKET_MOTION_CLOCK__
}

/** Default param values for fixtures. */
function defaultValues(tmpl: MotionTemplate): ParamValues {
  const vals: ParamValues = {}
  for (const [id, def] of Object.entries(tmpl.params)) {
    if ('default' in def) vals[id] = def.default
  }
  return vals
}

/** Whether a template has only particle layers (no vector content to compare). */
function isParticleOnly(tmpl: MotionTemplate): boolean {
  function hasVector(layers: MotionTemplate['layers']): boolean {
    return layers.some(l => {
      if (l.kind === 'group') return hasVector(l.children)
      return l.kind !== 'particles'
    })
  }
  return !hasVector(tmpl.layers)
}

describe('preview vs. frameRenderer parity', () => {
  const FORMAT: MotionFormat = { width: 3840, height: 2160, fps: 50 }
  const TIMES = [0.15, 0.5, 2.0, 3.5] // entrance, hold start, hold end, exit

  afterEach(() => {
    clearTestClock()
  })

  // Every layer-kind fixture, plus every shipped template: the built-ins
  // combine stagger, counters, series, groups and arcs in ways the
  // one-kind fixtures do not
  const vectorFixtures = [...layerKindFixtures, ...loadBuiltins().templates].filter(
    f => !isParticleOnly(f)
  )

  for (const fixture of vectorFixtures) {
    for (const t of TIMES) {
      it(`${fixture.id} at t=${t}: preview matches renderer`, () => {
        const values = defaultValues(fixture)
        const resolved = resolveTemplate(fixture, values, FORMAT)
        const states = evaluate(resolved, t)

        // Renderer side: build the SVG string (no fonts for comparison)
        const rendererSvg = buildSvgString(states, 3840, 2160, [])
        const rendererBody = extractSvgBody(rendererSvg)

        // Preview side: render the real MotionPreview under the test clock
        setTestClock(t)
        const html = renderToStaticMarkup(
          React.createElement(MotionPreview, {
            template: fixture,
            values,
            format: FORMAT,
            time: 999, // overridden by test clock
            name: fixture.name
          })
        )
        const previewSvg = extractSvgElement(html)
        const previewBody = extractSvgBody(previewSvg)

        expect(normaliseSvg(rendererBody)).toBe(normaliseSvg(previewBody))
      })
    }
  }

  it('staggered text during entrance matches', () => {
    const staggeredFixture = {
      ...textFixture,
      id: 'stagger-parity',
      layers: [
        {
          ...textFixture.layers[0],
          align: 'center' as const,
          stagger: { delay: 0.02 }
        }
      ]
    }

    const t = 0.3
    const values = { name: 'Hello' }
    const resolved = resolveTemplate(staggeredFixture, values, FORMAT)
    const states = evaluate(resolved, t)

    const rendererSvg = buildSvgString(states, 3840, 2160, [])
    const rendererBody = extractSvgBody(rendererSvg)

    setTestClock(t)
    const html = renderToStaticMarkup(
      React.createElement(MotionPreview, {
        template: staggeredFixture,
        values,
        format: FORMAT,
        time: 999,
        name: 'stagger-parity'
      })
    )
    const previewSvg = extractSvgElement(html)
    const previewBody = extractSvgBody(previewSvg)

    expect(normaliseSvg(rendererBody)).toBe(normaliseSvg(previewBody))
  })
})

describe('buildFrameList', () => {
  it('correct frame count and times for 2s at 25fps', () => {
    const frames = buildFrameList(2, 25)

    // round(2 * 25) = 50 frames
    expect(frames).toHaveLength(50)

    // Time i = i / 25
    expect(frames[0]).toBeCloseTo(0)
    expect(frames[1]).toBeCloseTo(1 / 25)
    expect(frames[24]).toBeCloseTo(24 / 25)
    expect(frames[49]).toBeCloseTo(49 / 25)
  })

  it('correct frame count for 2.03s at 25fps', () => {
    const frames = buildFrameList(2.03, 25)

    // round(2.03 * 25) = round(50.75) = 51 frames
    expect(frames).toHaveLength(51)
  })

  it('correct frame count for 4s at 30fps', () => {
    // This just tests the frame count for a different fps
    const frames = buildFrameList(4, 30)
    // round(4 * 30) = 120
    expect(frames).toHaveLength(120)
    expect(frames[0]).toBe(0)
    expect(frames[119]).toBeCloseTo(119 / 30)
  })
})
