/**
 * TOAST-03 — every concrete theme block in src/index.css must declare the HSL
 * variables that the toaster's `--color-*` tokens dereference. A theme that
 * omits one of these makes `background: var(--normal-bg)` resolve to nothing,
 * which is exactly how toasts ended up transparent.
 *
 * This is a source-level guard: the tokens are only meaningful when they are
 * present in *every* theme, so a plain declaration count is the assertion.
 */

import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const INDEX_CSS = path.resolve(__dirname, '../../../index.css')

/**
 * The concrete (non-`system`) theme blocks in src/index.css. `:root` carries
 * the light theme, the remaining 11 are class selectors applied by next-themes.
 */
const THEME_BLOCK_SELECTORS = [
  ':root',
  '.dark',
  '.dracula',
  '.tokyo-night',
  '.catppuccin-latte',
  '.catppuccin-frappe',
  '.catppuccin-macchiato',
  '.catppuccin-mocha',
  '.solarized-light',
  '.github-light',
  '.nord-light',
  '.one-light'
] as const

const EXPECTED_THEME_BLOCKS = THEME_BLOCK_SELECTORS.length // 12

/** HSL variables the toaster's `--color-*` tokens resolve through. */
const REQUIRED_HSL_VARIABLES = [
  '--popover',
  '--popover-foreground',
  '--border',
  '--destructive',
  '--destructive-foreground',
  '--success',
  '--success-foreground',
  '--warning',
  '--warning-foreground',
  '--info',
  '--info-foreground'
] as const

const css = fs.readFileSync(INDEX_CSS, 'utf8')

const countDeclarations = (variable: string): number =>
  css.split('\n').filter((line) => line.trim().startsWith(`${variable}:`)).length

describe('TOAST-03: theme tokens are declared in every theme', () => {
  it('still has exactly 12 concrete theme blocks', () => {
    for (const selector of THEME_BLOCK_SELECTORS) {
      const pattern = new RegExp(
        `^\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{`,
        'm'
      )
      expect(css, `${selector} block missing from index.css`).toMatch(pattern)
    }

    expect(THEME_BLOCK_SELECTORS).toHaveLength(EXPECTED_THEME_BLOCKS)
  })

  it.each(REQUIRED_HSL_VARIABLES)(
    'declares %s in all 12 theme blocks',
    (variable: string) => {
      expect(countDeclarations(variable)).toBe(EXPECTED_THEME_BLOCKS)
    }
  )

  it('exposes each toaster token as a --color-* alias', () => {
    const aliases = [
      '--color-popover: hsl(var(--popover))',
      '--color-popover-foreground: hsl(var(--popover-foreground))',
      '--color-border: hsl(var(--border))',
      '--color-destructive: hsl(var(--destructive))',
      '--color-destructive-foreground: hsl(var(--destructive-foreground))',
      '--color-success: hsl(var(--success))',
      '--color-success-foreground: hsl(var(--success-foreground))',
      '--color-warning: hsl(var(--warning))',
      '--color-warning-foreground: hsl(var(--warning-foreground))',
      '--color-info: hsl(var(--info))',
      '--color-info-foreground: hsl(var(--info-foreground))'
    ]

    for (const alias of aliases) {
      expect(css).toContain(alias)
    }
  })
})
