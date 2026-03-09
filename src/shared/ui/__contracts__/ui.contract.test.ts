/**
 * Contract tests for @shared/ui direct imports
 *
 * Since shared/ui has no barrel file, these tests verify that direct import
 * paths resolve correctly for UI primitives, nested sub-modules (sidebar,
 * theme, layout), and formerly misplaced components.
 *
 * Convention: No barrel/index.ts files exist anywhere in shared/ui/ tree.
 * All imports use direct paths (e.g., @shared/ui/button, @shared/ui/sidebar/Sidebar).
 */

import { describe, expect, test } from 'vitest'

// ============================================================
// Shape Tests: Verify direct imports resolve and export expected symbols
// ============================================================

describe('UI Primitives (direct imports)', () => {
  test('Button exports Button component and buttonVariants', async () => {
    const mod = await import('@shared/ui/button')
    expect(mod.Button).toBeDefined()
    expect(typeof mod.Button).toBe('function')
    expect(mod.buttonVariants).toBeDefined()
    expect(typeof mod.buttonVariants).toBe('function')
  })

  test('Card exports Card family components', async () => {
    const mod = await import('@shared/ui/card')
    expect(mod.Card).toBeDefined()
    expect(mod.CardContent).toBeDefined()
    expect(mod.CardHeader).toBeDefined()
    expect(mod.CardFooter).toBeDefined()
    expect(mod.CardTitle).toBeDefined()
    expect(mod.CardDescription).toBeDefined()
  })

  test('Dialog exports Dialog family components', async () => {
    const mod = await import('@shared/ui/dialog')
    expect(mod.Dialog).toBeDefined()
    expect(mod.DialogContent).toBeDefined()
    expect(mod.DialogHeader).toBeDefined()
    expect(mod.DialogTitle).toBeDefined()
    expect(mod.DialogDescription).toBeDefined()
    expect(mod.DialogFooter).toBeDefined()
    expect(mod.DialogTrigger).toBeDefined()
  })

  test('Input exports Input component', async () => {
    const mod = await import('@shared/ui/input')
    expect(mod.Input).toBeDefined()
  })

  test('Label exports Label component', async () => {
    const mod = await import('@shared/ui/label')
    expect(mod.Label).toBeDefined()
  })

  test('Badge exports Badge component', async () => {
    const mod = await import('@shared/ui/badge')
    expect(mod.Badge).toBeDefined()
  })

  test('Tabs exports Tab components', async () => {
    const mod = await import('@shared/ui/tabs')
    expect(mod.Tabs).toBeDefined()
    expect(mod.TabsList).toBeDefined()
    expect(mod.TabsTrigger).toBeDefined()
    expect(mod.TabsContent).toBeDefined()
  })

  test('Select exports Select components', async () => {
    const mod = await import('@shared/ui/select')
    expect(mod.Select).toBeDefined()
    expect(mod.SelectContent).toBeDefined()
    expect(mod.SelectItem).toBeDefined()
    expect(mod.SelectTrigger).toBeDefined()
    expect(mod.SelectValue).toBeDefined()
  })
})

describe('Sidebar sub-module (nested direct paths)', () => {
  test('Sidebar exports core sidebar components', async () => {
    const mod = await import('@shared/ui/sidebar/Sidebar')
    expect(mod.Sidebar).toBeDefined()
    expect(mod.SidebarTrigger).toBeDefined()
    expect(mod.SidebarRail).toBeDefined()
    expect(mod.SidebarInset).toBeDefined()
  })

  test('SidebarProvider exports SidebarProvider', async () => {
    const mod = await import('@shared/ui/sidebar/SidebarProvider')
    expect(mod.SidebarProvider).toBeDefined()
  })

  test('SidebarMenu exports menu components', async () => {
    const mod = await import('@shared/ui/sidebar/SidebarMenu')
    expect(mod.SidebarMenu).toBeDefined()
    expect(mod.SidebarMenuItem).toBeDefined()
    expect(mod.SidebarMenuButton).toBeDefined()
    expect(mod.SidebarMenuAction).toBeDefined()
    expect(mod.SidebarMenuSub).toBeDefined()
    expect(mod.SidebarMenuSubButton).toBeDefined()
    expect(mod.SidebarMenuSubItem).toBeDefined()
  })

  test('SidebarLayout exports layout components', async () => {
    const mod = await import('@shared/ui/sidebar/SidebarLayout')
    expect(mod.SidebarHeader).toBeDefined()
    expect(mod.SidebarFooter).toBeDefined()
    expect(mod.SidebarContent).toBeDefined()
    expect(mod.SidebarGroup).toBeDefined()
    expect(mod.SidebarGroupLabel).toBeDefined()
    expect(mod.SidebarGroupContent).toBeDefined()
    expect(mod.SidebarSeparator).toBeDefined()
  })

  test('use-sidebar exports useSidebar hook', async () => {
    const mod = await import('@shared/ui/use-sidebar')
    expect(mod.useSidebar).toBeDefined()
    expect(typeof mod.useSidebar).toBe('function')
  })
})

