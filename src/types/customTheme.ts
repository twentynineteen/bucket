/**
 * Custom Theme Type Definitions
 *
 * Defines the structure for user-imported custom themes.
 * Future feature: Allow users to import JSON theme files.
 */

import { z } from 'zod'

/**
 * CSS variable names used in themes
 */
export type CSSVariableName =
  | 'background'
  | 'foreground'
  | 'card'
  | 'card-foreground'
  | 'popover'
  | 'popover-foreground'
  | 'primary'
  | 'primary-foreground'
  | 'secondary'
  | 'secondary-foreground'
  | 'muted'
  | 'muted-foreground'
  | 'accent'
  | 'accent-foreground'
  | 'destructive'
  | 'destructive-foreground'
  | 'success'
  | 'success-foreground'
  | 'warning'
  | 'warning-foreground'
  | 'info'
  | 'info-foreground'
  | 'border'
  | 'input'
  | 'ring'

/**
 * HSL color value (e.g., "220 13% 91%")
 */
export type HSLValue = string

/**
 * Custom theme definition structure
 */
export interface CustomThemeDefinition {
  id: string
  name: string
  description?: string
  author?: string
  isDark: boolean
  colors: Partial<Record<CSSVariableName, HSLValue>>
}

/**
 * Zod schema for validating custom theme JSON imports
 */
export const CustomThemeSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, 'ID must be lowercase alphanumeric with hyphens'),
  name: z.string().min(1),
  description: z.string().optional(),
  author: z.string().optional(),
  isDark: z.boolean(),
  colors: z.record(
    z.string(),
    z
      .string()
      .regex(/^\d+\s+\d+%\s+\d+%$/, 'Must be valid HSL format (e.g., "220 13% 91%")')
  )
})

/**
 * Validate a custom theme definition
 */
export function validateCustomTheme(data: unknown): {
  success: boolean
  theme?: CustomThemeDefinition
  error?: string
} {
  try {
    const validated = CustomThemeSchema.parse(data)
    return {
      success: true,
      theme: validated as CustomThemeDefinition
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')
      }
    }
    return {
      success: false,
      error: 'Unknown validation error'
    }
  }
}
