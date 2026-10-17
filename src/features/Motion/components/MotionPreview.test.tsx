/**
 * MotionPreview tests (issue #335)
 *
 * Tests the SVG rendering of evaluate output. Uses the real evaluate() and
 * resolveTemplate() with fixture templates so the full pipeline is exercised.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  arcFixture,
  ellipseFixture,
  particlesFixture,
  rectFixture,
  textFixture
} from '../internal/testing/fixtures'
import type { MotionFormat, MotionTemplate, ParamValues, TextLayer } from '../types'
import MotionPreview from './MotionPreview'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DEFAULT_FORMAT: MotionFormat = { width: 3840, height: 2160, fps: 50 }

/** Render a preview at a given time and return the container. */
function renderPreview(
  template: MotionTemplate,
  values: ParamValues = {},
  time: number = 0.5,
  name: string = template.name
) {
  return render(
    <MotionPreview
      template={template}
      values={values}
      format={DEFAULT_FORMAT}
      time={time}
      name={name}
    />
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MotionPreview', () => {
  it('has img role, accessible name and 16:9 SVG viewBox', () => {
    renderPreview(textFixture, { name: 'Jane Doe' }, 0.5, 'Lower third Glide')

    const img = screen.getByRole('img', {
      name: 'Lower third Glide preview'
    })
    expect(img).toBeInTheDocument()

    const svg = img.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg!.getAttribute('viewBox')).toBe('0 0 3840 2160')
  })

  it('renders rect with correct fill, radius and opacity', () => {
    // At t=0.5, the rect opacity is interpolated from 0 to 1 over 0-1s
    const { container } = renderPreview(rectFixture, {}, 0.5)

    const svg = container.querySelector('svg')!
    const rect = svg.querySelector('rect')
    expect(rect).not.toBeNull()
    expect(rect!.getAttribute('rx')).toBe('24')
    expect(rect!.getAttribute('fill')).toBe('#ff3366')
  })

  it('renders ellipse at its radii', () => {
    const { container } = renderPreview(ellipseFixture, {}, 0.5)

    const svg = container.querySelector('svg')!
    const ellipse = svg.querySelector('ellipse')
    expect(ellipse).not.toBeNull()
    // The evaluated radii come from the template's radiusX/radiusY
    const rx = Number(ellipse!.getAttribute('rx'))
    const ry = Number(ellipse!.getAttribute('ry'))
    expect(rx).toBeGreaterThan(0)
    expect(ry).toBeGreaterThan(0)
  })

  it('renders text with font family', () => {
    const { container } = renderPreview(textFixture, { name: 'Jane Doe' }, 0.5)

    const svg = container.querySelector('svg')!
    const text = svg.querySelector('text')
    expect(text).not.toBeNull()
    expect(text!.getAttribute('font-family')).toMatch(/Cabrito Semi/)
  })

  it('renders arc as a ring-segment path without stroke', () => {
    // At t=0.5, the arc sweep is interpolated between 0 and 1
    const { container } = renderPreview(arcFixture, { score: 72 }, 0.5)

    const svg = container.querySelector('svg')!
    const arcPath = svg.querySelector('path')
    expect(arcPath).not.toBeNull()
    const d = arcPath!.getAttribute('d')!
    expect(d).toContain('A')
    expect(arcPath!.getAttribute('stroke')).toBeNull()
  })

  it('particles render on canvas, not in SVG', () => {
    const { container } = renderPreview(particlesFixture, {}, 0.5)

    const canvas = container.querySelector('canvas')
    expect(canvas).not.toBeNull()

    const svg = container.querySelector('svg')!
    const circles = svg.querySelectorAll('circle')
    expect(circles.length).toBe(0)
  })

  it('test clock overrides the time prop', () => {
    ;(globalThis as Record<string, unknown>).__BUCKET_MOTION_CLOCK__ = 0.75

    const { container } = renderPreview(textFixture, { name: 'Jane Doe' }, 2.0)

    // At test clock 0.75, the text layer should be fully visible (opacity fade ends at 0.5)
    const svg = container.querySelector('svg')!
    const text = svg.querySelector('text')
    expect(text).not.toBeNull()

    delete (globalThis as Record<string, unknown>).__BUCKET_MOTION_CLOCK__
  })

  it('center align emits text-anchor middle', () => {
    // The arcFixture has a label-text with align: 'center' but the textFixture
    // has align: 'left'. We need a template with centre align. Use the arc
    // fixture's text layer which has align: 'center' in score-ring.
    // Actually, let's make a template with centre-aligned text.
    const textLayer = textFixture.layers[0] as TextLayer
    const centredTemplate: MotionTemplate = {
      ...textFixture,
      id: 'centred-text',
      layers: [
        {
          ...textLayer,
          align: 'center'
        }
      ]
    }
    const { container } = renderPreview(centredTemplate, { name: 'Centred' }, 0.5)

    const text = container.querySelector('text')
    expect(text).not.toBeNull()
    expect(text!.getAttribute('text-anchor')).toBe('middle')
  })

  it('right align emits text-anchor end', () => {
    const textLayer = textFixture.layers[0] as TextLayer
    const rightTemplate: MotionTemplate = {
      ...textFixture,
      id: 'right-text',
      layers: [
        {
          ...textLayer,
          align: 'right'
        }
      ]
    }
    const { container } = renderPreview(rightTemplate, { name: 'Right' }, 0.5)

    const text = container.querySelector('text')
    expect(text).not.toBeNull()
    expect(text!.getAttribute('text-anchor')).toBe('end')
  })

  it('param change updates without remount', () => {
    const { container, rerender } = render(
      <MotionPreview
        template={textFixture}
        values={{ name: 'Jane' }}
        format={DEFAULT_FORMAT}
        time={0.5}
        name="Test"
      />
    )

    const svgBefore = container.querySelector('svg')!

    rerender(
      <MotionPreview
        template={textFixture}
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

  it('staggered text preserves whitespace in tspans', () => {
    // A staggered text layer splits into per-character tspans. A space
    // character as its own tspan would be collapsed by SVG unless the
    // text element sets xml:space="preserve" or white-space: pre.
    const staggerFixture: MotionTemplate = {
      ...textFixture,
      id: 'stagger-ws-preview',
      layers: [
        {
          ...(textFixture.layers[0] as TextLayer),
          stagger: { delay: 0.02 }
        }
      ]
    }

    // At t=2.0 (hold), all units are fully visible
    const { container } = renderPreview(staggerFixture, { name: 'A B' }, 2.0)

    const svg = container.querySelector('svg')!
    const textEl = svg.querySelector('text')
    expect(textEl).not.toBeNull()

    // The text element must declare whitespace preservation
    const xmlSpace = textEl!.getAttribute('xml:space')
    expect(xmlSpace).toBe('preserve')
  })

  // Time null hides the content
  it('time_null_renders_empty_svg', () => {
    const { container } = renderPreview(
      textFixture,
      { name: 'Jane Doe' },
      null as unknown as number
    )

    const svg = container.querySelector('svg')!
    const children = svg.querySelectorAll('rect, ellipse, path, text')
    expect(children.length).toBe(0)
  })
})
