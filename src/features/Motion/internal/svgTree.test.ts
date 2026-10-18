/**
 * Tests for the shared SVG tree builder (issue #341)
 *
 * Guards the behavioural contracts: particle filtering, zero-sweep arc
 * elision, layer ordering, unescaped storage, and stagger/multiline
 * line-break structure. Shape-level attribute tests are covered by the
 * parity test (frameRenderer.test.ts) which runs every built-in and
 * fixture through both adapters.
 */
import { describe, expect, it } from 'vitest'
import type { LayerState, TextLayerState } from '../types'
import { buildSvgTree, type SvgElement } from './svgTree'

const IDENTITY: [number, number, number, number, number, number] = [1, 0, 0, 1, 0, 0]

/** Type guard: is this node an SvgElement (not a string)? */
function isElement(node: unknown): node is SvgElement {
  return typeof node === 'object' && node !== null && 'tag' in node
}

describe('buildSvgTree', () => {
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

  it('returns empty for arc with zero sweep', () => {
    expect(
      buildSvgTree([
        {
          kind: 'arc',
          id: 'ring',
          matrix: IDENTITY,
          opacity: 1,
          fill: '#ff3366',
          arc: { innerRadius: 400, outerRadius: 480, sweep: 0, startAngle: 0 }
        }
      ])
    ).toHaveLength(0)
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
    expect(el.children[0]).toBe('<script>')
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

    // All three units become tspan children (space is not collapsed)
    const tspans = el.children.filter(isElement)
    expect(tspans).toHaveLength(3)
    expect(tspans[1].children).toEqual([' '])
  })

  it('builds multiline text with tspan per line and dy on subsequent lines', () => {
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
    // First line has no dy, second has dy = lineHeight * fontSize
    expect(tspans[0].attrs.dy).toBeUndefined()
    expect(tspans[1].attrs.dy).toBe(String(1.2 * 80))
  })
})
