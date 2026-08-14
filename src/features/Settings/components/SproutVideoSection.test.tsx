/**
 * SproutVideo settings section (issue #169, follow-up)
 *
 * The panel used to synthesise `{ id, name, path: name }` straight out of
 * `sproutDefaultFolderId` / `sproutDefaultFolderName` and hand it to the picker,
 * so a folder deleted or renamed on Sprout still read back as the configured
 * destination. #169 fixed exactly that in the upload flow; these pin the same
 * guarantee here.
 *
 * Only the two I/O boundaries are mocked -- Settings' own `api.ts` and `sonner`.
 * The real picker, the real index hook and the real classifier all run, so these
 * fail if the panel stops passing the stored values through validation. The
 * saved index is seeded into the query cache rather than read from disk, which is
 * also what pins the #155 R1 constraint: validation must cost **zero** Sprout
 * requests, asserted here on the IPC boundary rather than assumed.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'

import type { ApiKeys } from '../api'
import SproutVideoSection from './SproutVideoSection'

vi.mock('../api', () => ({
  saveSettingsApiKeys: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const API_KEY = 'sprout-key'

/**
 * The key `useSavedFolderIndex` reads under. Seeding it skips the disk read
 * without stubbing the hook, so the classifier still runs for real. If the key
 * ever changes, the seed misses, the index resolves to null and these tests fail
 * loudly rather than quietly stopping to test anything.
 */
const INDEX_KEY = ['sprout', 'folder-index', API_KEY]

/**
 * A complete index holding Marketing / Q2 Campaign. `account` is arbitrary here:
 * the fingerprint check lives in `parseFolderIndex`, which runs in the query
 * function that seeding bypasses.
 */
const INDEX = {
  version: 1,
  account: 'seeded',
  indexedAt: '2026-08-10T09:30:00.000Z',
  partial: false,
  folders: [
    { id: 'm1', name: 'Marketing', parent_id: null },
    { id: 'd1', name: 'Q2 Campaign', parent_id: 'm1' }
  ]
}

function renderSection(apiKeys: ApiKeys, savedIndex: unknown) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  })
  client.setQueryData(INDEX_KEY, savedIndex)
  return render(
    <QueryClientProvider client={client}>
      <SproutVideoSection apiKeys={{ sproutVideo: API_KEY, ...apiKeys }} />
    </QueryClientProvider>
  )
}

/** The picker states the destination in its trigger, so read it from there. */
const destination = () => screen.getByRole('button', { name: /^Folder:/ }).textContent

describe('the default upload folder the panel displays', () => {
  it('falls back to Root and says why when the index does not hold the stored folder', () => {
    renderSection(
      { sproutDefaultFolderId: 'gone', sproutDefaultFolderName: 'Marketing / Old Push' },
      INDEX
    )

    expect(destination()).toContain('Root (no folder)')
    expect(
      screen.getByText(/no longer among this account's indexed folders/i)
    ).toBeInTheDocument()
  })

  it("shows the folder's current breadcrumb when the index vouches for it", () => {
    // The stored label is the stale one captured at pick time; the index knows
    // the folder's real place in the tree and that is what must be shown.
    renderSection({ sproutDefaultFolderId: 'd1', sproutDefaultFolderName: 'Q2' }, INDEX)

    expect(destination()).toContain('Marketing / Q2 Campaign')
    expect(
      screen.queryByText(/no longer among this account's indexed folders/i)
    ).not.toBeInTheDocument()
  })

  it('offers the stored folder and accuses nothing when there is no index', () => {
    // Absence from an index that does not exist is not evidence of anything, and
    // re-checking against Sprout is not affordable. Say nothing.
    renderSection(
      { sproutDefaultFolderId: 'gone', sproutDefaultFolderName: 'Marketing / Old Push' },
      null
    )

    expect(destination()).toContain('Marketing / Old Push')
    expect(
      screen.queryByText(/no longer among this account's indexed folders/i)
    ).not.toBeInTheDocument()
  })

  it('spends no Sprout requests validating it', () => {
    const invoke = vi.mocked(
      (window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string) => unknown } })
        .__TAURI_INTERNALS__.invoke
    )

    renderSection(
      { sproutDefaultFolderId: 'gone', sproutDefaultFolderName: 'Marketing / Old Push' },
      INDEX
    )

    expect(destination()).toContain('Root (no folder)')
    const commands = invoke.mock.calls.map(([command]) => command)
    expect(commands).not.toContain('get_folders')
  })
})
