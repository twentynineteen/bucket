/**
 * SproutFolderPicker theme legibility (issue #155)
 *
 * The old FolderTreeSprout styled itself with inline `marginLeft` and no colour
 * tokens at all, so it ignored every theme. This asserts the replacement carries
 * theme tokens rather than fixed colours, in each of the 13 themes.
 *
 * jsdom does not evaluate Tailwind, so this checks the *token contract* --
 * that colours come from theme variables and never from hardcoded values --
 * which is the property that actually breaks per-theme.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../api', () => ({ getFolders: vi.fn() }))

import { getAllThemeIds } from '@shared/ui/theme/themes'

import { getFolders } from '../api'
import { SproutFolderPicker } from './SproutFolderPicker'

const rootPage = {
  folders: [{ id: 'f1', name: 'Marketing', parent_id: null }],
  total: 1,
  truncated: false,
  rate_limit_remaining: 190,
  rate_limit_reset: null
}

/** Colour utilities that would pin the component to one theme. */
const HARDCODED_COLOUR =
  /\b(?:bg|text|border)-(?:white|black|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3})\b/

function renderPicker() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } }
  })
  render(
    <QueryClientProvider client={client}>
      <SproutFolderPicker apiKey="key-1" value={null} onChange={vi.fn()} />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.mocked(getFolders).mockResolvedValue(rootPage)
})

describe('theme coverage', () => {
  it('the app still has 13 themes (guards this suite against drift)', () => {
    expect(getAllThemeIds()).toHaveLength(13)
  })
})

describe('the picker is theme-driven, not hardcoded', () => {
  it('renders the trigger with theme tokens', () => {
    renderPicker()

    const trigger = screen.getByRole('button')
    expect(trigger.className).not.toMatch(HARDCODED_COLOUR)
  })

  it('renders the menu surface with popover tokens', async () => {
    const user = userEvent.setup()
    renderPicker()

    await user.click(screen.getByRole('button'))
    const menu = await screen.findByRole('menu')

    // bg-popover / text-popover-foreground are redefined per theme; a literal
    // colour here would be legible in some themes and invisible in others.
    expect(menu.className).toMatch(/bg-popover/)
    expect(menu.className).toMatch(/text-popover-foreground/)
    expect(menu.className).not.toMatch(HARDCODED_COLOUR)
  })

  it('renders every menu row without a hardcoded colour', async () => {
    const user = userEvent.setup()
    renderPicker()

    await user.click(screen.getByRole('button'))
    const items = await screen.findAllByRole('menuitem')

    expect(items.length).toBeGreaterThan(0)
    for (const item of items) {
      expect(item.className).not.toMatch(HARDCODED_COLOUR)
    }
  })

  it('uses the destructive token for errors rather than a literal red', async () => {
    vi.mocked(getFolders).mockRejectedValue(
      'Sprout rejected the folder request: HTTP 401 — check your Sprout Video API key in Settings.'
    )
    const user = userEvent.setup()
    renderPicker()

    await user.click(screen.getByRole('button'))
    const error = await screen.findByText(/check your Sprout Video API key/i)

    expect(error.closest('p')?.className).toMatch(/text-destructive/)
    expect(error.closest('p')?.className).not.toMatch(HARDCODED_COLOUR)
  })
})
