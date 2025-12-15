/**
 * ThemeSelector Component
 *
 * Card-based grid selector for choosing application themes.
 * Features:
 * - Live preview on hover
 * - Color swatches for visual identification
 * - Grouped themes (System, Light, Dark)
 * - Auto-save on selection
 * - Visual card layout with checkmark for selected theme
 * - Theme cards use inline styles to remain stable during preview
 */

import { ThemeColorSwatch } from '@/components/Settings/ThemeColorSwatch'
import { Label } from '@/components/ui/label'
import { getGroupedThemes, type ThemeMetadata } from '@/constants/themes'
import { useThemePreview } from '@/hooks/useThemePreview'
import { Check } from 'lucide-react'
import { useTheme } from 'next-themes'
import React from 'react'

/**
 * Get stable inline styles for a theme card based on the theme's own colors.
 * This ensures the card appearance doesn't change when previewing other themes.
 */
function getThemeCardStyles(themeMetadata: ThemeMetadata, isSelected: boolean) {
  const { colorSwatch, isDark } = themeMetadata

  // Use the theme's own colors for the card styling
  const bgColor = `hsl(${colorSwatch.background})`
  const borderColor = isSelected
    ? `hsl(${colorSwatch.primary})`
    : isDark
      ? 'hsl(0 0% 30%)'
      : 'hsl(0 0% 80%)'
  const textColor = `hsl(${colorSwatch.foreground})`
  const mutedTextColor = isDark ? 'hsl(0 0% 60%)' : 'hsl(0 0% 45%)'
  const hoverBorderColor = `hsl(${colorSwatch.primary})`
  const checkBgColor = `hsl(${colorSwatch.primary})`
  const checkTextColor = isDark ? 'hsl(0 0% 10%)' : 'hsl(0 0% 100%)'

  return {
    card: {
      backgroundColor: bgColor,
      borderColor: borderColor,
      '--hover-border-color': hoverBorderColor
    } as React.CSSProperties,
    text: {
      color: textColor
    } as React.CSSProperties,
    mutedText: {
      color: mutedTextColor
    } as React.CSSProperties,
    check: {
      backgroundColor: checkBgColor,
      color: checkTextColor
    } as React.CSSProperties
  }
}

export interface ThemeSelectorProps {
  /** Optional label for the selector */
  label?: string
  /** Optional CSS class name */
  className?: string
}

/**
 * Theme selector with card grid layout and live preview
 */
export function ThemeSelector({ label = 'Theme', className }: ThemeSelectorProps) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  const groupedThemes = React.useMemo(() => getGroupedThemes(), [])
  const { startPreview, stopPreview } = useThemePreview({
    activeTheme: theme || 'system'
  })

  // Avoid hydration mismatch
  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className={className}>
        {label && <Label className="mb-3 block">{label}</Label>}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-muted h-24 animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      {label && <Label className="mb-3 block">{label}</Label>}
      {/* Help text */}
      <p className="text-muted-foreground mt-4 text-xs">
        Hover over themes to preview them. Changes are saved automatically.
      </p>
      <br />

      {/* Render grouped themes */}
      <div className="space-y-6">
        {groupedThemes.map((group) => (
          <div key={group.label}>
            <h3 className="text-muted-foreground mb-3 text-sm font-medium">
              {group.label}
            </h3>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {group.themes.map((themeMetadata) => {
                const isSelected = theme === themeMetadata.id
                const styles = getThemeCardStyles(themeMetadata, isSelected)

                return (
                  <button
                    key={themeMetadata.id}
                    onClick={() => setTheme(themeMetadata.id)}
                    onMouseEnter={() => startPreview(themeMetadata.id)}
                    onMouseLeave={stopPreview}
                    className="theme-card relative flex flex-col gap-3 rounded-lg border-2 p-4 text-left transition-all"
                    style={styles.card}
                    aria-label={`Select ${themeMetadata.name} theme`}
                    aria-pressed={isSelected}
                  >
                    {/* Selected indicator */}
                    {isSelected && (
                      <div
                        className="absolute right-2 top-2 rounded-full p-1"
                        style={styles.check}
                      >
                        <Check className="h-3 w-3" />
                      </div>
                    )}

                    {/* Color swatch */}
                    <ThemeColorSwatch
                      colors={themeMetadata.colorSwatch}
                      className="w-full"
                    />

                    {/* Theme info */}
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-medium" style={styles.text}>
                        {themeMetadata.name}
                      </span>
                      <span className="text-xs leading-tight" style={styles.mutedText}>
                        {themeMetadata.description}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
