/**
 * Custom theme validation tests
 *
 * B2.1 - an invalid theme definition returns its validation error instead of throwing.
 */

import { describe, expect, it } from 'vitest'

import { validateCustomTheme } from './customTheme'

describe('validateCustomTheme (B2)', () => {
  it('returns the offending path and message instead of throwing (B2.1)', () => {
    const result = validateCustomTheme({
      id: 'mine',
      name: 42,
      isDark: false,
      colors: {}
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('name')
  })

  it('accepts a well-formed theme definition', () => {
    const result = validateCustomTheme({
      id: 'mine',
      name: 'Mine',
      isDark: false,
      colors: { background: '220 13% 91%' }
    })

    expect(result.success).toBe(true)
    expect(result.theme?.name).toBe('Mine')
  })
})
