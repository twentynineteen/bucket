/**
 * Tests for useBackgroundFolder - the three-state classification and its
 * user-facing reasons.
 * Issue #166 (B2.1-B2.9, B3.1-B3.4)
 *
 * The hook must distinguish six situations that all rendered identically
 * before: settings still loading, settings unreadable, no folder configured,
 * listing in flight, folder unusable, and folder empty.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAppStore } from '@shared/store'
import { logger } from '@shared/utils'

import * as api from '../api'
import { useBackgroundFolder } from './useBackgroundFolder'

vi.mock('../api', () => ({
  listDirectory: vi.fn()
}))

vi.mock('@shared/hooks', () => ({
  useApiKeys: vi.fn()
}))

vi.mock('@shared/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shared/utils')>()
  return { ...actual, logger: { ...actual.logger, error: vi.fn(), warn: vi.fn() } }
})

import { useApiKeys } from '@shared/hooks'

const DEFAULT_FOLDER = '/backgrounds'
const SESSION_FOLDER = '/Volumes/Media/bgs'

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } }
  })
  return React.createElement(QueryClientProvider, { client: queryClient }, children)
}

/**
 * A client whose default IS to retry, so a test asserting "did not retry"
 * actually exercises the query's own `retry: false` rather than the harness's.
 */
function retryingWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 3, retryDelay: 1, gcTime: 0 } }
  })
  return React.createElement(QueryClientProvider, { client: queryClient }, children)
}

/** Settings query resolved successfully. */
function settingsLoaded() {
  vi.mocked(useApiKeys).mockReturnValue({
    isPending: false,
    isError: false,
    error: null
  } as never)
}

describe('useBackgroundFolder - state classification (#166)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAppStore.setState({ defaultBackgroundFolder: DEFAULT_FOLDER })
    settingsLoaded()
    vi.mocked(api.listDirectory).mockResolvedValue({ status: 'ok', files: [] })
  })

  it('b2_1_reports_unknown_and_reads_nothing_while_settings_are_pending', async () => {
    vi.mocked(useApiKeys).mockReturnValue({
      isPending: true,
      isError: false,
      error: null
    } as never)

    const { result } = renderHook(() => useBackgroundFolder(), { wrapper })

    expect(result.current.status).toBe('unknown')
    expect(result.current.reason).toBeNull()
    expect(api.listDirectory).not.toHaveBeenCalled()
  })

  it('b2_2_explains_that_the_folder_is_unknown_when_settings_could_not_be_read', async () => {
    vi.mocked(useApiKeys).mockReturnValue({
      isPending: false,
      isError: true,
      error: new Error('unparseable')
    } as never)

    const { result } = renderHook(() => useBackgroundFolder(), { wrapper })

    expect(result.current.status).toBe('settings-error')
    expect(result.current.reason).toBe(
      'Could not read your settings, so the background folder is unknown.'
    )
  })

  it('b2_3_explains_that_no_folder_is_configured_once_settings_have_loaded', async () => {
    useAppStore.setState({ defaultBackgroundFolder: null })

    const { result } = renderHook(() => useBackgroundFolder(), { wrapper })

    expect(result.current.status).toBe('not-configured')
    expect(result.current.reason).toBe(
      'No default background folder configured. Set one in Settings.'
    )
    expect(api.listDirectory).not.toHaveBeenCalled()
  })

  it('b2_4_reports_no_reason_while_the_listing_is_in_flight', async () => {
    vi.mocked(api.listDirectory).mockReturnValue(new Promise(() => {}) as never)

    const { result } = renderHook(() => useBackgroundFolder(), { wrapper })

    expect(result.current.status).toBe('loading')
    expect(result.current.reason).toBeNull()
  })

  it('b2_5_names_the_path_when_the_folder_is_missing', async () => {
    vi.mocked(api.listDirectory).mockResolvedValue({ status: 'missing' })

    const { result } = renderHook(() => useBackgroundFolder(), { wrapper })

    await waitFor(() => expect(result.current.status).toBe('cannot-read'))
    expect(result.current.reason).toBe(`Cannot read background folder: ${DEFAULT_FOLDER}`)
  })

  it('b2_5_gives_the_same_message_when_the_folder_is_unreadable', async () => {
    vi.mocked(api.listDirectory).mockResolvedValue({
      status: 'unreadable',
      detail: 'os error 13'
    })

    const { result } = renderHook(() => useBackgroundFolder(), { wrapper })

    await waitFor(() => expect(result.current.status).toBe('cannot-read'))
    expect(result.current.reason).toBe(`Cannot read background folder: ${DEFAULT_FOLDER}`)
  })

  it('b2_6_logs_the_unreadable_detail_and_keeps_it_out_of_the_reason', async () => {
    vi.mocked(api.listDirectory).mockResolvedValue({
      status: 'unreadable',
      detail: 'os error 13'
    })

    const { result } = renderHook(() => useBackgroundFolder(), { wrapper })

    await waitFor(() => expect(result.current.status).toBe('cannot-read'))
    expect(result.current.reason).not.toContain('os error 13')
    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      expect.stringContaining('os error 13')
    )
  })

  it('b2_7_explains_an_empty_folder', async () => {
    vi.mocked(api.listDirectory).mockResolvedValue({ status: 'ok', files: [] })

    const { result } = renderHook(() => useBackgroundFolder(), { wrapper })

    await waitFor(() => expect(result.current.status).toBe('empty'))
    expect(result.current.reason).toBe('The background folder contains no image files.')
  })

  it('b2_8_reports_ready_with_the_files_when_the_folder_has_images', async () => {
    vi.mocked(api.listDirectory).mockResolvedValue({
      status: 'ok',
      files: ['/backgrounds/a.jpg']
    })

    const { result } = renderHook(() => useBackgroundFolder(), { wrapper })

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.reason).toBeNull()
    expect(result.current.files).toEqual(['/backgrounds/a.jpg'])
  })

  it('b2_9_surfaces_an_unexpected_rejection_without_retrying', async () => {
    vi.mocked(api.listDirectory).mockRejectedValue(new Error('boom'))

    // Deliberately a client that DOES retry: with `retry: false` in the wrapper
    // defaults this assertion could not fail, because nothing would retry even
    // without the query's own override.
    const { result } = renderHook(() => useBackgroundFolder(), {
      wrapper: retryingWrapper
    })

    await waitFor(() => expect(result.current.status).toBe('cannot-read'))
    // One attempt only: a deterministic failure must not burn ~7s of backoff.
    expect(api.listDirectory).toHaveBeenCalledTimes(1)
  })
})

