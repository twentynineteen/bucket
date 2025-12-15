/**
 * Theme Migration Utilities
 *
 * Handles migration from legacy theme values to new theme system.
 * Ensures backward compatibility for existing users.
 */

import type { ThemeId } from '@/constants/themes'

/**
 * Map legacy theme IDs to modern theme IDs
 * Ensures existing user preferences continue to work
 */
export function migrateLegacyTheme(legacyThemeId: string): ThemeId {
  const migrations: Record<string, ThemeId> = {
    light: 'light',
    dark: 'dark',
    system: 'system'
  }

  return (migrations[legacyThemeId] as ThemeId) || 'system'
}

/**
 * Validate if a theme ID is valid
 */
export function isValidThemeId(themeId: string): themeId is ThemeId {
  const validThemes: ThemeId[] = [
    'system',
    'light',
    'dark',
    'dracula',
    'catppuccin-latte',
    'catppuccin-frappe',
    'catppuccin-macchiato',
    'catppuccin-mocha'
  ]

  return validThemes.includes(themeId as ThemeId)
}
