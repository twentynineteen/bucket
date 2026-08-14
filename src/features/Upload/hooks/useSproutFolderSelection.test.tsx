/**
 * useSproutFolderSelection (issues #155 Phase 5, #169)
 *
 * The precedence rule -- session last-used → Settings default → Root -- lives
 * in one place so entry points cannot each invent their own. These pin it.
 *
 * They also pin the #169 half: the stored default is validated against the saved
 * folder index rather than trusted, and the settings read error is reported
 * instead of swallowed. Sprout allows 200 requests/minute account-wide (#155
 * R1), so validation must cost zero requests -- asserted, not assumed.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { useApiKeysMock } = vi.hoisted(() => ({ useApiKeysMock: vi.fn() }))
vi.mock('@shared/hooks', () => ({ useApiKeys: useApiKeysMock }))

vi.mock('../api', () => ({
  readFolderIndex: vi.fn(),
  getFolders: vi.fn()
}))

import type { SproutFolder } from '@shared/types'
import { useAppStore } from '@shared/store'

import { getFolders, readFolderIndex } from '../api'
import { accountFingerprint, createFolderIndex } from '../internal/folderIndex'
import { useSproutFolderSelection } from './useSproutFolderSelection'

const folderA = { id: 'a', name: 'Alpha', path: 'Alpha' }
const folderB = { id: 'b', name: 'Beta', path: 'Marketing / Beta' }

const API_KEY = 'sprout-key'
const NOW_ISO = '2026-08-10T09:30:00.000Z'

/** The stored default, as Settings writes it: id plus the label at pick time. */
const withDefault = (extra: Record<string, unknown> = {}) => ({
  data: {
    sproutVideo: API_KEY,
    sproutDefaultFolderId: 'd1',
    sproutDefaultFolderName: 'Defaults',
    ...extra
  }
})

const TREE: SproutFolder[] = [
  { id: 'm1', name: 'Marketing', parent_id: null },
  { id: 'd1', name: 'Q2 Campaign', parent_id: 'm1' }
]

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } }
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const render = () => renderHook(() => useSproutFolderSelection(), { wrapper })

beforeEach(() => {
  useApiKeysMock.mockReturnValue({ data: {} })
  useAppStore.setState({ recentSproutFolders: [] })
  vi.mocked(readFolderIndex).mockResolvedValue(null)
  vi.mocked(getFolders).mockReset()
})

describe('precedence', () => {
  it('falls back to Root when nothing is set', () => {
    const { result } = render()
    expect(result.current.selectedFolder).toBeNull()
    expect(result.current.defaultFolderStatus).toBe('not-configured')
    expect(result.current.defaultFolderReason).toBeNull()
  })

  it('uses the Settings default when there is no session history', () => {
    useApiKeysMock.mockReturnValue(withDefault())

    const { result } = render()

    expect(result.current.selectedFolder).toMatchObject({ id: 'd1', name: 'Defaults' })
  })

  it('prefers the session last-used folder over the Settings default', () => {
    useApiKeysMock.mockReturnValue(withDefault())
    useAppStore.setState({ recentSproutFolders: [folderA] })

    const { result } = render()

    expect(result.current.selectedFolder).toEqual(folderA)
  })

  it('lets an explicit Root choice beat a default', () => {
    // `undefined` (not chosen) and `null` (chose Root) must stay distinct, or
    // Root becomes unselectable whenever a default exists.
    useApiKeysMock.mockReturnValue(withDefault())

    const { result } = render()
    act(() => result.current.selectFolder(null))

    expect(result.current.selectedFolder).toBeNull()
  })
})

describe('the settings read failing', () => {
  it('reports it instead of silently offering Root', () => {
    useApiKeysMock.mockReturnValue({ data: undefined, isError: true })

    const { result } = render()

    expect(result.current.defaultFolderStatus).toBe('settings-error')
    expect(result.current.defaultFolderReason).toMatch(/could not read your settings/i)
    expect(result.current.selectedFolder).toBeNull()
  })

  it('says nothing at all while the settings read is still in flight', () => {
    useApiKeysMock.mockReturnValue({ data: undefined, isPending: true })

    const { result } = render()

    expect(result.current.defaultFolderStatus).toBe('unknown')
    expect(result.current.defaultFolderReason).toBeNull()
  })
})

