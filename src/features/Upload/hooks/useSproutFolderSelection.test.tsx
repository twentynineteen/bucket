/**
 * useSproutFolderSelection (issue #155, Phase 5)
 *
 * The precedence rule -- session last-used → Settings default → Root -- lives
 * in one place so entry points cannot each invent their own. These pin it.
 */
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { useApiKeysMock } = vi.hoisted(() => ({ useApiKeysMock: vi.fn() }))
vi.mock('@shared/hooks', () => ({ useApiKeys: useApiKeysMock }))

import { useAppStore } from '@shared/store'

import { useSproutFolderSelection } from './useSproutFolderSelection'

const folderA = { id: 'a', name: 'Alpha', path: 'Alpha' }
const folderB = { id: 'b', name: 'Beta', path: 'Marketing / Beta' }

beforeEach(() => {
  useApiKeysMock.mockReturnValue({ data: {} })
  useAppStore.setState({ recentSproutFolders: [] })
})

describe('precedence', () => {
  it('falls back to Root when nothing is set', () => {
    const { result } = renderHook(() => useSproutFolderSelection())
    expect(result.current.selectedFolder).toBeNull()
  })

  it('uses the Settings default when there is no session history', () => {
    useApiKeysMock.mockReturnValue({
      data: { sproutDefaultFolderId: 'd1', sproutDefaultFolderName: 'Defaults' }
    })

    const { result } = renderHook(() => useSproutFolderSelection())

    expect(result.current.selectedFolder).toMatchObject({ id: 'd1', name: 'Defaults' })
  })

  it('prefers the session last-used folder over the Settings default', () => {
    useApiKeysMock.mockReturnValue({
      data: { sproutDefaultFolderId: 'd1', sproutDefaultFolderName: 'Defaults' }
    })
    useAppStore.setState({ recentSproutFolders: [folderA] })

    const { result } = renderHook(() => useSproutFolderSelection())

    expect(result.current.selectedFolder).toEqual(folderA)
  })

  it('lets an explicit Root choice beat a default', () => {
    // `undefined` (not chosen) and `null` (chose Root) must stay distinct, or
    // Root becomes unselectable whenever a default exists.
    useApiKeysMock.mockReturnValue({
      data: { sproutDefaultFolderId: 'd1', sproutDefaultFolderName: 'Defaults' }
    })

    const { result } = renderHook(() => useSproutFolderSelection())
    act(() => result.current.selectFolder(null))

    expect(result.current.selectedFolder).toBeNull()
  })
})

describe('recently used', () => {
  it('remembers a folder only once an upload has used it', () => {
    const { result } = renderHook(() => useSproutFolderSelection())

    expect(result.current.recentFolders).toEqual([])
    act(() => result.current.commitFolder(folderA))

    expect(result.current.recentFolders).toEqual([folderA])
  })

  it('does not record Root as a destination worth remembering', () => {
    const { result } = renderHook(() => useSproutFolderSelection())
    act(() => result.current.commitFolder(null))

    expect(result.current.recentFolders).toEqual([])
  })

  it('moves a repeat folder back to the front rather than duplicating it', () => {
    const { result } = renderHook(() => useSproutFolderSelection())

    act(() => result.current.commitFolder(folderA))
    act(() => result.current.commitFolder(folderB))
    act(() => result.current.commitFolder(folderA))

    expect(result.current.recentFolders).toEqual([folderA, folderB])
  })

  it('keeps at most five', () => {
    const { result } = renderHook(() => useSproutFolderSelection())

    act(() => {
      for (let i = 0; i < 8; i++) {
        result.current.commitFolder({ id: `f${i}`, name: `F${i}`, path: `F${i}` })
      }
    })

    expect(result.current.recentFolders).toHaveLength(5)
    expect(result.current.recentFolders[0].id).toBe('f7')
  })
})
