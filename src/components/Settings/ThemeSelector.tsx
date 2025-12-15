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
 */

import { ThemeColorSwatch } from '@/components/Settings/ThemeColorSwatch'
import { Label } from '@/components/ui/label'
import { getGroupedThemes } from '@/constants/themes'
import { useThemePreview } from '@/hooks/useThemePreview'
import { Check } from 'lucide-react'
import { useTheme } from 'next-themes'
import React from 'react'

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

                return (
                  <button
                    key={themeMetadata.id}
                    onClick={() => setTheme(themeMetadata.id)}
                    onMouseEnter={() => startPreview(themeMetadata.id)}
                    onMouseLeave={stopPreview}
                    className={`relative flex flex-col gap-3 rounded-lg border-2 p-4 text-left transition-all hover:border-primary ${
                      isSelected
                        ? 'border-primary bg-accent'
                        : 'border-border bg-card hover:bg-accent/50'
                    }`}
                    aria-label={`Select ${themeMetadata.name} theme`}
                    aria-pressed={isSelected}
                  >
                    {/* Selected indicator */}
                    {isSelected && (
                      <div className="bg-primary text-primary-foreground absolute right-2 top-2 rounded-full p-1">
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
                      <span className="text-sm font-medium">{themeMetadata.name}</span>
                      <span className="text-muted-foreground text-xs leading-tight">
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
