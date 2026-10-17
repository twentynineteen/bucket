import { describe, expect, it } from 'vitest'
import { parseHexColour } from './colour'

describe('parseHexColour', () => {
  it('parses a 6-digit hex colour', () => {
    expect(parseHexColour('#ff8040')).toEqual([255, 128, 64])
  })

  it('parses black', () => {
    expect(parseHexColour('#000000')).toEqual([0, 0, 0])
  })

  it('parses white', () => {
    expect(parseHexColour('#ffffff')).toEqual([255, 255, 255])
  })

  it('parses an 8-digit hex colour (ignoring alpha)', () => {
    expect(parseHexColour('#ff8040cc')).toEqual([255, 128, 64])
  })

  it('parses uppercase hex digits', () => {
    expect(parseHexColour('#AABB00')).toEqual([170, 187, 0])
  })

  it('returns NaN for a string with no valid hex digits after the hash', () => {
    const [r] = parseHexColour('#zzzzzz')
    expect(Number.isNaN(r)).toBe(true)
  })
})
