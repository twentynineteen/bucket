/**
 * React adapter for the SVG node tree (issue #341)
 *
 * Maps SvgNode[] to React elements for MotionPreview. Converts
 * SVG-native attribute names to React camelCase props.
 */
import React from 'react'
import type { SvgElement, SvgNode } from './svgTree'

// ---------------------------------------------------------------------------
// Attribute name mapping: SVG hyphenated -> React camelCase
// ---------------------------------------------------------------------------

const ATTR_MAP: Record<string, string> = {
  'font-family': 'fontFamily',
  'font-size': 'fontSize',
  'text-anchor': 'textAnchor',
  'xml:space': 'xmlSpace',
  'text-rendering': 'textRendering'
}

function toReactProps(attrs: Record<string, string | number>): Record<string, unknown> {
  const props: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(attrs)) {
    const reactKey = ATTR_MAP[key] ?? key
    props[reactKey] = value
  }
  return props
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function elementToReact(node: SvgElement, key: number): React.ReactElement {
  const props = toReactProps(node.attrs)
  const children = node.children.map((child, i) => {
    if (typeof child === 'string') return child
    return elementToReact(child, i)
  })

  return React.createElement(node.tag, { key, ...props }, ...children)
}

/**
 * Convert an array of SvgNode (from buildSvgTree) to React elements.
 * String nodes are returned as-is (React handles text content).
 */
export function svgNodesToReact(nodes: SvgNode[]): React.ReactNode[] {
  return nodes.map((node, i) => {
    if (typeof node === 'string') return node
    return elementToReact(node, i)
  })
}
