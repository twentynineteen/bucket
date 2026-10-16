/**
 * Lua string escaping for Fusion .setting files (issue #330)
 *
 * Escapes a JavaScript string for use inside a double-quoted Lua string literal.
 * Control characters become decimal escapes (\ddd). UTF-8 passes through unchanged.
 */

 
/** Escape a string for a double-quoted Lua string literal. */
export function escapeLuaString(s: string): string {
  void s
  throw new Error('Not implemented')
}
