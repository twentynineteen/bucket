/**
 * Theme Mapper Utility Tests
 *
 * Tests for legacy theme migration utilities.
 */

import { migrateLegacyTheme, isValidThemeId } from '@/utils/themeMapper'
import { describe, expect, it } from 'vitest'

describe('themeMapper', () => {
  describe('migrateLegacyTheme', () => {
    it('migrates "light" to "light"', () => {
      expect(migrateLegacyTheme('light')).toBe('light')
    })

    it('migrates "dark" to "dark"', () => {
      expect(migrateLegacyTheme('dark')).toBe('dark')
    })

    it('migrates "system" to "system"', () => {
      expect(migrateLegacyTheme('system')).toBe('system')
    })

    it('migrates unknown themes to "system"', () => {
      expect(migrateLegacyTheme('unknown')).toBe('system')
      expect(migrateLegacyTheme('invalid-theme')).toBe('system')
      expect(migrateLegacyTheme('')).toBe('system')
    })

    it('handles new themes without migration', () => {
      // New themes don't need migration, but should return system as fallback
      expect(migrateLegacyTheme('dracula')).toBe('system')
      expect(migrateLegacyTheme('catppuccin-mocha')).toBe('system')
    })
  })

  describe('isValidThemeId', () => {
    it('validates built-in theme IDs', () => {
      expect(isValidThemeId('system')).toBe(true)
      expect(isValidThemeId('light')).toBe(true)
      expect(isValidThemeId('dark')).toBe(true)
      expect(isValidThemeId('dracula')).toBe(true)
      expect(isValidThemeId('catppuccin-latte')).toBe(true)
      expect(isValidThemeId('catppuccin-frappe')).toBe(true)
      expect(isValidThemeId('catppuccin-macchiato')).toBe(true)
      expect(isValidThemeId('catppuccin-mocha')).toBe(true)
    })

    it('rejects invalid theme IDs', () => {
      expect(isValidThemeId('unknown')).toBe(false)
      expect(isValidThemeId('nord')).toBe(false)
      expect(isValidThemeId('solarized')).toBe(false)
      expect(isValidThemeId('')).toBe(false)
      expect(isValidThemeId('custom-theme')).toBe(false)
    })

    it('is case-sensitive', () => {
      expect(isValidThemeId('Light')).toBe(false)
      expect(isValidThemeId('DARK')).toBe(false)
      expect(isValidThemeId('Dracula')).toBe(false)
    })
  })
})
