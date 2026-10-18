/**
 * Tests for the React SVG adapter (issue #341)
 *
 * Verifies that svgNodesToReact maps the SvgNode tree to React elements
 * with the correct camelCase prop names, and that the rendered HTML
 * contains the expected SVG attributes.
 */
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { svgNodesToReact } from './svgToReact'
import type { SvgElement } from './svgTree'

describe('svgNodesToReact', () => {
  it('maps font-family to fontFamily', () => {
    const node: SvgElement = {
      tag: 'text',
      attrs: { 'font-family': '"Cabrito Semi"', 'font-size': 80 },
      children: ['Test']
    }
    const elements = svgNodesToReact([node])
    const html = renderToStaticMarkup(React.createElement('svg', null, ...elements))
    expect(html).toContain('font-family')
    expect(html).toContain('font-size')
  })

  it('maps text-anchor to textAnchor', () => {
    const node: SvgElement = {
      tag: 'text',
      attrs: { 'text-anchor': 'middle' },
      children: ['Hi']
    }
    const elements = svgNodesToReact([node])
    const html = renderToStaticMarkup(React.createElement('svg', null, ...elements))
    expect(html).toContain('text-anchor="middle"')
  })

  it('maps xml:space to xmlSpace', () => {
    const node: SvgElement = {
      tag: 'text',
      attrs: { 'xml:space': 'preserve' },
      children: [' ']
    }
    const elements = svgNodesToReact([node])
    const html = renderToStaticMarkup(React.createElement('svg', null, ...elements))
    expect(html).toContain('xml:space="preserve"')
  })

  it('renders nested tspan elements', () => {
    const tspan: SvgElement = {
      tag: 'tspan',
      attrs: { opacity: 0.5, fill: '#ff0000' },
      children: ['A']
    }
    const text: SvgElement = {
      tag: 'text',
      attrs: { fill: '#fff' },
      children: [tspan]
    }
    const elements = svgNodesToReact([text])
    const html = renderToStaticMarkup(React.createElement('svg', null, ...elements))
    expect(html).toContain('<tspan')
    expect(html).toContain('>A</tspan>')
  })

  it('renders self-closing elements', () => {
    const node: SvgElement = {
      tag: 'rect',
      attrs: { x: '0', y: '0', width: 100, height: 50 },
      children: []
    }
    const elements = svgNodesToReact([node])
    const html = renderToStaticMarkup(React.createElement('svg', null, ...elements))
    expect(html).toContain('<rect')
    expect(html).toContain('width="100"')
  })

  it('preserves order of multiple nodes', () => {
    const nodes: SvgElement[] = [
      { tag: 'rect', attrs: { id: 'first' }, children: [] },
      { tag: 'text', attrs: { id: 'second' }, children: ['Hi'] }
    ]
    const elements = svgNodesToReact(nodes)
    const html = renderToStaticMarkup(React.createElement('svg', null, ...elements))
    const firstIdx = html.indexOf('id="first"')
    const secondIdx = html.indexOf('id="second"')
    expect(firstIdx).toBeLessThan(secondIdx)
  })
})
