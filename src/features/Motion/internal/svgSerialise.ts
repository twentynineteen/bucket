/**
 * SVG string serialiser for the node tree (issue #341)
 *
 * Serialises SvgNode[] to an SVG string with XML escaping, for the
 * frame renderer. Escaping covers text content, attribute values,
 * path data, and font-family names.
 */
import type { SvgElement, SvgNode } from './svgTree'

// ---------------------------------------------------------------------------
// Escaping
// ---------------------------------------------------------------------------

/**
 * Escape XML special characters in text content and attribute values.
 * Covers &, <, >, and " (the four characters that must be escaped in
 * XML attribute values and text content).
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ---------------------------------------------------------------------------
// Serialisation
// ---------------------------------------------------------------------------

function serialiseAttr(key: string, value: string | number): string {
  // font-family values include CSS-level quotes (e.g. "Cabrito Semi").
  // The existing frame renderer uses those quotes as the XML attribute
  // delimiters, so we reproduce that to keep the output byte-identical.
  const str = String(value)
  if (key === 'font-family' && str.startsWith('"') && str.endsWith('"')) {
    // The inner value (between the CSS quotes) still gets escaped
    const inner = str.slice(1, -1)
    return `${key}="${escapeXml(inner)}"`
  }
  return `${key}="${escapeXml(str)}"`
}

function serialiseElement(el: SvgElement): string {
  const attrs = Object.entries(el.attrs)
    .map(([k, v]) => ` ${serialiseAttr(k, v)}`)
    .join('')

  if (el.children.length === 0) {
    return `<${el.tag}${attrs} />`
  }

  const inner = el.children.map(serialiseNode).join('')
  return `<${el.tag}${attrs}>${inner}</${el.tag}>`
}

function serialiseNode(node: SvgNode): string {
  if (typeof node === 'string') return escapeXml(node)
  return serialiseElement(node)
}

/**
 * Serialise an array of SvgNode (from buildSvgTree) to an SVG string
 * fragment. Does not include the outer `<svg>` wrapper - the caller
 * adds that with width/height/viewBox and any font defs.
 */
export function serialiseSvgNodes(nodes: SvgNode[]): string {
  return nodes.map(serialiseNode).join('')
}
