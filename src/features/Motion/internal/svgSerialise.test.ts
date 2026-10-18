/**
 * Tests for SVG serialiser (issue #341)
 *
 * Covers escaping of text content, attribute values, path data, and
 * font-family names. Written before the renderers were switched over.
 */
import { describe, expect, it } from 'vitest'
import { escapeXml, serialiseSvgNodes } from './svgSerialise'
import type { SvgElement, SvgNode } from './svgTree'

describe('escapeXml', () => {
  it('escapes ampersand', () => {
    expect(escapeXml('a&b')).toBe('a&amp;b')
  })

  it('escapes less-than', () => {
    expect(escapeXml('a<b')).toBe('a&lt;b')
  })

  it('escapes greater-than', () => {
    expect(escapeXml('a>b')).toBe('a&gt;b')
  })

  it('escapes double quote', () => {
    expect(escapeXml('a"b')).toBe('a&quot;b')
  })

  it('handles all four together', () => {
    expect(escapeXml('&<>"')).toBe('&amp;&lt;&gt;&quot;')
  })

  it('passes through safe text unchanged', () => {
    expect(escapeXml('Hello World')).toBe('Hello World')
  })

  it('passes through accented characters', () => {
    expect(escapeXml('Zoe Angstrom')).toBe('Zoe Angstrom')
  })
})

describe('serialiseSvgNodes', () => {
  it('serialises an empty array', () => {
    expect(serialiseSvgNodes([])).toBe('')
  })

  it('serialises a self-closing element', () => {
    const node: SvgElement = {
      tag: 'rect',
      attrs: { x: '0', y: '0', width: 100, height: 50 },
      children: []
    }
    const result = serialiseSvgNodes([node])
    expect(result).toContain('<rect')
    expect(result).toContain('x="0"')
    expect(result).toContain('width="100"')
    expect(result).toContain('/>')
  })

  it('serialises text content with escaping', () => {
    const node: SvgElement = {
      tag: 'text',
      attrs: { fill: '#fff' },
      children: ['Hello <World> & "Friends"']
    }
    const result = serialiseSvgNodes([node])
    expect(result).toContain('Hello &lt;World&gt; &amp; &quot;Friends&quot;')
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

  it('escapes path data in d attribute', () => {
    const node: SvgElement = {
      tag: 'path',
      attrs: { d: 'M 0 0 L 100 100 "Z' },
      children: []
    }
    const result = serialiseSvgNodes([node])
    expect(result).toContain('&quot;Z')
    expect(result).not.toContain('"Z"')
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

  it('serialises xml:space attribute', () => {
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
