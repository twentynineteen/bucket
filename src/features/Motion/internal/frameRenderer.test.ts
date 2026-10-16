/**
 * Frame renderer tests (issue #335)
 *
 * Tests the pure functions (buildSvgString, buildFrameList) in jsdom.
 * renderFrameToPng requires a real canvas and is tested in the e2e spec.
 */
import { describe, expect, it } from 'vitest'
import type { LayerState } from '../types'
import { buildFrameList, buildSvgString, type FontData } from './frameRenderer'

const IDENTITY: [number, number, number, number, number, number] = [1, 0, 0, 1, 0, 0]

describe('buildSvgString', () => {
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
