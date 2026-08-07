import { useTheme } from 'next-themes'
import { Toaster as Sonner } from 'sonner'

import { getThemeById } from './theme/themes'

type ToasterProps = React.ComponentProps<typeof Sonner>

/**
 * Sonner stamps `data-sonner-theme="<value>"` verbatim and only defines its
 * colour variables under its own `light` and `dark` selectors. Passing a Bucket
 * theme id (`dracula`, `one-light`, …) leaves `--normal-bg` and friends
 * undefined, which makes `background: var(--normal-bg)` invalid at
 * computed-value time — a fully transparent toast.
 *
 * Resolve through `resolvedTheme` rather than `theme`: `theme` can be the
 * literal `'system'`, and `THEMES.system.isDark` is hardcoded `true`, so every
 * System-on-Light user would otherwise get a black toast on a white UI.
 */
const toSonnerTheme = (resolvedTheme: string | undefined): ToasterProps['theme'] =>
  (getThemeById(resolvedTheme ?? 'light')?.isDark ?? false) ? 'dark' : 'light'

/**
 * Toast colours, supplied inline so they beat sonner's own stylesheet.
 *
 * Sonner injects its CSS at runtime (`__insertCSS`) after Vite's extracted
 * `<link>`, so an equal-specificity class override loses on source order in
 * production while appearing to work in dev. Inline styles are immune, and
 * custom properties inherit down to each `[data-sonner-toast]`.
 *
 * Severity backgrounds are tints of the popover surface rather than solid
 * `--color-destructive` etc. The `*-foreground` tokens are not consistently
 * authored as on-solid pairs, so the solid mapping falls below 4.5:1 in six of
 * the twelve themes (tokyo-night error reaches 1.78:1). Tinting keeps the
 * accent colour as text, which is legible on every theme.
 */
const TOAST_COLOR_VARIABLES = {
  '--normal-bg': 'var(--color-popover)',
  '--normal-text': 'var(--color-popover-foreground)',
  '--normal-border': 'var(--color-border)',
  '--normal-bg-hover': 'var(--color-accent)',
  '--normal-border-hover': 'var(--color-border)',
  '--error-bg': 'color-mix(in oklab, var(--color-destructive) 15%, var(--color-popover))',
  '--error-text': 'var(--color-destructive)',
  '--error-border':
    'color-mix(in oklab, var(--color-destructive) 35%, var(--color-popover))',
  '--success-bg': 'color-mix(in oklab, var(--color-success) 15%, var(--color-popover))',
  '--success-text': 'var(--color-success)',
  '--success-border':
    'color-mix(in oklab, var(--color-success) 35%, var(--color-popover))',
  '--warning-bg': 'color-mix(in oklab, var(--color-warning) 15%, var(--color-popover))',
  '--warning-text': 'var(--color-warning)',
  '--warning-border':
    'color-mix(in oklab, var(--color-warning) 35%, var(--color-popover))',
  '--info-bg': 'color-mix(in oklab, var(--color-info) 15%, var(--color-popover))',
  '--info-text': 'var(--color-info)',
  '--info-border': 'color-mix(in oklab, var(--color-info) 35%, var(--color-popover))'
} as React.CSSProperties

const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme } = useTheme()

  return (
    <Sonner
      theme={toSonnerTheme(resolvedTheme)}
      richColors
      className="toaster group"
      style={TOAST_COLOR_VARIABLES}
      toastOptions={{
        classNames: {
          // The `group toast` classes anchor the `group-[.toast]:` variants
          // below; the colour utilities that used to live here lost a
          // specificity tie with sonner's own rules and never applied.
          toast: 'group toast',
          description: 'group-[.toast]:opacity-90'
        }
      }}
      {...props}
    />
  )
}

export { Toaster }
