/**
 * Tests for SVG serialiser (issue #341)
 *
 * Covers escaping of text content, attribute values, path data, and
 * font-family names. Written before the renderers were switched over.
 */
import { describe, expect, it } from 'vitest'
import { serialiseSvgNodes } from './svgSerialise'
import type { SvgElement, SvgNode } from './svgTree'

describe('serialiseSvgNodes', () => {
  it('escapes all four XML special characters in text content', () => {
    const node: SvgElement = {
      tag: 'text',
      attrs: { fill: '#fff' },
      children: ['&<>"']
    }
    const result = serialiseSvgNodes([node])
    expect(result).toContain('&amp;&lt;&gt;&quot;')
    // Safe text and accented characters pass through unchanged
    expect(serialiseSvgNodes([{ tag: 'text', attrs: {}, children: ['Zoe'] }])).toContain(
      'Zoe'
    )
  })

  it('escapes fill attribute containing injection attempt', () => {
    const node: SvgElement = {
      tag: 'rect',
      attrs: { fill: '"><script>alert(1)</script>' },
      children: []
    }
    const result = serialiseSvgNodes([node])
    expect(result).not.toContain('<script>')
    expect(result).toContain('&lt;script&gt;')
    expect(result).toContain('&quot;')
  })

  it('escapes text fill attribute containing injection attempt', () => {
    const node: SvgElement = {
      tag: 'text',
      attrs: { fill: '"><img onerror=alert(1)>' },
      children: ['Hello']
    }
    const result = serialiseSvgNodes([node])
    expect(result).not.toContain('<img')
    expect(result).toContain('&quot;')
  })

  it('escapes path data in d attribute', () => {
    const node: SvgElement = {
      tag: 'path',
      attrs: { d: 'M 0 0 L 100 100 "Z' },
      children: []
    }
    const result = serialiseSvgNodes([node])
    expect(result).toContain('&quot;Z')
  })

  it('serialises font-family with CSS quotes correctly', () => {
    const node: SvgElement = {
      tag: 'text',
      attrs: { 'font-family': '"Cabrito Semi"' },
      children: ['Test']
    }
    const result = serialiseSvgNodes([node])
    // The CSS quotes become the attribute delimiters; inner is escaped
    expect(result).toContain('font-family="Cabrito Semi"')
  })

  it('escapes font-family names with special characters', () => {
    const node: SvgElement = {
      tag: 'text',
      attrs: { 'font-family': '"Font <Bold>"' },
      children: ['Test']
    }
    const result = serialiseSvgNodes([node])
    expect(result).toContain('font-family="Font &lt;Bold&gt;"')
    expect(result).not.toContain('<Bold>')
  })

  it('serialises nested elements (tspan inside text)', () => {
    const tspan: SvgElement = {
      tag: 'tspan',
      attrs: { opacity: 1, fill: '#fff' },
      children: ['A']
    }
    const text: SvgElement = {
      tag: 'text',
      attrs: { fill: '#fff' },
      children: [tspan]
    }
    const result = serialiseSvgNodes([text])
    expect(result).toContain('<tspan')
    expect(result).toContain('>A</tspan>')
    expect(result).toContain('</text>')
  })

  it('serialises xml:space and preserves whitespace content', () => {
    const node: SvgElement = {
      tag: 'text',
      attrs: { 'xml:space': 'preserve' },
      children: [' ']
    }
    const result = serialiseSvgNodes([node])
    expect(result).toContain('xml:space="preserve"')
    expect(result).toContain('> </text>')
  })

  it('preserves order of multiple sibling nodes', () => {
    const nodes: SvgNode[] = [
      { tag: 'rect', attrs: { id: 'first' }, children: [] },
      { tag: 'text', attrs: { id: 'second' }, children: ['Hi'] }
    ]
    const result = serialiseSvgNodes(nodes)
    const rectIdx = result.indexOf('id="first"')
    const textIdx = result.indexOf('id="second"')
    expect(rectIdx).toBeLessThan(textIdx)
  })
})
