/**
 * Theme System
 *
 * Comprehensive theme registry for Bucket app.
 * Supports built-in themes (Light, Dark, Dracula, Catppuccin variants)
 * and future custom theme imports.
 */

export type ThemeId =
  | 'system'
  | 'light'
  | 'dark'
  | 'dracula'
  | 'tokyo-night'
  | 'catppuccin-latte'
  | 'catppuccin-frappe'
  | 'catppuccin-macchiato'
  | 'catppuccin-mocha'

export type ThemeCategory = 'system' | 'light' | 'dark' | 'custom'

export interface ThemeColorSwatch {
  background: string // HSL format: "220 13% 91%"
  foreground: string
  primary: string
  accent: string
}

export interface ThemeMetadata {
  id: ThemeId | string // string allows custom theme IDs
  name: string
  description: string
  category: ThemeCategory
  colorSwatch: ThemeColorSwatch
  author?: string
  isDark: boolean // Used for system theme mapping
}

/**
 * Complete theme registry
 */
export const THEMES: Record<ThemeId, ThemeMetadata> = {
  system: {
    id: 'system',
    name: 'System',
    description: 'Follow system light/dark preference',
    category: 'system',
    colorSwatch: {
      background: '0 0% 50%',
      foreground: '0 0% 50%',
      primary: '0 0% 50%',
      accent: '0 0% 50%'
    },
    isDark: false
  },
  light: {
    id: 'light',
    name: 'Light',
    description: 'Clean light theme with high contrast',
    category: 'light',
    colorSwatch: {
      background: '0 0% 100%',
      foreground: '224 71.4% 4.1%',
      primary: '220.9 39.3% 11%',
      accent: '220 14.3% 95.9%'
    },
    isDark: false
  },
  dark: {
    id: 'dark',
    name: 'Dark',
    description: 'Default dark theme with blue tones',
    category: 'dark',
    colorSwatch: {
      background: '224 71.4% 4.1%',
      foreground: '210 20% 98%',
      primary: '210 20% 98%',
      accent: '215 27.9% 16.9%'
    },
    isDark: true
  },
  dracula: {
    id: 'dracula',
    name: 'Dracula',
    description: 'Dark theme with vibrant purple and pink accents',
    category: 'dark',
    colorSwatch: {
      background: '231 15% 18%', // #282a36
      foreground: '60 30% 96%', // #f8f8f2
      primary: '265 89% 78%', // #bd93f9 (purple)
      accent: '326 100% 74%' // #ff79c6 (pink)
    },
    author: 'Zeno Rocha',
    isDark: true
  },
  'tokyo-night': {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    description: 'Deep blue dark theme inspired by Tokyo at night',
    category: 'dark',
    colorSwatch: {
      background: '219 28% 13%', // #1a1b26
      foreground: '220 16% 78%', // #c0caf5
      primary: '187 71% 68%', // #7dcfff (cyan)
      accent: '217 92% 76%' // #7aa2f7 (blue)
    },
    author: 'enkia',
    isDark: true
  },
  'catppuccin-latte': {
    id: 'catppuccin-latte',
    name: 'Catppuccin Latte',
    description: 'Warm light theme with soft pastel colors',
    category: 'light',
    colorSwatch: {
      background: '220 23% 95%', // #eff1f5
      foreground: '234 16% 35%', // #4c4f69
      primary: '220 91% 54%', // #1e66f5 (blue)
      accent: '266 85% 58%' // #7287fd (lavender)
    },
    author: 'Catppuccin',
    isDark: false
  },
  'catppuccin-frappe': {
    id: 'catppuccin-frappe',
    name: 'Catppuccin Frappé',
    description: 'Medium-dark theme with cool blue-gray tones',
    category: 'dark',
    colorSwatch: {
      background: '229 19% 23%', // #303446
      foreground: '227 70% 87%', // #c6d0f5
      primary: '222 74% 74%', // #8caaee (blue)
      accent: '239 68% 86%' // #babbf1 (lavender)
    },
    author: 'Catppuccin',
    isDark: true
  },
  'catppuccin-macchiato': {
    id: 'catppuccin-macchiato',
    name: 'Catppuccin Macchiato',
    description: 'Medium-dark theme with warm purple undertones',
    category: 'dark',
    colorSwatch: {
      background: '232 23% 18%', // #24273a
      foreground: '227 68% 88%', // #cad3f5
      primary: '220 78% 75%', // #8aadf4 (blue)
      accent: '238 71% 87%' // #b7bdf8 (lavender)
    },
    author: 'Catppuccin',
    isDark: true
  },
  'catppuccin-mocha': {
    id: 'catppuccin-mocha',
    name: 'Catppuccin Mocha',
    description: 'Rich dark theme with deep blacks and vibrant accents',
    category: 'dark',
    colorSwatch: {
      background: '240 21% 15%', // #1e1e2e
      foreground: '226 64% 88%', // #cdd6f4
      primary: '217 92% 76%', // #89b4fa (blue)
      accent: '238 67% 86%' // #b4befe (lavender)
    },
    author: 'Catppuccin',
    isDark: true
  }
}

/**
 * Get all theme IDs in display order
 */
export const getAllThemeIds = (): ThemeId[] => [
  'system',
  'light',
  'dark',
  'dracula',
  'tokyo-night',
  'catppuccin-latte',
  'catppuccin-frappe',
  'catppuccin-macchiato',
  'catppuccin-mocha'
]

/**
 * Get theme metadata by ID
 */
export const getThemeById = (id: string): ThemeMetadata | undefined => {
  return THEMES[id as ThemeId]
}

/**
 * Get themes by category
 */
export const getThemesByCategory = (category: ThemeCategory): ThemeMetadata[] => {
  return Object.values(THEMES).filter((theme) => theme.category === category)
}

/**
 * Check if a theme is a custom (user-imported) theme
 */
export const isCustomTheme = (themeId: string): boolean => {
  return !getAllThemeIds().includes(themeId as ThemeId)
}

/**
 * Get grouped themes for UI display
 */
export interface ThemeGroup {
  label: string
  themes: ThemeMetadata[]
}

export const getGroupedThemes = (): ThemeGroup[] => {
  return [
    {
      label: 'System',
      themes: [THEMES.system]
    },
    {
      label: 'Light Themes',
      themes: [THEMES.light, THEMES['catppuccin-latte']]
    },
    {
      label: 'Dark Themes',
      themes: [
        THEMES.dark,
        THEMES.dracula,
        THEMES['tokyo-night'],
        THEMES['catppuccin-frappe'],
        THEMES['catppuccin-macchiato'],
        THEMES['catppuccin-mocha']
      ]
    }
  ]
}
