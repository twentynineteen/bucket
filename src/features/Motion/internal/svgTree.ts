/**
 * Shared SVG node tree for Motion preview and frame renderer (issue #341)
 *
 * A pure function that builds a typed SVG tree from evaluated layer states.
 * Both renderers consume this single tree: the preview maps it to React
 * elements, the frame renderer serialises it to an escaped SVG string.
 *
 * Adding a new layer kind touches only this file.
 */
import type { LayerState, ShapeLayerState, StaggerUnit, TextLayerState } from '../types'
import { staggerLineBreaks } from './staggerLineBreaks'
import { arcPath, matrixStr } from './svgGeometry'

// ---------------------------------------------------------------------------
// Node types
// ---------------------------------------------------------------------------

/**
 * Attribute map for an SVG element node.
 *
 * Uses SVG-native names (hyphenated: `font-family`, `text-anchor`,
 * `xml:space`). Values are stored unescaped - the serialiser handles
 * escaping, while the React adapter converts names to camelCase props.
 *
 * Never put `style` in attrs - React throws when it receives a style
 * string instead of an object.
 */
export type SvgAttrs = Record<string, string | number>

export interface SvgElement {
  tag: string
  attrs: SvgAttrs
  children: SvgNode[]
}

/** A node is either an element or a text content string. */
export type SvgNode = SvgElement | string

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Exhaustiveness check: the compiler proves this is never called. */
function assertNever(x: never): never {
  throw new Error(`Unexpected layer kind: ${(x as { kind: string }).kind}`)
}

function alignToAnchor(align: 'left' | 'center' | 'right'): string {
  switch (align) {
    case 'center':
      return 'middle'
    case 'right':
      return 'end'
    default:
      return 'start'
  }
}

// ---------------------------------------------------------------------------
// Layer builders
// ---------------------------------------------------------------------------

function buildShape(state: ShapeLayerState): SvgNode | null {
  const transform = matrixStr(state.matrix)

  if (state.kind === 'rect' && state.size) {
    return {
      tag: 'rect',
      attrs: {
        x: '0',
        y: '0',
        width: state.size.w,
        height: state.size.h,
        rx: state.radius ?? 0,
        fill: state.fill,
        opacity: state.opacity,
        transform
      },
      children: []
    }
  }

  if (state.kind === 'ellipse') {
    return {
      tag: 'ellipse',
      attrs: {
        cx: '0',
        cy: '0',
        rx: state.radii?.rx ?? 0,
        ry: state.radii?.ry ?? 0,
        fill: state.fill,
        opacity: state.opacity,
        transform
      },
      children: []
    }
  }

  if (state.kind === 'path' && state.d) {
    return {
      tag: 'path',
      attrs: {
        d: state.d,
        fill: state.fill,
        opacity: state.opacity,
        transform
      },
      children: []
    }
  }

  if (state.kind === 'arc' && state.arc) {
    const { innerRadius, outerRadius, sweep, startAngle } = state.arc
    const d = arcPath(0, 0, innerRadius, outerRadius, startAngle, sweep)
    if (!d) return null
    return {
      tag: 'path',
      attrs: {
        d,
        fill: state.fill,
        opacity: state.opacity,
        transform
      },
      children: []
    }
  }

  assertNever(state.kind as never)
}

function buildStaggerTspan(
  unit: StaggerUnit,
  dy: number,
  lineAdvance: number
): SvgElement | null {
  if (dy === -1) return null

  const attrs: SvgAttrs = {
    opacity: unit.opacity,
    fill: unit.fill
  }
  if (dy > 0) {
    attrs.x = '0'
    attrs.dy = String(dy * lineAdvance)
  }

  return { tag: 'tspan', attrs, children: [unit.text] }
}

function buildText(state: TextLayerState): SvgElement {
  const transform = matrixStr(state.matrix)
  // CSS quotes wrap the family name so both renderers produce byte-identical
  // output regardless of whether the name contains spaces.
  const fontFamily = `"${state.font.family}"`
  const textAnchor = alignToAnchor(state.align)

  // Shared base attrs for all three text branches
  const base: SvgAttrs = {
    'font-family': fontFamily,
    'font-size': state.font.size,
    fill: state.fill,
    opacity: state.opacity,
    'text-anchor': textAnchor,
    transform
  }

  // Staggered text: each unit is its own tspan
  if (state.units && state.units.length > 0) {
    const lineAdvance = state.lineHeight * state.font.size
    const breaks = staggerLineBreaks(state.units)

    const children: SvgNode[] = []
    for (let i = 0; i < state.units.length; i++) {
      const node = buildStaggerTspan(state.units[i], breaks[i], lineAdvance)
      if (node) children.push(node)
    }

    return {
      tag: 'text',
      attrs: { ...base, 'xml:space': 'preserve' },
      children
    }
  }

  // Multiline text: one tspan per line
  if (state.multiline && state.text.includes('\n')) {
    const lines = state.text.split('\n')
    const lineAdvance = state.lineHeight * state.font.size

    const children: SvgNode[] = lines.map((line, i) => {
      const attrs: SvgAttrs = { x: '0' }
      if (i > 0) attrs.dy = String(lineAdvance)
      return { tag: 'tspan' as const, attrs, children: [line] }
    })

    return { tag: 'text', attrs: base, children }
  }

  // Plain text
  return { tag: 'text', attrs: base, children: [state.text] }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build the SVG node tree for the vector layers of a frame.
 * Particle layers are skipped (they render on a canvas overlay).
 *
 * Returns one node per visible vector layer, in the same order as the
 * input states.
 */
export function buildSvgTree(states: LayerState[]): SvgNode[] {
  const nodes: SvgNode[] = []

  for (const state of states) {
    switch (state.kind) {
      case 'particles':
        continue
      case 'text':
        nodes.push(buildText(state))
        break
      case 'rect':
      case 'ellipse':
      case 'path':
      case 'arc': {
        const node = buildShape(state)
        if (node) nodes.push(node)
        break
      }
      default:
        assertNever(state)
    }
  }

  return nodes
}
