/**
 * Theme Constants Tests
 *
 * Tests for theme metadata and helper functions.
 */

import {
  THEMES,
  getAllThemeIds,
  getThemeById,
  getThemesByCategory,
  isCustomTheme,
  getGroupedThemes,
} from '@/constants/themes'
import { describe, expect, it } from 'vitest'

describe('themes constants', () => {
  describe('THEMES registry', () => {
    it('contains all 13 themes', () => {
      const themeIds = Object.keys(THEMES)
      expect(themeIds).toHaveLength(13)
      expect(themeIds).toEqual([
        'system',
        'light',
        'dark',
        'dracula',
        'tokyo-night',
        'catppuccin-latte',
        'catppuccin-frappe',
        'catppuccin-macchiato',
        'catppuccin-mocha',
        'solarized-light',
        'github-light',
        'nord-light',
        'one-light',
      ])
    })

    it('has complete metadata for each theme', () => {
      Object.values(THEMES).forEach((theme) => {
        expect(theme).toHaveProperty('id')
        expect(theme).toHaveProperty('name')
        expect(theme).toHaveProperty('description')
        expect(theme).toHaveProperty('category')
        expect(theme).toHaveProperty('colorSwatch')
        expect(theme).toHaveProperty('isDark')

        // Color swatch has all 4 colors
        expect(theme.colorSwatch).toHaveProperty('background')
        expect(theme.colorSwatch).toHaveProperty('foreground')
        expect(theme.colorSwatch).toHaveProperty('primary')
        expect(theme.colorSwatch).toHaveProperty('accent')
      })
    })

    it('has correct category assignments', () => {
      expect(THEMES.system.category).toBe('system')
      expect(THEMES.light.category).toBe('light')
      expect(THEMES.dark.category).toBe('dark')
      expect(THEMES.dracula.category).toBe('dark')
      expect(THEMES['tokyo-night'].category).toBe('dark')
      expect(THEMES['catppuccin-latte'].category).toBe('light')
      expect(THEMES['catppuccin-frappe'].category).toBe('dark')
      expect(THEMES['catppuccin-macchiato'].category).toBe('dark')
      expect(THEMES['catppuccin-mocha'].category).toBe('dark')
      expect(THEMES['solarized-light'].category).toBe('light')
      expect(THEMES['github-light'].category).toBe('light')
      expect(THEMES['nord-light'].category).toBe('light')
      expect(THEMES['one-light'].category).toBe('light')
    })

    it('has correct isDark flags', () => {
      expect(THEMES.system.isDark).toBe(false)
      expect(THEMES.light.isDark).toBe(false)
      expect(THEMES.dark.isDark).toBe(true)
      expect(THEMES.dracula.isDark).toBe(true)
      expect(THEMES['tokyo-night'].isDark).toBe(true)
      expect(THEMES['catppuccin-latte'].isDark).toBe(false)
      expect(THEMES['catppuccin-frappe'].isDark).toBe(true)
      expect(THEMES['catppuccin-macchiato'].isDark).toBe(true)
      expect(THEMES['catppuccin-mocha'].isDark).toBe(true)
      expect(THEMES['solarized-light'].isDark).toBe(false)
      expect(THEMES['github-light'].isDark).toBe(false)
      expect(THEMES['nord-light'].isDark).toBe(false)
      expect(THEMES['one-light'].isDark).toBe(false)
    })

    it('includes author credits for third-party themes', () => {
      expect(THEMES.dracula.author).toBe('Zeno Rocha')
      expect(THEMES['tokyo-night'].author).toBe('enkia')
      expect(THEMES['catppuccin-latte'].author).toBe('Catppuccin')
      expect(THEMES['catppuccin-frappe'].author).toBe('Catppuccin')
      expect(THEMES['catppuccin-macchiato'].author).toBe('Catppuccin')
      expect(THEMES['catppuccin-mocha'].author).toBe('Catppuccin')
      expect(THEMES['solarized-light'].author).toBe('Ethan Schoonover')
      expect(THEMES['github-light'].author).toBe('GitHub')
      expect(THEMES['nord-light'].author).toBe('Arctic Ice Studio')
      expect(THEMES['one-light'].author).toBe('Atom')
    })
  })

  describe('getAllThemeIds', () => {
    it('returns all theme IDs in display order', () => {
      const ids = getAllThemeIds()
      expect(ids).toEqual([
        'system',
        'light',
        'dark',
        'dracula',
        'tokyo-night',
        'catppuccin-latte',
        'catppuccin-frappe',
        'catppuccin-macchiato',
        'catppuccin-mocha',
        'solarized-light',
        'github-light',
        'nord-light',
        'one-light',
      ])
    })

    it('returns an array', () => {
      const ids = getAllThemeIds()
      expect(Array.isArray(ids)).toBe(true)
    })
  })

  describe('getThemeById', () => {
    it('returns correct theme metadata for valid IDs', () => {
      const dracula = getThemeById('dracula')
      expect(dracula?.name).toBe('Dracula')
      expect(dracula?.category).toBe('dark')

      const latte = getThemeById('catppuccin-latte')
      expect(latte?.name).toBe('Catppuccin Latte')
      expect(latte?.category).toBe('light')
    })

    it('returns undefined for invalid IDs', () => {
      expect(getThemeById('unknown')).toBeUndefined()
      expect(getThemeById('nord')).toBeUndefined()
      expect(getThemeById('')).toBeUndefined()
    })

    it('is case-sensitive', () => {
      expect(getThemeById('Light')).toBeUndefined()
      expect(getThemeById('DARK')).toBeUndefined()
    })
  })

  describe('getThemesByCategory', () => {
    it('returns system theme for "system" category', () => {
      const systemThemes = getThemesByCategory('system')
      expect(systemThemes).toHaveLength(1)
      expect(systemThemes[0].id).toBe('system')
    })

    it('returns 6 light themes', () => {
      const lightThemes = getThemesByCategory('light')
      expect(lightThemes).toHaveLength(6)
      expect(lightThemes.map((t) => t.id)).toEqual([
        'light',
        'catppuccin-latte',
        'solarized-light',
        'github-light',
        'nord-light',
        'one-light',
      ])
    })

    it('returns 6 dark themes', () => {
      const darkThemes = getThemesByCategory('dark')
      expect(darkThemes).toHaveLength(6)
      expect(darkThemes.map((t) => t.id)).toEqual([
        'dark',
        'dracula',
        'tokyo-night',
        'catppuccin-frappe',
        'catppuccin-macchiato',
        'catppuccin-mocha',
      ])
    })

    it('returns empty array for "custom" category', () => {
      const customThemes = getThemesByCategory('custom')
      expect(customThemes).toHaveLength(0)
    })
  })

  describe('isCustomTheme', () => {
    it('returns false for built-in themes', () => {
      expect(isCustomTheme('system')).toBe(false)
      expect(isCustomTheme('light')).toBe(false)
      expect(isCustomTheme('dark')).toBe(false)
      expect(isCustomTheme('dracula')).toBe(false)
      expect(isCustomTheme('catppuccin-mocha')).toBe(false)
    })

    it('returns true for non-built-in theme IDs', () => {
      expect(isCustomTheme('custom-nord')).toBe(true)
      expect(isCustomTheme('my-theme')).toBe(true)
      expect(isCustomTheme('solarized-dark')).toBe(true)
    })
  })

  describe('getGroupedThemes', () => {
    it('returns 3 groups', () => {
      const groups = getGroupedThemes()
      expect(groups).toHaveLength(3)
    })

    it('has correct group labels', () => {
      const groups = getGroupedThemes()
      expect(groups[0].label).toBe('System')
      expect(groups[1].label).toBe('Light Themes')
      expect(groups[2].label).toBe('Dark Themes')
    })

    it('groups system theme separately', () => {
      const groups = getGroupedThemes()
      const systemGroup = groups[0]
      expect(systemGroup.themes).toHaveLength(1)
      expect(systemGroup.themes[0].id).toBe('system')
    })

    it('groups light themes correctly', () => {
      const groups = getGroupedThemes()
      const lightGroup = groups[1]
      expect(lightGroup.themes).toHaveLength(6)
      expect(lightGroup.themes.map((t) => t.id)).toEqual([
        'light',
        'catppuccin-latte',
        'solarized-light',
        'github-light',
        'nord-light',
        'one-light',
      ])
    })

    it('groups dark themes correctly', () => {
      const groups = getGroupedThemes()
      const darkGroup = groups[2]
      expect(darkGroup.themes).toHaveLength(6)
      expect(darkGroup.themes.map((t) => t.id)).toEqual([
        'dark',
        'dracula',
        'tokyo-night',
        'catppuccin-frappe',
        'catppuccin-macchiato',
        'catppuccin-mocha',
      ])
    })
  })
})
