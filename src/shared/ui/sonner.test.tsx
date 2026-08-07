/**
 * Toaster (sonner) behavioural tests.
 *
 * Covers TOAST-01, TOAST-02, TOAST-04, TOAST-05 and TOAST-06 from the
 * "toasts are transparent on 10 of 13 themes" bug.
 *
 * NOTE: sonner is deliberately NOT mocked in this file — the whole point is to
 * exercise the real Toaster so we can inspect the attributes and inline custom
 * properties it actually stamps onto `[data-sonner-toaster]`.
 */

import '@testing-library/jest-dom'

import fs from 'node:fs'
import path from 'node:path'

import { act, render, waitFor } from '@testing-library/react'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { Dialog, DialogContent, DialogTitle } from './dialog'
import { Toaster } from './sonner'
import { getAllThemeIds, THEMES, type ThemeId } from './theme/themes'

// next-themes is mocked with a mutable holder rather than a vi.fn() so that the
// suite-wide `mockReset: true` in vite.config.ts cannot wipe the implementation.
const themeHolder = vi.hoisted(() => ({
  value: { theme: 'system', resolvedTheme: undefined } as {
    theme?: string
    resolvedTheme?: string
  }
}))

vi.mock('next-themes', () => ({
  useTheme: () => themeHolder.value
}))

const SONNER_SOURCE = path.resolve(__dirname, 'sonner.tsx')

/** Fires a toast and waits for sonner's container to exist. */
const fireToastAndGetContainer = async (
  fire: () => void = () => toast('hello')
): Promise<HTMLElement> => {
  act(() => {
    fire()
  })

  let container: HTMLElement | null = null
  await waitFor(() => {
    container = document.querySelector<HTMLElement>('[data-sonner-toaster]')
    expect(container).not.toBeNull()
  })

  return container as unknown as HTMLElement
}

/** Collapses whitespace so `style` attribute comparisons are formatting-proof. */
const normaliseStyle = (element: Element): string =>
  (element.getAttribute('style') ?? '').replace(/\s+/g, ' ').trim()

const escapeRe = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** `--name: var(--token)` — matched whitespace-insensitively. */
const solidVar = (name: string, token: string): readonly [string, RegExp] => [
  name,
  new RegExp(`${escapeRe(name)}:\\s*var\\(\\s*${escapeRe(token)}\\s*\\)`)
]

/**
 * `--name: color-mix(in oklab, var(--token) N%, var(--color-popover))`.
 *
 * Solid `--color-*` fills were rejected: six of the twelve themes fall below
 * 4.5:1 with them (tokyo-night error reaches 1.78:1) because the `*-foreground`
 * tokens are not consistently authored as on-solid pairs. Tinting the popover
 * background keeps the accent legible on every theme.
 */
const tintVar = (
  name: string,
  token: string,
  percent: number
): readonly [string, RegExp] => [
  name,
  new RegExp(
    `${escapeRe(name)}:\\s*color-mix\\(\\s*in\\s+oklab\\s*,\\s*` +
      `var\\(\\s*${escapeRe(token)}\\s*\\)\\s*${percent}%\\s*,\\s*` +
      `var\\(\\s*--color-popover\\s*\\)\\s*\\)`
  )
]

const severityVars = (severity: string, token: string) => [
  tintVar(`--${severity}-bg`, token, 15),
  solidVar(`--${severity}-text`, token),
  tintVar(`--${severity}-border`, token, 35)
]

/**
 * The 17 custom properties the toaster must declare inline so that every theme
 * — not just sonner's own `light`/`dark` — resolves them. `--normal-bg-hover`
 * and `--normal-border-hover` are read by sonner's close button and are only
 * defined under its dark block, so they have to be supplied too.
 */
const REQUIRED_TOAST_VARIABLES: ReadonlyArray<readonly [string, RegExp]> = [
  solidVar('--normal-bg', '--color-popover'),
  solidVar('--normal-text', '--color-popover-foreground'),
  solidVar('--normal-border', '--color-border'),
  solidVar('--normal-bg-hover', '--color-accent'),
  solidVar('--normal-border-hover', '--color-border'),
  ...severityVars('error', '--color-destructive'),
  ...severityVars('success', '--color-success'),
  ...severityVars('warning', '--color-warning'),
  ...severityVars('info', '--color-info')
]

