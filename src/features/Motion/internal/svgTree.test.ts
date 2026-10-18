/**
 * Tests for the shared SVG tree builder (issue #341)
 *
 * Verifies that buildSvgTree produces the correct tree structure for
 * every layer kind. Particles are skipped, arcs with zero sweep return
 * null, and attribute values are stored unescaped.
 */
import { describe, expect, it } from 'vitest'
import type { LayerState, ShapeLayerState, TextLayerState } from '../types'
import { buildSvgTree, type SvgElement } from './svgTree'

const IDENTITY: [number, number, number, number, number, number] = [1, 0, 0, 1, 0, 0]

/** Type guard: is this node an SvgElement (not a string)? */
function isElement(node: unknown): node is SvgElement {
  return typeof node === 'object' && node !== null && 'tag' in node
}

describe('buildSvgTree', () => {
  it('returns empty array for no states', () => {
    expect(buildSvgTree([])).toEqual([])
  })

  it('skips particle layers', () => {
    const states: LayerState[] = [
      {
        kind: 'particles',
        id: 'p1',
        matrix: IDENTITY,
        opacity: 1,
        points: [],
        pointRadius: 4
      }
    ]
    expect(buildSvgTree(states)).toEqual([])
  })

  it('builds a rect element with correct attributes', () => {
    const state: ShapeLayerState = {
      kind: 'rect',
      id: 'bg',
      matrix: [1, 0, 0, 1, 100, 200],
      opacity: 0.8,
      fill: '#ff3366',
      size: { w: 500, h: 200 },
      radius: 12
    }
    const nodes = buildSvgTree([state])
    expect(nodes).toHaveLength(1)

    const el = nodes[0] as SvgElement
    expect(el.tag).toBe('rect')
    expect(el.attrs.width).toBe(500)
    expect(el.attrs.height).toBe(200)
    expect(el.attrs.rx).toBe(12)
    expect(el.attrs.fill).toBe('#ff3366')
    expect(el.attrs.opacity).toBe(0.8)
  })

  it('builds an ellipse element', () => {
    const state: ShapeLayerState = {
      kind: 'ellipse',
      id: 'dot',
      matrix: IDENTITY,
      opacity: 1,
      fill: '#00ff00',
      radii: { rx: 50, ry: 30 }
    }
    const nodes = buildSvgTree([state])
    const el = nodes[0] as SvgElement
    expect(el.tag).toBe('ellipse')
    expect(el.attrs.rx).toBe(50)
    expect(el.attrs.ry).toBe(30)
  })

  it('builds a path element with d attribute', () => {
    const state: ShapeLayerState = {
      kind: 'path',
      id: 'tri',
      matrix: IDENTITY,
      opacity: 1,
      fill: '#0000ff',
      d: 'M 0 0 L 100 100 Z'
    }
    const nodes = buildSvgTree([state])
    const el = nodes[0] as SvgElement
    expect(el.tag).toBe('path')
    expect(el.attrs.d).toBe('M 0 0 L 100 100 Z')
  })

  it('builds an arc as a path element', () => {
    const state: ShapeLayerState = {
      kind: 'arc',
      id: 'ring',
      matrix: IDENTITY,
      opacity: 1,
      fill: '#ff3366',
      arc: { innerRadius: 400, outerRadius: 480, sweep: 0.5, startAngle: 0 }
    }
    const nodes = buildSvgTree([state])
    const el = nodes[0] as SvgElement
    expect(el.tag).toBe('path')
    expect(typeof el.attrs.d).toBe('string')
    expect((el.attrs.d as string).length).toBeGreaterThan(0)
  })

  it('returns empty for arc with zero sweep', () => {
    const state: ShapeLayerState = {
      kind: 'arc',
      id: 'ring',
      matrix: IDENTITY,
      opacity: 1,
      fill: '#ff3366',
      arc: { innerRadius: 400, outerRadius: 480, sweep: 0, startAngle: 0 }
    }
    const nodes = buildSvgTree([state])
    expect(nodes).toHaveLength(0)
  })

  it('builds plain text with font attributes', () => {
    const state: TextLayerState = {
      kind: 'text',
      id: 't1',
      matrix: IDENTITY,
      opacity: 1,
      fill: '#ffffff',
      text: 'Hello',
      font: { family: 'Cabrito Semi', style: 'Norm Bold', size: 80 },
      align: 'center',
      lineHeight: 1.2,
      multiline: false,
      tracking: 0
    }
    const nodes = buildSvgTree([state])
    const el = nodes[0] as SvgElement
    expect(el.tag).toBe('text')
    expect(el.attrs['font-family']).toBe('"Cabrito Semi"')
    expect(el.attrs['font-size']).toBe(80)
    expect(el.attrs['text-anchor']).toBe('middle')
    expect(el.children).toEqual(['Hello'])
  })

  it('builds staggered text with tspan children and xml:space', () => {
    const state: TextLayerState = {
      kind: 'text',
      id: 't-ws',
      matrix: IDENTITY,
      opacity: 1,
      fill: '#ffffff',
      text: 'A B',
      font: { family: 'Cabrito Semi', style: 'Norm Bold', size: 80 },
      align: 'left',
      lineHeight: 1.2,
      multiline: false,
      tracking: 0,
      units: [
        { text: 'A', matrix: IDENTITY, opacity: 1, fill: '#ffffff' },
        { text: ' ', matrix: IDENTITY, opacity: 1, fill: '#ffffff' },
        { text: 'B', matrix: IDENTITY, opacity: 1, fill: '#ffffff' }
      ]
    }
    const nodes = buildSvgTree([state])
    const el = nodes[0] as SvgElement
    expect(el.attrs['xml:space']).toBe('preserve')

    // All three units become tspan children
    const tspans = el.children.filter(isElement)
    expect(tspans).toHaveLength(3)
    expect(tspans[1].children).toEqual([' '])
  })

  it('builds multiline text with tspan per line', () => {
    const state: TextLayerState = {
      kind: 'text',
      id: 't-ml',
      matrix: IDENTITY,
      opacity: 1,
      fill: '#ffffff',
      text: 'Line 1\nLine 2',
      font: { family: 'Cabrito Semi', style: 'Norm Bold', size: 80 },
      align: 'left',
      lineHeight: 1.2,
      multiline: true,
      tracking: 0
    }
    const nodes = buildSvgTree([state])
    const el = nodes[0] as SvgElement

    const tspans = el.children.filter(isElement)
    expect(tspans).toHaveLength(2)
    // First line has no dy, second has dy
    expect(tspans[0].attrs.dy).toBeUndefined()
    expect(tspans[1].attrs.dy).toBe(String(1.2 * 80))
  })

  it('preserves layer order', () => {
    const states: LayerState[] = [
      {
        kind: 'rect',
        id: 'bg',
        matrix: IDENTITY,
        opacity: 1,
        fill: '#000',
        size: { w: 100, h: 100 },
        radius: 0
      },
      {
        kind: 'text',
        id: 'label',
        matrix: IDENTITY,
        opacity: 1,
        fill: '#fff',
        text: 'Hi',
        font: { family: 'Arial', style: 'Regular', size: 40 },
        align: 'left',
        lineHeight: 1.2,
        multiline: false,
        tracking: 0
      }
    ]
    const nodes = buildSvgTree(states)
    expect(nodes).toHaveLength(2)
    expect((nodes[0] as SvgElement).tag).toBe('rect')
    expect((nodes[1] as SvgElement).tag).toBe('text')
  })

  it('stores attribute values unescaped (escaping is the serialiser job)', () => {
    const state: TextLayerState = {
      kind: 'text',
      id: 't1',
      matrix: IDENTITY,
      opacity: 1,
      fill: '#fff',
      text: '<script>',
      font: { family: 'Arial', style: 'Regular', size: 40 },
      align: 'left',
      lineHeight: 1.2,
      multiline: false,
      tracking: 0
    }
    const nodes = buildSvgTree([state])
    const el = nodes[0] as SvgElement
    // The text child is unescaped in the tree
    expect(el.children[0]).toBe('<script>')
  })
})
