/**
 * ES3 ASCII string escaping for After Effects ExtendScript output (issue #329)
 *
 * Every non-ASCII character is emitted as \uXXXX (including U+2028 and U+2029).
 * Astral code points are emitted as their two surrogate escapes.
 * Standard JS escapes handle \, ", ', \n, \r, \t and C0 controls.
 */

/**
 * Escape a string for use as an ES3 string literal (without wrapping quotes).
 * Every character with code > 0x7F is emitted as \\uXXXX.
 * Astral code points become two \\uXXXX surrogate pairs.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function escapeES3(input: string): string {
  throw new Error('Not implemented')
}

/**
 * Wrap a string as a complete ES3 string literal (double-quoted).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function jsStringLiteral(input: string): string {
  throw new Error('Not implemented')
}
