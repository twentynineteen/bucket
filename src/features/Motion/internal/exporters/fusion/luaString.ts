/**
 * Lua string escaping for Fusion .setting files (issue #330)
 *
 * Escapes a JavaScript string for use inside a double-quoted Lua string literal.
 * Control characters (0x00-0x1F) become decimal escapes (\ddd).
 * Backslash becomes \\, double-quote becomes \".
 * Other UTF-8 (including ]], accents, emoji, RTL) passes through unchanged.
 *
 * Lua 5.1 strings: \ddd where ddd is up to three decimal digits for the byte.
 */

/**
 * Escape a string for a double-quoted Lua string literal.
 *
 * The result does NOT include the surrounding quotes.
 */
export function escapeLuaString(s: string): string {
  let out = ''
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    const code = s.charCodeAt(i)

    if (ch === '\\') {
      out += '\\\\'
    } else if (ch === '"') {
      out += '\\"'
    } else if (code < 0x20) {
      // Control characters -> \ddd (three-digit decimal, zero-padded)
      out += '\\' + String(code).padStart(3, '0')
    } else {
      // Everything else (including UTF-8 multi-byte characters) passes through
      out += ch
    }
  }
  return out
}