describe('validating the stored default against the saved index', () => {
  it('spends no Sprout requests doing it', async () => {
    useApiKeysMock.mockReturnValue(withDefault())
    vi.mocked(readFolderIndex).mockResolvedValue(
      createFolderIndex(API_KEY, TREE, false, NOW_ISO)
    )

    const { result } = render()
    await waitFor(() => expect(result.current.defaultFolderStatus).toBe('verified'))

    expect(getFolders).not.toHaveBeenCalled()
  })

  it('leaves the stored folder alone when there is no index to check it against', async () => {
    useApiKeysMock.mockReturnValue(withDefault())

    const { result } = render()
    await waitFor(() => expect(readFolderIndex).toHaveBeenCalled())

    expect(result.current.defaultFolderStatus).toBe('unverified')
    expect(result.current.defaultFolderReason).toBeNull()
    expect(result.current.selectedFolder).toMatchObject({ id: 'd1' })
  })

  it('takes the current name and full path from the index, not the stored label', async () => {
    useApiKeysMock.mockReturnValue(withDefault())
    vi.mocked(readFolderIndex).mockResolvedValue(
      createFolderIndex(API_KEY, TREE, false, NOW_ISO)
    )

    const { result } = render()
    await waitFor(() => expect(result.current.defaultFolderStatus).toBe('verified'))

    expect(result.current.selectedFolder).toEqual({
      id: 'd1',
      name: 'Q2 Campaign',
      path: 'Marketing / Q2 Campaign'
    })
  })

  it('reports a folder a complete index does not contain, and does not offer it', async () => {
    useApiKeysMock.mockReturnValue(withDefault())
    vi.mocked(readFolderIndex).mockResolvedValue(
      createFolderIndex(
        API_KEY,
        TREE.filter((folder) => folder.id !== 'd1'),
        false,
        NOW_ISO
      )
    )

    const { result } = render()
    await waitFor(() => expect(result.current.defaultFolderStatus).toBe('missing'))

    expect(result.current.defaultFolderReason).toMatch(/"Defaults"/)
    expect(result.current.defaultFolderReason).toMatch(/deleted or renamed/i)
    expect(result.current.selectedFolder).toBeNull()
  })

  it('does not accuse on a partial index, which is not evidence of absence', async () => {
    useApiKeysMock.mockReturnValue(withDefault())
    vi.mocked(readFolderIndex).mockResolvedValue(
      createFolderIndex(
        API_KEY,
        TREE.filter((folder) => folder.id !== 'd1'),
        true,
        NOW_ISO
      )
    )

    const { result } = render()
    await waitFor(() => expect(readFolderIndex).toHaveBeenCalled())

    expect(result.current.defaultFolderStatus).toBe('unverified')
    expect(result.current.defaultFolderReason).toBeNull()
    expect(result.current.selectedFolder).toMatchObject({ id: 'd1' })
  })

  it('does not accuse on an index built for another account', async () => {
    useApiKeysMock.mockReturnValue(withDefault())
    // A different account's index cannot speak for this one, and its ids may
    // even collide -- parseFolderIndex discards it on the fingerprint.
    vi.mocked(readFolderIndex).mockResolvedValue(
      createFolderIndex('someone-elses-key', [], false, NOW_ISO)
    )

    const { result } = render()
    await waitFor(() => expect(readFolderIndex).toHaveBeenCalled())

    expect(result.current.defaultFolderStatus).toBe('unverified')
    expect(result.current.defaultFolderReason).toBeNull()
    expect(accountFingerprint('someone-elses-key')).not.toBe(accountFingerprint(API_KEY))
  })

  it('offers the stored folder while the index is still being read, then judges it', async () => {
    useApiKeysMock.mockReturnValue(withDefault())
    let release: (value: unknown) => void = () => {}
    vi.mocked(readFolderIndex).mockReturnValue(
      new Promise((resolve) => {
        release = resolve
      })
    )

    const { result } = render()

    // No accusation may flash before the file has even been read.
    expect(result.current.defaultFolderStatus).toBe('unverified')
    expect(result.current.selectedFolder).toMatchObject({ id: 'd1' })

    await act(async () => {
      release(
        createFolderIndex(
          API_KEY,
          TREE.filter((folder) => folder.id !== 'd1'),
          false,
          NOW_ISO
        )
      )
    })

    await waitFor(() => expect(result.current.defaultFolderStatus).toBe('missing'))
  })

  it('keeps the session folder even when the stored default is missing', async () => {
    useApiKeysMock.mockReturnValue(withDefault())
    useAppStore.setState({ recentSproutFolders: [folderA] })
    vi.mocked(readFolderIndex).mockResolvedValue(
      createFolderIndex(
        API_KEY,
        TREE.filter((folder) => folder.id !== 'd1'),
        false,
        NOW_ISO
      )
    )

    const { result } = render()
    await waitFor(() => expect(result.current.defaultFolderStatus).toBe('missing'))

    expect(result.current.selectedFolder).toEqual(folderA)
  })
})

describe('recently used', () => {
  it('remembers a folder only once an upload has used it', () => {
    const { result } = render()

    expect(result.current.recentFolders).toEqual([])
    act(() => result.current.commitFolder(folderA))

    expect(result.current.recentFolders).toEqual([folderA])
  })

  it('does not record Root as a destination worth remembering', () => {
    const { result } = render()
    act(() => result.current.commitFolder(null))

    expect(result.current.recentFolders).toEqual([])
  })

  it('moves a repeat folder back to the front rather than duplicating it', () => {
    const { result } = render()

    act(() => result.current.commitFolder(folderA))
    act(() => result.current.commitFolder(folderB))
    act(() => result.current.commitFolder(folderA))

    expect(result.current.recentFolders).toEqual([folderA, folderB])
  })

  it('keeps at most five', () => {
    const { result } = render()

    act(() => {
      for (let i = 0; i < 8; i++) {
        result.current.commitFolder({ id: `f${i}`, name: `F${i}`, path: `F${i}` })
      }
    })

    expect(result.current.recentFolders).toHaveLength(5)
    expect(result.current.recentFolders[0].id).toBe('f7')
  })
})