const expectToastVariablesDeclared = (container: Element) => {
  const style = normaliseStyle(container)

  for (const [name, pattern] of REQUIRED_TOAST_VARIABLES) {
    expect(style, `${name} is not declared on [data-sonner-toaster]`).toContain(
      `${name}:`
    )
    expect(style, `${name} does not have the agreed value`).toMatch(pattern)
  }
}

beforeEach(() => {
  themeHolder.value = { theme: 'light', resolvedTheme: 'light' }

  // vite.config.ts sets `mockReset: true`, which strips the implementation off
  // the global matchMedia spy from tests/setup/vitest-setup.ts. sonner calls it
  // to resolve `theme="system"`, so give it a real (light) implementation back.
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  })) as unknown as typeof window.matchMedia
})

// ==========================================================================
// TOAST-01 — the app theme id must never reach sonner's data-sonner-theme
//
// The mapping is driven by next-themes' `resolvedTheme` (which never returns
// 'system'), NOT by `theme`. `THEMES.system.isDark` is hardcoded `true` and
// 'system' is the app default, so a `getThemeById(theme)?.isDark` mapping would
// hand every System-on-macOS-Light user a black toast on a white UI.
// ==========================================================================
type ThemeCase = {
  label: string
  theme: string
  resolvedTheme: string | undefined
  expected: 'light' | 'dark'
}

const CONCRETE_THEME_IDS = getAllThemeIds().filter(
  (id): id is Exclude<ThemeId, 'system'> => id !== 'system'
)

const THEME_CASES: ReadonlyArray<ThemeCase> = [
  ...CONCRETE_THEME_IDS.map((id) => ({
    label: id,
    theme: id,
    resolvedTheme: id,
    expected: (THEMES[id].isDark ? 'dark' : 'light') as 'light' | 'dark'
  })),
  {
    label: 'system resolved to light',
    theme: 'system',
    resolvedTheme: 'light',
    expected: 'light'
  },
  {
    label: 'system resolved to dark',
    theme: 'system',
    resolvedTheme: 'dark',
    expected: 'dark'
  },
  {
    label: 'an unknown theme id',
    theme: 'not-a-real-theme',
    resolvedTheme: 'not-a-real-theme',
    expected: 'light'
  }
]

describe('TOAST-01: sonner only ever sees a light/dark theme', () => {
  it('covers all 13 registered themes plus the resolved and unknown cases', () => {
    expect(getAllThemeIds()).toHaveLength(13)
    expect(CONCRETE_THEME_IDS).toHaveLength(12)
    expect(THEME_CASES).toHaveLength(15)
  })

  it.each(THEME_CASES)(
    'maps $label onto data-sonner-theme="$expected"',
    async ({ theme, resolvedTheme, expected }: ThemeCase) => {
      themeHolder.value = { theme, resolvedTheme }

      render(<Toaster />)
      const container = await fireToastAndGetContainer(() =>
        toast(`toast for ${theme}/${resolvedTheme}`)
      )

      const sonnerTheme = container.getAttribute('data-sonner-theme')

      // Whatever happens, sonner must be told a theme it actually has
      // stylesheet rules for — it only defines --normal-bg and friends under
      // its own `light` and `dark` selectors.
      expect(['light', 'dark']).toContain(sonnerTheme)
      expect(sonnerTheme).toBe(expected)
    }
  )

  it('does not map through the "system" pseudo-theme when it is the app default', async () => {
    // Documenting, not asserting a desired value: THEMES.system.isDark is
    // deliberately left as-is because other code may depend on it. That is
    // precisely why the mapping must read resolvedTheme instead.
    expect(THEMES.system.isDark).toBe(true)

    themeHolder.value = { theme: 'system', resolvedTheme: 'light' }

    render(<Toaster />)
    const container = await fireToastAndGetContainer(() => toast('system light toast'))

    expect(container.getAttribute('data-sonner-theme')).toBe('light')
  })
})

