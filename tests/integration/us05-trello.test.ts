/**
 * Integration Test: US-05 — Trello Board & Card Management
 *
 * As a user with Trello credentials configured, when I navigate to a project
 * with Trello integration, I can view available boards and the app conditionally
 * fetches them only when credentials are present.
 *
 * Tests the useTrelloBoards hook (React Query, enabled guard on API keys).
 * Mocking strategy: mock the Trello api.ts module and @shared/hooks; no direct
 * @tauri-apps imports.
 *
 * Note: vite.config.ts has `mockReset: true` so mock implementations must be
 * restored in beforeEach.
 */

import { useTrelloBoards } from '../../src/features/Trello/hooks/useTrelloBoards'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import React from 'react'

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } }
  })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children)
}

// Mock the Trello api.ts layer (single I/O boundary for Trello module)
vi.mock('../../src/features/Trello/api', () => ({
  fetchTrelloBoards: vi.fn().mockResolvedValue([]),
  fetchBoardCards: vi.fn().mockResolvedValue([]),
  fetchBoardLists: vi.fn().mockResolvedValue([]),
  fetchCardMembers: vi.fn().mockResolvedValue([]),
  fetchTrelloCardById: vi.fn().mockResolvedValue(null),
  readBreadcrumbsFile: vi.fn().mockResolvedValue('{}'),
  writeBreadcrumbsFile: vi.fn().mockResolvedValue(undefined),
  updateTrelloCardDesc: vi.fn().mockResolvedValue({ ok: true }),
  addTrelloCardComment: vi.fn().mockResolvedValue({ ok: true })
}))

// Mock @shared/hooks to control useApiKeys behavior in useTrelloBoards
vi.mock('@shared/hooks', () => ({
  useApiKeys: vi.fn().mockReturnValue({
    data: null,
    isLoading: false,
    error: null
  }),
  useSproutVideoApiKey: vi.fn().mockReturnValue({ apiKey: null, isLoading: false, error: null }),
  useTrelloApiKeys: vi.fn().mockReturnValue({
    apiKey: null,
    apiToken: null,
    isLoading: false,
    error: null
  }),
  useBreadcrumb: vi.fn(),
  useFuzzySearch: vi.fn().mockReturnValue({
    searchTerm: '',
    setSearchTerm: vi.fn(),
    results: []
  }),
  useReducedMotion: vi.fn().mockReturnValue(false),
  useUsername: vi.fn().mockReturnValue({ username: null, isLoading: false }),
  useIsMobile: vi.fn().mockReturnValue(false)
}))

// Shared mock data
const MOCK_BOARDS = [
  { id: 'board-1', name: 'Project Alpha', url: 'https://trello.com/b/abc/project-alpha' },
  { id: 'board-2', name: 'Project Beta', url: 'https://trello.com/b/def/project-beta' },
  {
    id: 'board-3',
    name: 'Content Calendar',
    url: 'https://trello.com/b/ghi/content-calendar'
  }
]

// ============================================================================
// US-05: Trello Board Management via useTrelloBoards
// ============================================================================

