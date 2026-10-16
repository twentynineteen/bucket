/**
 * ES3 ASCII string escaping for After Effects ExtendScript output (issue #329)
 *
 * Every non-ASCII character is emitted as \uXXXX (including U+2028 and U+2029).
 * Astral code points are emitted as their two surrogate escapes.
 * Standard JS escapes handle \, ", ', \n, \r, \t and C0 controls.
 */

/** Pad a hex string to exactly 4 digits. */
function hex4(code: number): string {
  return code.toString(16).padStart(4, '0')
}

/**
 * Escape a string for use as an ES3 string literal (without wrapping quotes).
 * Every character with code > 0x7F is emitted as \\uXXXX.
 * Astral code points become two \\uXXXX surrogate pairs.
 */
export function escapeES3(input: string): string {
  let out = ''
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i)

    if (code === 0x5c) {
      out += '\\\\'
    } else if (code === 0x22) {
      out += '\\"'
    } else if (code === 0x0a) {
      out += '\\n'
    } else if (code === 0x0d) {
      out += '\\r'
    } else if (code === 0x09) {
      out += '\\t'
    } else if (code === 0x08) {
      out += '\\b'
    } else if (code === 0x0c) {
      out += '\\f'
    } else if (code < 0x20) {
      out += '\\u' + hex4(code)
    } else if (code > 0x7e) {
      out += '\\u' + hex4(code)
    } else {
      out += input[i]
    }
  }
  return out
}

/**
 * Wrap a string as a complete ES3 string literal (double-quoted).
 */
export function jsStringLiteral(input: string): string {
  return '"' + escapeES3(input) + '"'
}