// ==========================================================================
// TOAST-02 — the toaster declares its own colour variables inline
// ==========================================================================
describe('TOAST-02: the toaster declares the theme tokens inline', () => {
  it('expects exactly 17 declarations', () => {
    expect(REQUIRED_TOAST_VARIABLES).toHaveLength(17)
  })

  it('declares all 17 sonner colour variables on [data-sonner-toaster]', async () => {
    themeHolder.value = { theme: 'dracula', resolvedTheme: 'dracula' }

    render(<Toaster />)
    const container = await fireToastAndGetContainer(() => toast('variables toast'))

    expectToastVariablesDeclared(container)
  })

  it('tints the popover background rather than filling with the solid accent', async () => {
    themeHolder.value = { theme: 'tokyo-night', resolvedTheme: 'tokyo-night' }

    render(<Toaster />)
    const container = await fireToastAndGetContainer(() => toast('tint toast'))
    const style = normaliseStyle(container)

    // The rejected mapping: a solid fill paired with *-foreground text.
    expect(style).not.toMatch(/--error-bg:\s*var\(\s*--color-destructive\s*\)\s*;/)
    expect(style).not.toMatch(
      /--error-text:\s*var\(\s*--color-destructive-foreground\s*\)/
    )
    expect(style).not.toMatch(/--success-bg:\s*var\(\s*--color-success\s*\)\s*;/)
  })
})

// ==========================================================================
// TOAST-04 — the shadcn group-[.toaster]: overrides are gone
// ==========================================================================
describe('TOAST-04: no group-[.toaster]: overrides remain', () => {
  it('does not use group-[.toaster]: utilities anywhere in sonner.tsx', () => {
    const source = fs.readFileSync(SONNER_SOURCE, 'utf8')

    expect(source).not.toContain('group-[.toaster]:')
  })
})

// ==========================================================================
// TOAST-05 — rich colours are on so severity is visually distinct
// ==========================================================================
describe('TOAST-05: rich colours are enabled by default', () => {
  it('marks error and success toasts with their type and rich-colors flag', async () => {
    themeHolder.value = { theme: 'one-light', resolvedTheme: 'one-light' }

    render(<Toaster />)
    await fireToastAndGetContainer(() => {
      toast.error('boom')
      toast.success('yay')
    })

    const toasts = Array.from(
      document.querySelectorAll<HTMLElement>('[data-sonner-toast]')
    )

    const errorToast = toasts.find((el) => el.textContent?.includes('boom'))
    const successToast = toasts.find((el) => el.textContent?.includes('yay'))

    expect(errorToast).toBeTruthy()
    expect(successToast).toBeTruthy()

    expect(errorToast?.getAttribute('data-type')).toBe('error')
    expect(successToast?.getAttribute('data-type')).toBe('success')

    expect(errorToast?.getAttribute('data-rich-colors')).toBe('true')
    expect(successToast?.getAttribute('data-rich-colors')).toBe('true')
  })
})

// ==========================================================================
// TOAST-06 — toasts stay readable above an open Radix dialog
// ==========================================================================
describe('TOAST-06: toasts rendered over an open dialog', () => {
  it('renders outside the dialog overlay and still declares its variables', async () => {
    themeHolder.value = { theme: 'catppuccin-mocha', resolvedTheme: 'catppuccin-mocha' }

    render(
      <>
        <Toaster />
        <Dialog open>
          <DialogContent>
            <DialogTitle>Add video</DialogTitle>
          </DialogContent>
        </Dialog>
      </>
    )

    const container = await fireToastAndGetContainer(() =>
      toast.error('Sprout rejected the upload: HTTP 413')
    )

    const toastEl = Array.from(
      document.querySelectorAll<HTMLElement>('[data-sonner-toast]')
    ).find((el) => el.textContent?.includes('HTTP 413'))

    expect(toastEl).toBeTruthy()

    const overlay = document.querySelector('.bg-black\\/80')
    expect(overlay).not.toBeNull()
    expect(overlay?.contains(toastEl as Node)).toBe(false)

    // Deliberately NOT asserting getComputedStyle(...).backgroundColor: vitest
    // runs without the app stylesheet, so such an assertion would be vacuous.
    expectToastVariablesDeclared(container)
  })
})
