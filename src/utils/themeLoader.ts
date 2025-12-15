/**
 * Dynamic Theme Loader
 *
 * Utilities for loading custom themes at runtime.
 * Injects CSS styles into the document for user-imported themes.
 */

import type { CustomThemeDefinition, CSSVariableName } from '@/types/customTheme'

/**
 * Required CSS variables that must be defined in every theme
 */
const REQUIRED_VARIABLES: CSSVariableName[] = [
  'background',
  'foreground',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'muted',
  'muted-foreground',
  'accent',
  'accent-foreground',
  'border'
]

/**
 * Validate that a custom theme has all required CSS variables
 */
export function validateThemeCompleteness(theme: CustomThemeDefinition): {
  valid: boolean
  missing: string[]
} {
  const missing = REQUIRED_VARIABLES.filter((varName) => !theme.colors[varName])

  return {
    valid: missing.length === 0,
    missing
  }
}

/**
 * Generate CSS class selector for a custom theme
 */
function generateThemeCSS(theme: CustomThemeDefinition): string {
  const cssVariables = Object.entries(theme.colors)
    .map(([key, value]) => `    --${key}: ${value};`)
    .join('\n')

  return `
  /* Custom Theme: ${theme.name} */
  .custom-${theme.id} {
${cssVariables}
  }
`
}

/**
 * Load a custom theme by injecting CSS into the document
 */
export function loadCustomTheme(theme: CustomThemeDefinition): {
  success: boolean
  error?: string
} {
  // Validate theme completeness
  const validation = validateThemeCompleteness(theme)
  if (!validation.valid) {
    return {
      success: false,
      error: `Theme is missing required variables: ${validation.missing.join(', ')}`
    }
  }

  try {
    // Check if theme already exists
    const existingStyle = document.getElementById(`custom-theme-${theme.id}`)
    if (existingStyle) {
      // Update existing theme
      existingStyle.textContent = generateThemeCSS(theme)
    } else {
      // Create new style element
      const styleElement = document.createElement('style')
      styleElement.id = `custom-theme-${theme.id}`
      styleElement.textContent = generateThemeCSS(theme)
      document.head.appendChild(styleElement)
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load theme'
    }
  }
}

/**
 * Unload a custom theme by removing its CSS
 */
export function unloadCustomTheme(themeId: string): void {
  const styleElement = document.getElementById(`custom-theme-${themeId}`)
  if (styleElement) {
    styleElement.remove()
  }
}

/**
 * Get all loaded custom themes
 */
export function getLoadedCustomThemes(): string[] {
  const styleElements = document.querySelectorAll('[id^="custom-theme-"]')
  return Array.from(styleElements).map((el) => el.id.replace('custom-theme-', ''))
}

/**
 * LocalStorage key for custom themes
 */
const CUSTOM_THEMES_KEY = 'bucket-custom-themes'

/**
 * Save custom themes to localStorage
 */
export function saveCustomThemesToStorage(themes: CustomThemeDefinition[]): void {
  try {
    localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(themes))
  } catch {
    // Silently fail - localStorage may be unavailable
  }
}

/**
 * Load custom themes from localStorage
 */
export function loadCustomThemesFromStorage(): CustomThemeDefinition[] {
  try {
    const stored = localStorage.getItem(CUSTOM_THEMES_KEY)
    if (!stored) return []

    const parsed = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    // Return empty array if parsing fails or localStorage is unavailable
    return []
  }
}

/**
 * Initialize custom themes on app startup
 * Loads all saved custom themes from localStorage and injects their CSS
 */
export function initializeCustomThemes(): void {
  const customThemes = loadCustomThemesFromStorage()
  customThemes.forEach((theme) => {
    loadCustomTheme(theme)
  })
}
