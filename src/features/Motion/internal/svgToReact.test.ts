/**
 * Tests for the React SVG adapter (issue #341)
 *
 * Verifies that svgNodesToReact produces React elements with correctly
 * camelCased prop names. The console.error spy catches React's "Invalid
 * DOM property" warnings, which fire when a hyphenated SVG name is
 * passed as a React prop instead of the camelCase equivalent.
 */
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MotionFormat, MotionTemplate, ParamValues } from '../types'
import { loadBuiltins } from './builtins'
import { evaluate } from './evaluate'
import { resolveTemplate } from './resolve'
import { svgNodesToReact } from './svgToReact'
import { buildSvgTree, type SvgElement } from './svgTree'
import { layerKindFixtures } from './testing/fixtures'

const FORMAT: MotionFormat = { width: 3840, height: 2160, fps: 50 }
const TIMES = [0.15, 0.5, 2.0, 3.5]

function defaultValues(tmpl: MotionTemplate): ParamValues {
  const vals: ParamValues = {}
  for (const [id, def] of Object.entries(tmpl.params)) {
    if ('default' in def) vals[id] = def.default
  }
  return vals
}

function hasVectorLayers(tmpl: MotionTemplate): boolean {
  function check(layers: MotionTemplate['layers']): boolean {
    return layers.some(l => {
      if (l.kind === 'group') return check(l.children)
      return l.kind !== 'particles'
    })
  }
  return check(tmpl.layers)
}

describe('svgNodesToReact', () => {
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

  afterEach(() => {
    errorSpy.mockClear()
  })

  // -------------------------------------------------------------------------
  // Prop-level assertions: verify the React element has the correct
  // camelCase prop names, not just that the markup contains an attribute
  // (which React emits even for invalid prop names, with a console.error).
  // -------------------------------------------------------------------------

  it('converts hyphenated SVG attrs to camelCase React props', () => {
    const node: SvgElement = {
      tag: 'text',
      attrs: {
        'font-family': '"Cabrito Semi"',
        'font-size': 80,
        'text-anchor': 'middle',
        'xml:space': 'preserve'
      },
      children: ['Test']
    }

    const elements = svgNodesToReact([node])
    const el = elements[0] as React.ReactElement<Record<string, unknown>>
    expect(el.props.fontFamily).toBe('"Cabrito Semi"')
    expect(el.props.fontSize).toBe(80)
    expect(el.props.textAnchor).toBe('middle')
    expect(el.props.xmlSpace).toBe('preserve')

    // Must not have the hyphenated forms
    expect(el.props['font-family']).toBeUndefined()
    expect(el.props['font-size']).toBeUndefined()
    expect(el.props['text-anchor']).toBeUndefined()
    expect(el.props['xml:space']).toBeUndefined()
  })

  it('passes through non-hyphenated attrs unchanged', () => {
    const node: SvgElement = {
      tag: 'rect',
      attrs: { fill: '#ff0000', opacity: 0.5, transform: 'matrix(1 0 0 1 0 0)' },
      children: []
    }
    const elements = svgNodesToReact([node])
    const el = elements[0] as React.ReactElement<Record<string, unknown>>
    expect(el.props.fill).toBe('#ff0000')
    expect(el.props.opacity).toBe(0.5)
    expect(el.props.transform).toBe('matrix(1 0 0 1 0 0)')
  })

  // -------------------------------------------------------------------------
  // console.error spy: React emits "Invalid DOM property" for unmapped
  // hyphenated names. This test runs every built-in and every layer-kind
  // fixture through the full pipeline and asserts zero console.error calls.
  // -------------------------------------------------------------------------

  const allFixtures = [...layerKindFixtures, ...loadBuiltins().templates].filter(
    hasVectorLayers
  )

  for (const fixture of allFixtures) {
    for (const t of TIMES) {
      it(`${fixture.id} at t=${t}: no React console.error warnings`, () => {
        const values = defaultValues(fixture)
        const resolved = resolveTemplate(fixture, values, FORMAT)
        const states = evaluate(resolved, t)
        const tree = buildSvgTree(states)
        const elements = svgNodesToReact(tree)

        // Render to static markup - this triggers React's property validation
        renderToStaticMarkup(React.createElement('svg', null, ...elements))

        expect(errorSpy).not.toHaveBeenCalled()
      })
    }
  }
})
