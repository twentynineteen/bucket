/**
 * React adapter for the SVG node tree (issue #341)
 *
 * Maps SvgNode[] to React elements for MotionPreview. Converts
 * SVG-native attribute names to React camelCase props using a generic
 * rule (camelCase on hyphens, xml:space -> xmlSpace) so new attributes
 * added to svgTree.ts need no registry entry here.
 */
import React from 'react'
import type { SvgElement, SvgNode } from './svgTree'

// ---------------------------------------------------------------------------
// Attribute name conversion: SVG hyphenated -> React camelCase
// ---------------------------------------------------------------------------

/**
 * Convert an SVG attribute name to its React prop name.
 *
 * Rules:
 *  - Hyphenated names camelCase on each hyphen: font-family -> fontFamily
 *  - xml:space is React's xmlSpace (the only xml:-prefixed attr we emit)
 *  - Everything else passes through unchanged (fill, opacity, transform, ...)
 */
function svgAttrToReactProp(name: string): string {
  // Handle xml: namespace prefix
  if (name === 'xml:space') return 'xmlSpace'

  // Hyphenated names: camelCase on each hyphen
  if (name.includes('-')) {
    return name.replace(/-([a-z])/g, (_, ch: string) => ch.toUpperCase())
  }

  return name
}

function toReactProps(attrs: Record<string, string | number>): Record<string, unknown> {
  const props: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(attrs)) {
    props[svgAttrToReactProp(key)] = value
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
