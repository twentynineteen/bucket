import { describe, expect, it } from 'vitest'
import { parseBindPath, resolveBindPath } from './bindPath'

const tree = [
  { id: 'a' },
  {
    id: 'g1',
    children: [{ id: 'b' }, { id: 'g2', children: [{ id: 'c' }, { id: 'd' }] }]
  }
]

describe('bind paths', () => {
  it('parses layers[i](.children[j])* into an index list', () => {
    expect(parseBindPath('layers[0]')).toEqual([0])
    expect(parseBindPath('layers[1].children[1].children[0]')).toEqual([1, 1, 0])
  })

  it('rejects anything else', () => {
    for (const bad of ['', 'layers', 'layers[x]', 'children[0]', 'layers[0].kids[1]', 'layers[0]x', 'layers[-1]']) {
      expect(parseBindPath(bad), bad).toBeNull()
    }
  })

  it('resolves to the node at any depth, including when sibling indices repeat', () => {
    // layers[1].children[1].children[1]: every index is 1, so a resolver that
    // decides "last part" by comparing strings would stop early.
    expect(resolveBindPath(tree, 'layers[1].children[1].children[1]')).toEqual({ id: 'd' })
    expect(resolveBindPath(tree, 'layers[1].children[0]')).toEqual({ id: 'b' })
    expect(resolveBindPath(tree, 'layers[0]')).toEqual({ id: 'a' })
  })

  it('returns null for out-of-range indices or descending through a leaf', () => {
    expect(resolveBindPath(tree, 'layers[5]')).toBeNull()
    expect(resolveBindPath(tree, 'layers[0].children[0]')).toBeNull()
    expect(resolveBindPath(tree, 'layers[1].children[1].children[9]')).toBeNull()
  })
})