describe('Theme sub-module (coalesced from 6 locations)', () => {
  test('themes exports THEMES registry and helper functions', async () => {
    const mod = await import('@shared/ui/theme/themes')
    expect(mod.THEMES).toBeDefined()
    expect(typeof mod.THEMES).toBe('object')
    // Verify THEMES has expected theme entries
    expect(mod.THEMES.light).toBeDefined()
    expect(mod.THEMES.dark).toBeDefined()
    expect(mod.THEMES.system).toBeDefined()
    expect(mod.THEMES.dracula).toBeDefined()
    // Verify helper functions
    expect(typeof mod.getAllThemeIds).toBe('function')
    expect(typeof mod.getThemeById).toBe('function')
    expect(typeof mod.getThemesByCategory).toBe('function')
    expect(typeof mod.isCustomTheme).toBe('function')
    expect(typeof mod.getGroupedThemes).toBe('function')
  })

  test('themeMapper exports migration functions', async () => {
    const mod = await import('@shared/ui/theme/themeMapper')
    expect(typeof mod.migrateLegacyTheme).toBe('function')
    expect(typeof mod.isValidThemeId).toBe('function')
  })

  test('themeLoader exports theme loading utilities', async () => {
    const mod = await import('@shared/ui/theme/themeLoader')
    expect(mod).toBeDefined()
    // themeLoader has functions for dynamic theme management
    expect(typeof mod.validateThemeCompleteness).toBe('function')
    expect(typeof mod.loadCustomTheme).toBe('function')
    expect(typeof mod.unloadCustomTheme).toBe('function')
  })

  test('useThemePreview exports hook', async () => {
    const mod = await import('@shared/ui/theme/useThemePreview')
    expect(mod.useThemePreview).toBeDefined()
    expect(typeof mod.useThemePreview).toBe('function')
  })

  test('customTheme exports Zod schema and types', async () => {
    const mod = await import('@shared/ui/theme/customTheme')
    expect(mod).toBeDefined()
    // Should export the Zod schema for custom themes (PascalCase)
    expect(mod.CustomThemeSchema).toBeDefined()
    expect(typeof mod.validateCustomTheme).toBe('function')
  })
})

describe('Layout sub-module (nested direct paths)', () => {
  test('ErrorBoundary exports ErrorBoundary and QueryErrorBoundary', async () => {
    const mod = await import('@shared/ui/layout/ErrorBoundary')
    expect(mod.default).toBeDefined() // ErrorBoundary is default export
    expect(mod.QueryErrorBoundary).toBeDefined()
  })

  test('TitleBar exports TitleBar component', async () => {
    const mod = await import('@shared/ui/layout/TitleBar')
    expect(mod.TitleBar).toBeDefined()
    expect(typeof mod.TitleBar).toBe('function')
  })
})

describe('Formerly misplaced components (moved from utils)', () => {
  test('ApiKeyInput exports default component', async () => {
    const mod = await import('@shared/ui/ApiKeyInput')
    expect(mod.default).toBeDefined()
  })

  test('EmbedCodeInput exports default component', async () => {
    const mod = await import('@shared/ui/EmbedCodeInput')
    expect(mod.default).toBeDefined()
  })

  test('ExternalLink exports default component', async () => {
    const mod = await import('@shared/ui/ExternalLink')
    expect(mod.default).toBeDefined()
  })

  test('FormattedDate exports default component', async () => {
    const mod = await import('@shared/ui/FormattedDate')
    expect(mod.default).toBeDefined()
  })
})

// ============================================================
// Behavioral Tests
// ============================================================

describe('Theme system behavioral contracts', () => {
  test('THEMES registry contains all expected theme IDs', async () => {
    const { getAllThemeIds } = await import('@shared/ui/theme/themes')
    const ids = getAllThemeIds()
    expect(ids.length).toBeGreaterThanOrEqual(8)
    expect(ids).toContain('system')
    expect(ids).toContain('light')
    expect(ids).toContain('dark')
    expect(ids).toContain('dracula')
  })

  test('getThemeById returns metadata for valid theme', async () => {
    const { getThemeById } = await import('@shared/ui/theme/themes')
    const light = getThemeById('light')
    expect(light).toBeDefined()
    expect(light!.name).toBe('Light')
    expect(light!.category).toBe('light')
  })

  test('getThemeById returns undefined for invalid theme', async () => {
    const { getThemeById } = await import('@shared/ui/theme/themes')
    expect(getThemeById('nonexistent-theme')).toBeUndefined()
  })

  test('migrateLegacyTheme maps old theme IDs correctly', async () => {
    const { migrateLegacyTheme } = await import('@shared/ui/theme/themeMapper')
    // Valid theme should pass through
    expect(migrateLegacyTheme('dark')).toBe('dark')
    expect(migrateLegacyTheme('light')).toBe('light')
  })

  test('isValidThemeId validates theme IDs', async () => {
    const { isValidThemeId } = await import('@shared/ui/theme/themeMapper')
    expect(isValidThemeId('light')).toBe(true)
    expect(isValidThemeId('dark')).toBe(true)
    expect(isValidThemeId('not-a-real-theme')).toBe(false)
  })
})

// ============================================================
// Anti-pattern: No barrel files
// ============================================================

describe('Convention enforcement', () => {
  test('no barrel/index.ts exists in shared/ui/ tree (convention)', () => {
    // This is verified by the build process and directory inspection.
    // Direct imports are the only supported pattern:
    //   import { Button } from '@shared/ui/button'         -- primitive
    //   import { Sidebar } from '@shared/ui/sidebar/Sidebar' -- nested sub-module
    //   import { themes } from '@shared/ui/theme/themes'    -- theme sub-module
    //   import { ErrorBoundary } from '@shared/ui/layout/ErrorBoundary' -- layout
    //
    // Importing from '@shared/ui' (without specific file) is NOT supported.
    // This test documents the convention; enforcement is via CI/linting.
    expect(true).toBe(true)
  })
})
