/**
 * Tests for ES3 ASCII string escaping (issue #329)
 *
 * Behaviours: AE1.2, AE1.3
 */
import * as espree from 'espree'
import { describe, expect, it } from 'vitest'
import { escapingStrings } from '../../testing/fixtures'
import { escapeES3, jsStringLiteral } from './jsString'

// ---------------------------------------------------------------------------
// AE1.2 - Non-ASCII escaping
// ---------------------------------------------------------------------------

describe('AE1.2 - non-ASCII escaping', () => {
  it('escapes accented latin (Zoe Angstrom) to \\uXXXX sequences', () => {
    const result = escapeES3('Zoë Ångström')
    // Every character code in output is <= 0x7F
    for (let i = 0; i < result.length; i++) {
      expect(result.charCodeAt(i)).toBeLessThanOrEqual(0x7f)
    }
    // e-diaeresis appears as the six characters ë
    expect(result).toContain('\\u00eb')
  })

  it('escapes U+2028 as \\u2028 and U+2029 as \\u2029', () => {
    const result = escapeES3('  ')
    expect(result).toContain('\\u2028')
    expect(result).toContain('\\u2029')
    for (let i = 0; i < result.length; i++) {
      expect(result.charCodeAt(i)).toBeLessThanOrEqual(0x7f)
    }
  })

  it('escapes an astral emoji as two surrogate escapes', () => {
    // U+1F389 party popper -> 🎉
    const result = escapeES3('\u{1F389}')
    expect(result).toContain('\\ud83c')
    expect(result).toContain('\\udf89')
    for (let i = 0; i < result.length; i++) {
      expect(result.charCodeAt(i)).toBeLessThanOrEqual(0x7f)
    }
  })

  it('keeps ASCII printable characters unchanged', () => {
    expect(escapeES3('Hello World 123')).toBe('Hello World 123')
  })
})

// ---------------------------------------------------------------------------
// AE1.3 - Round-trip through espree AST
// ---------------------------------------------------------------------------

describe('AE1.3 - round-trip escaping through espree', () => {
  const cases: [string, string][] = [
    ['accents', escapingStrings.accents],
    ['emoji', escapingStrings.emoji],
    ['rtl', escapingStrings.rtl],
    ['doubleQuote', escapingStrings.doubleQuote],
    ['singleQuote', escapingStrings.singleQuote],
    ['backslash', escapingStrings.backslash],
    ['doubleBracket', escapingStrings.doubleBracket],
    ['newline', escapingStrings.newline],
    ['lineSeparator', escapingStrings.lineSeparator],
    ['paragraphSeparator', escapingStrings.paragraphSeparator],
    ['c0Control', escapingStrings.c0Control]
  ]

  it.each(cases)('round-trips %s through espree at ecmaVersion 3', (_label, original) => {
    const literal = jsStringLiteral(original)

    // Must parse as ES3
    const ast = espree.parse('var x = ' + literal, { ecmaVersion: 3 })

    // Extract the string value from the AST
    const decl = (ast as { body: { declarations: { init: { value: string } }[] }[] })
      .body[0].declarations[0].init
    expect(decl.value).toBe(original)
  })
})