describe('useBackgroundFolder - session override (#166)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAppStore.setState({ defaultBackgroundFolder: DEFAULT_FOLDER })
    settingsLoaded()
    vi.mocked(api.listDirectory).mockResolvedValue({
      status: 'ok',
      files: ['/x/a.jpg']
    })
  })

  it('b3_1_uses_a_picked_folder_for_the_session_without_touching_the_default', async () => {
    const { result } = renderHook(() => useBackgroundFolder(), { wrapper })

    await act(async () => {
      await result.current.loadFolder(SESSION_FOLDER)
    })

    expect(result.current.folderInUse).toBe(SESSION_FOLDER)
    expect(useAppStore.getState().defaultBackgroundFolder).toBe(DEFAULT_FOLDER)
  })

  it('b3_2_exposes_the_override_and_the_default_separately', async () => {
    const { result } = renderHook(() => useBackgroundFolder(), { wrapper })

    await act(async () => {
      await result.current.loadFolder(SESSION_FOLDER)
    })

    expect(result.current.isSessionOverride).toBe(true)
    expect(result.current.defaultFolder).toBe(DEFAULT_FOLDER)
  })

  it('b3_3_returns_to_the_default_when_the_override_is_reset', async () => {
    const { result } = renderHook(() => useBackgroundFolder(), { wrapper })

    await act(async () => {
      await result.current.loadFolder(SESSION_FOLDER)
    })
    act(() => {
      result.current.useDefaultFolder()
    })

    expect(result.current.folderInUse).toBe(DEFAULT_FOLDER)
    expect(result.current.isSessionOverride).toBe(false)
  })

  it('b3_4_reports_no_override_before_any_folder_is_picked', async () => {
    const { result } = renderHook(() => useBackgroundFolder(), { wrapper })

    expect(result.current.isSessionOverride).toBe(false)
    expect(result.current.folderInUse).toBe(DEFAULT_FOLDER)
  })
})
