/**
 * Dynamic Theme Loader
 *
 * Utilities for loading custom themes at runtime.
 * Injects CSS styles into the document for user-imported themes.
 */

import type { CSSVariableName, CustomThemeDefinition } from './customTheme'

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
  const missing = REQUIRED_VARIABLES.filter(varName => !theme.colors[varName])

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
