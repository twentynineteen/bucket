/**
 * MotionPreview tests (issue #335)
 *
 * Tests the SVG rendering of evaluate output. Mocks evaluate() and
 * resolveTemplate() to control the layer states precisely.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type {
  LayerState,
  MotionFormat,
  MotionTemplate,
  ParamValues,
  ResolvedTemplate,
  TextLayerState
} from '../types'
import MotionPreview from './MotionPreview'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockEvaluate = vi.fn<(rt: ResolvedTemplate, t: number) => LayerState[]>()
const mockResolveTemplate =
  vi.fn<(t: MotionTemplate, v: ParamValues, f: MotionFormat) => ResolvedTemplate>()

vi.mock('../internal/evaluate', () => ({
  evaluate: (...args: unknown[]) =>
    mockEvaluate(args[0] as ResolvedTemplate, args[1] as number)
}))

vi.mock('../internal/resolve', () => ({
  resolveTemplate: (...args: unknown[]) =>
    mockResolveTemplate(
      args[0] as MotionTemplate,
      args[1] as ParamValues,
      args[2] as MotionFormat
    ),
  validateParams: () => [],
  slugify: (s: string) => s,
  deriveTargets: () => ['video', 'prompt'],
  validFormats: () => [],
  exportFolderName: () => 'test'
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DEFAULT_FORMAT: MotionFormat = { width: 3840, height: 2160, fps: 50 }

function makeTemplate(overrides?: Partial<MotionTemplate>): MotionTemplate {
  return {
    schemaVersion: 1,
    id: 'test-template',
    version: '1.0.0',
    name: 'Lower third Glide',
    description: 'Test template',
    category: 'lower-third',
    status: 'stable',
    tags: [],
    fonts: ['CabritoSemi-NorBol'],
    duration: 4,
    inEnd: 1,
    outStart: 3,
    params: {},
    layers: [],
    ...overrides
  }
}

function makeResolved(): ResolvedTemplate {
  return {
    id: 'test-template',
    name: 'Lower third Glide',
    description: 'Test',
    category: 'lower-third',
    status: 'stable',
    fonts: ['CabritoSemi-NorBol'],
    duration: 4,
    inEnd: 1,
    outStart: 3,
    hasHold: false,
    layers: [],
    originalTemplate: makeTemplate(),
    values: {}
  }
}

const IDENTITY_MATRIX: [number, number, number, number, number, number] = [
  1, 0, 0, 1, 0, 0
]

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MotionPreview', () => {
  // P1.1: accessible name and SVG viewBox
  it('p1_1_img_role_and_accessible_name_and_svg_viewbox', () => {
    const template = makeTemplate({ name: 'Lower third Glide' })
    const resolved = makeResolved()
    mockResolveTemplate.mockReturnValue(resolved)
    mockEvaluate.mockReturnValue([])

    render(
      <MotionPreview
        template={template}
        values={{}}
        format={DEFAULT_FORMAT}
        time={0.5}
        name="Lower third Glide"
      />
    )

    const img = screen.getByRole('img', {
      name: 'Lower third Glide preview'
    })
    expect(img).toBeInTheDocument()

    const svg = img.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg!.getAttribute('viewBox')).toBe('0 0 3840 2160')
  })

  // P1.2: shapes and text rendering
  it('p1_2_renders_rect_ellipse_path_text_with_correct_attributes', () => {
    const template = makeTemplate()
    const states: LayerState[] = [
      {
        kind: 'rect',
        id: 'bg',
        matrix: IDENTITY_MATRIX,
        opacity: 0.9,
        fill: '#ff3366',
        size: { w: 1000, h: 200 },
        radius: 24
      },
      {
        kind: 'ellipse',
        id: 'dot',
        matrix: IDENTITY_MATRIX,
        opacity: 1,
        fill: '#00ff00'
      },
      {
        kind: 'path',
        id: 'tri',
        matrix: IDENTITY_MATRIX,
        opacity: 1,
        fill: '#0000ff',
        d: 'M 100 100 L 200 300 L 300 100 Z'
      },
      {
        kind: 'text',
        id: 'title',
        matrix: IDENTITY_MATRIX,
        opacity: 1,
        fill: '#ffffff',
        text: 'Hello World',
        font: { family: 'Cabrito Semi', style: 'Norm Bold', size: 80 },
        align: 'left',
        lineHeight: 1.2,
        multiline: false,
        tracking: 0
      }
    ]

    const resolved = makeResolved()
    mockResolveTemplate.mockReturnValue(resolved)
    mockEvaluate.mockReturnValue(states)

    const { container } = render(
      <MotionPreview
        template={template}
        values={{}}
        format={DEFAULT_FORMAT}
        time={0.5}
        name="Test"
      />
    )

    const svg = container.querySelector('svg')!

    // rect with rx=24
    const rect = svg.querySelector('rect')
    expect(rect).not.toBeNull()
    expect(rect!.getAttribute('rx')).toBe('24')

    // ellipse
    const ellipse = svg.querySelector('ellipse')
    expect(ellipse).not.toBeNull()

    // path ending in Z
    const path = svg.querySelector('path')
    expect(path).not.toBeNull()
    expect(path!.getAttribute('d')).toMatch(/Z$/)

    // text with Cabrito Semi font
    const text = svg.querySelector('text')
    expect(text).not.toBeNull()
    expect(text!.getAttribute('font-family')).toMatch(/^"?Cabrito Semi/)
  })

  it('p1_2_multiline_text_with_lineHeight', () => {
    const template = makeTemplate()
    const states: LayerState[] = [
      {
        kind: 'text',
        id: 'multi',
        matrix: IDENTITY_MATRIX,
        opacity: 1,
        fill: '#ffffff',
        text: 'Line one\nLine two',
        font: { family: 'Cabrito Semi', style: 'Norm Bold', size: 80 },
        align: 'left',
        lineHeight: 1.2,
        multiline: true,
        tracking: 0
      }
    ]

    const resolved = makeResolved()
    mockResolveTemplate.mockReturnValue(resolved)
    mockEvaluate.mockReturnValue(states)

    const { container } = render(
      <MotionPreview
        template={template}
        values={{}}
        format={DEFAULT_FORMAT}
        time={0.5}
        name="Test"
      />
    )

    const svg = container.querySelector('svg')!
    const tspans = svg.querySelectorAll('tspan')

    // One tspan per line
    expect(tspans.length).toBe(2)
    expect(tspans[0].textContent).toBe('Line one')
    expect(tspans[1].textContent).toBe('Line two')

    // Line advance = 1.2 * 80 = 96
    const dy = tspans[1].getAttribute('dy')
    expect(dy).toBe('96')
  })

  // P1.3: staggered text
  it('p1_3_staggered_text_renders_per_unit_tspans', () => {
    const template = makeTemplate()
    const states: LayerState[] = [
      {
        kind: 'text',
        id: 'staggered',
        matrix: IDENTITY_MATRIX,
        opacity: 1,
        fill: '#ffffff',
        text: 'ABC',
        font: { family: 'Cabrito Semi', style: 'Norm Bold', size: 80 },
        align: 'left',
        lineHeight: 1.2,
        multiline: false,
        tracking: 0,
        units: [
          { text: 'A', matrix: IDENTITY_MATRIX, opacity: 1, fill: '#ffffff' },
          { text: 'B', matrix: IDENTITY_MATRIX, opacity: 0.5, fill: '#ffffff' },
          { text: 'C', matrix: IDENTITY_MATRIX, opacity: 0, fill: '#ffffff' }
        ]
      }
    ]

    const resolved = makeResolved()
    mockResolveTemplate.mockReturnValue(resolved)
    mockEvaluate.mockReturnValue(states)

    const { container } = render(
      <MotionPreview
        template={template}
        values={{}}
        format={DEFAULT_FORMAT}
        time={0.3}
        name="Test"
      />
    )

    const svg = container.querySelector('svg')!
    const tspans = svg.querySelectorAll('tspan')

    // Each grapheme cluster is its own tspan
    expect(tspans.length).toBe(3)
    expect(tspans[0].textContent).toBe('A')
    expect(tspans[1].textContent).toBe('B')
    expect(tspans[2].textContent).toBe('C')

    // Each has its own opacity
    expect(tspans[0].getAttribute('opacity')).toBe('1')
    expect(tspans[1].getAttribute('opacity')).toBe('0.5')
    expect(tspans[2].getAttribute('opacity')).toBe('0')
  })

  // P1.4: arc layer
  it('p1_4_arc_renders_ring_segment', () => {
    const template = makeTemplate()
    const states: LayerState[] = [
      {
        kind: 'arc',
        id: 'ring',
        matrix: IDENTITY_MATRIX,
        opacity: 1,
        fill: '#ff3366',
        arc: {
          innerRadius: 400,
          outerRadius: 480,
          sweep: 0.25,
          startAngle: 0
        }
      }
    ]

    const resolved = makeResolved()
    mockResolveTemplate.mockReturnValue(resolved)
    mockEvaluate.mockReturnValue(states)

    const { container } = render(
      <MotionPreview
        template={template}
        values={{}}
        format={DEFAULT_FORMAT}
        time={0.5}
        name="Test"
      />
    )

    const svg = container.querySelector('svg')!
    const arcPath = svg.querySelector('path')
    expect(arcPath).not.toBeNull()

    const d = arcPath!.getAttribute('d')!
    // An arc path uses A commands and has no stroke
    expect(d).toContain('A')
    expect(arcPath!.getAttribute('stroke')).toBeNull()
  })

  // P1.5: particles use canvas overlay
  it('p1_5_particles_render_on_canvas_not_svg', () => {
    const template = makeTemplate()
    const states: LayerState[] = [
      {
        kind: 'particles',
        id: 'scatter',
        matrix: IDENTITY_MATRIX,
        opacity: 1,
        points: [
          { x: 100, y: 200, fill: '#888', opacity: 1 },
          { x: 300, y: 400, fill: '#888', opacity: 1 }
        ],
        pointRadius: 4
      }
    ]

    const resolved = makeResolved()
    mockResolveTemplate.mockReturnValue(resolved)
    mockEvaluate.mockReturnValue(states)

    const { container } = render(
      <MotionPreview
        template={template}
        values={{}}
        format={DEFAULT_FORMAT}
        time={0.5}
        name="Test"
      />
    )

    // Canvas overlay exists
    const canvas = container.querySelector('canvas')
    expect(canvas).not.toBeNull()

    // No particle elements in the SVG
    const svg = container.querySelector('svg')!
    // Particles should NOT be SVG circles or similar
    const circles = svg.querySelectorAll('circle')
    expect(circles.length).toBe(0)
  })

  // P1.6: test clock override
  it('p1_6_test_clock_overrides_time', () => {
    ;(globalThis as Record<string, unknown>).__BUCKET_MOTION_CLOCK__ = 0.75

    const template = makeTemplate()
    const resolved = makeResolved()
    mockResolveTemplate.mockReturnValue(resolved)
    mockEvaluate.mockReturnValue([])

    render(
      <MotionPreview
        template={template}
        values={{}}
        format={DEFAULT_FORMAT}
        time={2.0} // This would normally be the time
        name="Test"
      />
    )

    // evaluate should have been called with the test clock time, not the prop time
    expect(mockEvaluate).toHaveBeenCalledWith(resolved, 0.75)

    delete (globalThis as Record<string, unknown>).__BUCKET_MOTION_CLOCK__
  })

  // P1.7: param changes re-render without remount
  it('p1_7_param_change_updates_without_remount', () => {
    const template = makeTemplate({
      params: {
        name: {
          kind: 'text',
          label: 'Name',
          maxLength: 40,
          default: 'Jane',
          required: true
        }
      }
    })
    const states1: LayerState[] = [
      {
        kind: 'text',
        id: 'title',
        matrix: IDENTITY_MATRIX,
        opacity: 1,
        fill: '#fff',
        text: 'Jane',
        font: { family: 'Cabrito Semi', style: 'Norm Bold', size: 80 },
        align: 'left',
        lineHeight: 1.2,
        multiline: false,
        tracking: 0
      }
    ]
    const states2: LayerState[] = [
      {
        ...states1[0],
        text: 'John'
      } as TextLayerState
    ]

    const resolved1 = makeResolved()
    const resolved2 = makeResolved()

    mockResolveTemplate.mockReturnValueOnce(resolved1)
    mockEvaluate.mockReturnValueOnce(states1)

    const { container, rerender } = render(
      <MotionPreview
        template={template}
        values={{ name: 'Jane' }}
        format={DEFAULT_FORMAT}
        time={0.5}
        name="Test"
      />
    )

    const svgBefore = container.querySelector('svg')!

    mockResolveTemplate.mockReturnValueOnce(resolved2)
    mockEvaluate.mockReturnValueOnce(states2)

    rerender(
      <MotionPreview
        template={template}
        values={{ name: 'John' }}
        format={DEFAULT_FORMAT}
        time={0.5}
        name="Test"
      />
    )

    const svgAfter = container.querySelector('svg')!

    // SVG should be the same element (not remounted)
    expect(svgBefore).toBe(svgAfter)

    // Text content should have changed
    const text = svgAfter.querySelector('text')
    expect(text).not.toBeNull()
  })
})