describe('US-05 — Trello: Board Management (useTrelloBoards)', () => {
  beforeEach(async () => {
    // mockReset: true clears mock implementations — restore defaults here
    const { fetchTrelloBoards } = await import('../../src/features/Trello/api')
    const { useApiKeys } = await import('@shared/hooks')

    vi.mocked(fetchTrelloBoards).mockResolvedValue(MOCK_BOARDS as any)
    vi.mocked(useApiKeys).mockReturnValue({
      data: {
        trello: 'test-api-key',
        trelloToken: 'test-api-token',
        sproutVideo: ''
      },
      isLoading: false,
      error: null
    } as any)
  })

  it('US-05a — should return empty boards when no API keys are configured', async () => {
    const { useApiKeys } = await import('@shared/hooks')
    vi.mocked(useApiKeys).mockReturnValue({
      data: null,
      isLoading: false,
      error: null
    } as any)

    const { result } = renderHook(() => useTrelloBoards(), {
      wrapper: makeWrapper()
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.boards).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('US-05b — should not fetch boards when only trello API key is missing', async () => {
    const { fetchTrelloBoards } = await import('../../src/features/Trello/api')
    const { useApiKeys } = await import('@shared/hooks')

    vi.mocked(useApiKeys).mockReturnValue({
      data: { trello: '', trelloToken: 'test-token', sproutVideo: '' },
      isLoading: false,
      error: null
    } as any)

    renderHook(() => useTrelloBoards(), { wrapper: makeWrapper() })

    // Wait a tick to ensure no fetch is triggered
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(fetchTrelloBoards).not.toHaveBeenCalled()
  })

  it('US-05c — should not fetch boards when only trello token is missing', async () => {
    const { fetchTrelloBoards } = await import('../../src/features/Trello/api')
    const { useApiKeys } = await import('@shared/hooks')

    vi.mocked(useApiKeys).mockReturnValue({
      data: { trello: 'test-key', trelloToken: '', sproutVideo: '' },
      isLoading: false,
      error: null
    } as any)

    renderHook(() => useTrelloBoards(), { wrapper: makeWrapper() })

    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(fetchTrelloBoards).not.toHaveBeenCalled()
  })

  it('US-05d — should fetch and return all boards when credentials are present', async () => {
    const { result } = renderHook(() => useTrelloBoards(), {
      wrapper: makeWrapper()
    })

    await waitFor(() => {
      expect(result.current.boards).toHaveLength(3)
    })

    expect(result.current.boards[0].id).toBe('board-1')
    expect(result.current.boards[0].name).toBe('Project Alpha')
    expect(result.current.boards[1].id).toBe('board-2')
    expect(result.current.boards[2].id).toBe('board-3')
    expect(result.current.error).toBeNull()
  })

  it('US-05e — should call fetchTrelloBoards with the correct API key and token', async () => {
    const { fetchTrelloBoards } = await import('../../src/features/Trello/api')

    renderHook(() => useTrelloBoards(), { wrapper: makeWrapper() })

    await waitFor(() => {
      expect(fetchTrelloBoards).toHaveBeenCalledWith('test-api-key', 'test-api-token')
    })
  })

  it('US-05f — should show isLoading=true while boards are fetching', async () => {
    const { fetchTrelloBoards } = await import('../../src/features/Trello/api')

    let resolveBoards: ((boards: any) => void) | undefined
    vi.mocked(fetchTrelloBoards).mockReturnValue(
      new Promise((resolve) => {
        resolveBoards = resolve
      })
    )

    const { result } = renderHook(() => useTrelloBoards(), {
      wrapper: makeWrapper()
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(true)
    })

    await act(async () => {
      resolveBoards!(MOCK_BOARDS)
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
      expect(result.current.boards).toHaveLength(3)
    })
  })

  it('US-05g — should expose error when fetchTrelloBoards fails', async () => {
    const { fetchTrelloBoards } = await import('../../src/features/Trello/api')
    vi.mocked(fetchTrelloBoards).mockRejectedValue(new Error('Unauthorized: invalid token'))

    const { result } = renderHook(() => useTrelloBoards(), {
      wrapper: makeWrapper()
    })

    // useTrelloBoards has retry: 2 — wait long enough for all retries to complete
    await waitFor(
      () => {
        expect(result.current.error).not.toBeNull()
      },
      { timeout: 5000 }
    )

    expect(result.current.error?.message).toBe('Unauthorized: invalid token')
    expect(result.current.boards).toEqual([])
  })

  it('US-05h — should expose a working refetch function', () => {
    const { result } = renderHook(() => useTrelloBoards(), {
      wrapper: makeWrapper()
    })

    expect(typeof result.current.refetch).toBe('function')
  })

  it('US-05i — should return empty boards array (not null/undefined) when no results', async () => {
    const { fetchTrelloBoards } = await import('../../src/features/Trello/api')
    vi.mocked(fetchTrelloBoards).mockResolvedValue([])

    const { result } = renderHook(() => useTrelloBoards(), {
      wrapper: makeWrapper()
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.boards).toEqual([])
    expect(Array.isArray(result.current.boards)).toBe(true)
  })

  it('US-05j — should handle API keys loading state correctly', async () => {
    const { useApiKeys } = await import('@shared/hooks')

    vi.mocked(useApiKeys).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null
    } as any)

    const { result } = renderHook(() => useTrelloBoards(), {
      wrapper: makeWrapper()
    })

    // While API keys are loading, boards should be empty (query disabled)
    expect(result.current.boards).toEqual([])
  })
})
