/**
 * Lua string escaping tests (issue #330)
 *
 * RES1.2: control character escaping
 * RES1.3: UTF-8 roundtrip through luaparse pseudo-latin1
 */
import * as luaparse from 'luaparse'
import { describe, expect, it } from 'vitest'
import { escapingStrings } from '../../testing/fixtures'
import { escapeLuaString } from './luaString'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Encode a JS string's UTF-8 bytes as latin1 characters (one char per byte). */
function utf8ToLatin1(text: string): string {
  const encoder = new TextEncoder()
  const bytes = encoder.encode(text)
  return Array.from(bytes, b => String.fromCharCode(b)).join('')
}

/** Decode latin1 characters back to a UTF-8 string. */
function latin1ToUtf8(text: string): string {
  const bytes = new Uint8Array(text.split('').map(c => c.charCodeAt(0)))
  return new TextDecoder().decode(bytes)
}

/**
 * Parse a Lua string literal and extract the string value.
 * Wraps the escaped string in `return "..."`, parses with luaparse,
 * and returns the StringLiteral's value.
 */
function parseLuaString(escaped: string): string {
  const code = `return "${escaped}"`
  const ast = luaparse.parse(code, {
    luaVersion: '5.1',
    encodingMode: 'pseudo-latin1'
  })
  const ret = ast.body[0]
  if (ret.type !== 'ReturnStatement') throw new Error('Expected ReturnStatement')
  const lit = ret.arguments[0]
  if (lit.type !== 'StringLiteral') throw new Error('Expected StringLiteral')
  return lit.value
}

/**
 * Roundtrip: escape -> encode as latin1 -> parse with pseudo-latin1 -> decode back.
 * Returns the recovered string.
 */
function roundtrip(original: string): string {
  const escaped = escapeLuaString(original)
  const latin1Escaped = utf8ToLatin1(escaped)
  const parsed = parseLuaString(latin1Escaped)
  return latin1ToUtf8(parsed)
}

// ---------------------------------------------------------------------------
// RES1.2: control character escaping
// ---------------------------------------------------------------------------

describe('RES1.2: Lua string escaping', () => {
  it('escapes backslash to \\\\', () => {
    expect(escapeLuaString('\\')).toBe('\\\\')
  })

  it('escapes double quote to \\"', () => {
    expect(escapeLuaString('"')).toBe('\\"')
  })

  it('escapes newline to \\010', () => {
    expect(escapeLuaString('\n')).toBe('\\010')
  })

  it('escapes tab to \\009', () => {
    expect(escapeLuaString('\t')).toBe('\\009')
  })

  it('escapes U+0001 (SOH) to \\001', () => {
    expect(escapeLuaString('\u0001')).toBe('\\001')
  })
})

// ---------------------------------------------------------------------------
// RES1.3: UTF-8 roundtrip through luaparse pseudo-latin1
// ---------------------------------------------------------------------------

describe('RES1.3: UTF-8 roundtrip', () => {
  it('roundtrips accented Latin text', () => {
    expect(roundtrip(escapingStrings.accents)).toBe(escapingStrings.accents)
  })

  it('roundtrips Arabic RTL text', () => {
    expect(roundtrip(escapingStrings.rtl)).toBe(escapingStrings.rtl)
  })

  it('roundtrips ZWJ emoji', () => {
    expect(roundtrip(escapingStrings.emoji)).toBe(escapingStrings.emoji)
  })

  it('roundtrips double bracket ]]', () => {
    expect(roundtrip(escapingStrings.doubleBracket)).toBe(escapingStrings.doubleBracket)
  })
})
