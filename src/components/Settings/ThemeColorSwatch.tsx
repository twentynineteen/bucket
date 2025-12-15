/**
 * ThemeColorSwatch Component
 *
 * Displays a 4-color horizontal preview bar for a theme.
 * Shows: background, foreground, primary, and accent colors.
 */

import type { ThemeColorSwatch as ThemeColorSwatchType } from '@/constants/themes'

interface ThemeColorSwatchProps {
  colors: ThemeColorSwatchType
  className?: string
}

export function ThemeColorSwatch({ colors, className = '' }: ThemeColorSwatchProps) {
  return (
    <div
      className={`flex h-6 overflow-hidden rounded border border-border ${className}`}
      role="presentation"
      aria-hidden="true"
    >
      <div
        className="flex-1"
        style={{ backgroundColor: `hsl(${colors.background})` }}
        title="Background"
      />
      <div
        className="flex-1"
        style={{ backgroundColor: `hsl(${colors.foreground})` }}
        title="Foreground"
      />
      <div
        className="flex-1"
        style={{ backgroundColor: `hsl(${colors.primary})` }}
        title="Primary"
      />
      <div
        className="flex-1"
        style={{ backgroundColor: `hsl(${colors.accent})` }}
        title="Accent"
      />
    </div>
  )
}
