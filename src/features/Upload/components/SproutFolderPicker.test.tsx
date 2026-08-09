/**
 * SproutFolderPicker (issue #155)
 *
 * Two of these pin Radix behaviours that fail *silently* if the workarounds are
 * ever removed -- a filter box that dies after one keystroke, and a menu that
 * clips long folder levels with no scrollbar. Both look like styling bugs and
 * neither throws.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../api', () => ({ getFolders: vi.fn() }))

import { getFolders } from '../api'
import type { SelectedSproutFolder } from '../types'
import { SproutFolderPicker } from './SproutFolderPicker'

const rootPage = {
  folders: [
    { id: 'f1', name: 'Marketing', parent_id: null },
    { id: 'f2', name: '2026 Projects', parent_id: null }
  ],
  total: 2,
  truncated: false,
  rate_limit_remaining: 190,
  rate_limit_reset: null
}

function renderPicker(
  props: Partial<React.ComponentProps<typeof SproutFolderPicker>> = {}
) {
  const onChange = vi.fn()
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } }
  })

  render(
    <QueryClientProvider client={client}>
      <SproutFolderPicker apiKey="key-1" value={null} onChange={onChange} {...props} />
    </QueryClientProvider>
  )

  return { onChange, client }
}

// The global setup mocks getBoundingClientRect with `vi.fn(() => ({...}))`,
// returning a FRESH object on every call. Radix's popper re-measures on each
// render and treats each new object as a change, so it re-renders forever.
// A stable rect breaks that loop without changing any measured value.
const STABLE_RECT = {
  width: 800,
  height: 600,
  top: 0,
  left: 0,
  bottom: 600,
  right: 800,
  x: 0,
  y: 0,
  toJSON: () => ({})
} as DOMRect

beforeEach(() => {
  vi.mocked(getFolders).mockResolvedValue(rootPage)
  Element.prototype.getBoundingClientRect = () => STABLE_RECT
})

describe('selection', () => {
  it('defaults to Root and says so on the trigger', () => {
    renderPicker()
    expect(
      screen.getByRole('button', { name: /Root \(no folder\)/i })
    ).toBeInTheDocument()
  })

  it('shows the full breadcrumb path, not just the leaf name', () => {
    // `Q2 Campaign` under two different parents is otherwise ambiguous.
    const value: SelectedSproutFolder = {
      id: 'f9',
      name: 'Q2 Campaign',
      path: 'Marketing / Q2 Campaign'
    }
    renderPicker({ value })

    expect(
      screen.getByRole('button', { name: /Marketing \/ Q2 Campaign/ })
    ).toBeInTheDocument()
  })

  it('selects Root without navigating anywhere', async () => {
    const user = userEvent.setup()
    const { onChange } = renderPicker({
      value: { id: 'f1', name: 'Marketing', path: 'Marketing' }
    })

    await user.click(screen.getByRole('button'))
    await user.click(await screen.findByText('Root (no folder)'))

    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('offers recently used folders in one click', async () => {
    const user = userEvent.setup()
    const recent: SelectedSproutFolder[] = [
      { id: 'r1', name: 'Module X', path: '2026 Projects / MSc / Module X' }
    ]
    const { onChange } = renderPicker({ recentFolders: recent })

    await user.click(screen.getByRole('button'))
    await user.click(await screen.findByText('2026 Projects / MSc / Module X'))

    expect(onChange).toHaveBeenCalledWith(recent[0])
  })
})

describe('no API key', () => {
  it('disables the control and points at Settings rather than showing an empty tree', () => {
    renderPicker({ apiKey: null })

    const trigger = screen.getByRole('button')
    expect(trigger).toBeDisabled()
    expect(trigger).toHaveTextContent(/Settings/i)
  })

  it('never calls the API without a key', async () => {
    renderPicker({ apiKey: null })
    expect(getFolders).not.toHaveBeenCalled()
  })
})

describe('Radix regressions', () => {
  it('keeps focus in the filter input across multiple keystrokes', async () => {
    // Radix fires typeahead for any single character typed inside menu content
    // -- including in an <input> -- and typeahead calls .focus() on a matching
    // item. Without stopPropagation the box takes one character and goes dead.
    const user = userEvent.setup()
    renderPicker()

    await user.click(screen.getByRole('button'))
    const input = await screen.findByLabelText('Filter loaded folders')

    await user.type(input, 'mark')

    expect(input).toHaveValue('mark')
    expect(document.activeElement).toBe(input)
  })

  it('caps the menu height and makes it scrollable', async () => {
    // Radix menus do not scroll, and the base class is `overflow-hidden`. A
    // 40-folder level would be clipped with its tail unreachable -- which would
    // silently undo the backend pagination fix.
    const user = userEvent.setup()
    renderPicker()

    await user.click(screen.getByRole('button'))
    const menu = await screen.findByRole('menu')

    expect(menu.className).toMatch(/max-h-\[300px\]/)
    expect(menu.className).toMatch(/overflow-y-auto/)
  })
})

describe('filtering is zero-request', () => {
  it('issues no API call while filtering', async () => {
    const user = userEvent.setup()
    renderPicker()

    await user.click(screen.getByRole('button'))
    const callsAfterOpen = vi.mocked(getFolders).mock.calls.length

    await user.type(await screen.findByLabelText('Filter loaded folders'), 'zzz')

    // Filtering only ever searches what is already cached (#155 R1).
    expect(vi.mocked(getFolders).mock.calls.length).toBe(callsAfterOpen)
  })

  it('explains that filtering only covers folders already opened', async () => {
    const user = userEvent.setup()
    renderPicker()

    await user.click(screen.getByRole('button'))
    await user.type(await screen.findByLabelText('Filter loaded folders'), 'zzzz')

    expect(await screen.findByText(/never fetches/i)).toBeInTheDocument()
  })
})

describe('failure does not block uploading', () => {
  it('shows an actionable error and says root upload still works', async () => {
    vi.mocked(getFolders).mockRejectedValue(
      'Sprout rejected the folder request: HTTP 401 — check your Sprout Video API key in Settings.'
    )
    const user = userEvent.setup()
    renderPicker()

    await user.click(screen.getByRole('button'))

    await waitFor(() =>
      expect(
        screen.getByText(/You can still upload to the root folder/i)
      ).toBeInTheDocument()
    )
    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument()
  })
})
