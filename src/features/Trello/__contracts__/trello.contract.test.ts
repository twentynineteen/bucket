/**
 * Trello Contract Tests
 *
 * Verifies the shape and behavior of the Trello feature module barrel exports.
 * These tests lock down the public API so downstream consumers
 * can rely on stable exports.
 */

import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

// Mock the api layer (single mock point for all Trello I/O)
vi.mock('../api', () => ({
  fetchTrelloBoards: vi.fn().mockResolvedValue([]),
  fetchCardWithMembers: vi.fn().mockResolvedValue({}),
  fetchBoardCards: vi.fn().mockResolvedValue([]),
  fetchBoardLists: vi.fn().mockResolvedValue([]),
  fetchCardMembers: vi.fn().mockResolvedValue([]),
  updateTrelloCard: vi.fn().mockResolvedValue(undefined),
  fetchTrelloCardById: vi.fn().mockResolvedValue({}),
  addCardComment: vi.fn().mockResolvedValue(undefined),
  readBreadcrumbsFile: vi.fn().mockResolvedValue('{}'),
  writeBreadcrumbsFile: vi.fn().mockResolvedValue(undefined),
  bakerGetTrelloCards: vi.fn().mockResolvedValue([]),
  bakerAssociateTrelloCard: vi.fn().mockResolvedValue({}),
  bakerRemoveTrelloCard: vi.fn().mockResolvedValue({}),
  bakerFetchTrelloCardDetails: vi.fn().mockResolvedValue({}),
  bakerReadBreadcrumbs: vi.fn().mockResolvedValue({}),
  askDialog: vi.fn().mockResolvedValue(true),
  confirmDialog: vi.fn().mockResolvedValue(true),
  openFileDialog: vi.fn().mockResolvedValue(null)
}))

// Mock shared dependencies
vi.mock('@shared/constants/timing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shared/constants/timing')>()
  return { ...actual }
})

vi.mock('@shared/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    log: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  },
  createNamespacedLogger: vi.fn(() => ({
    error: vi.fn(),
    warn: vi.fn(),
    log: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }))
}))

vi.mock('@shared/lib/query-keys', () => ({
  queryKeys: {
    trello: {
      boards: () => ['trello', 'boards'],
      board: (id: string) => ['trello', 'board', id],
      cards: (id: string) => ['trello', 'cards', id],
      lists: (id: string) => ['trello', 'lists', id]
    },
    settings: {
      apiKeys: () => ['settings', 'apiKeys']
    }
  }
}))

vi.mock('@shared/hooks', () => ({
  useApiKeys: () => ({
    data: { trello: 'test-key', trelloToken: 'test-token' }
  }),
  useSproutVideoApiKey: () => ({ apiKey: 'test-key' }),
  useTrelloApiKeys: () => ({
    apiKey: 'test-key',
    apiToken: 'test-token'
  })
}))

vi.mock('@shared/store', () => ({
  useAppStore: vi.fn().mockImplementation((selector) => {
    const state = {
      trelloBoardId: '',
      setTrelloBoardId: vi.fn()
    }
    return typeof selector === 'function' ? selector(state) : state
  })
}))

vi.mock('@shared/utils/storage', () => ({
  loadApiKeys: vi.fn().mockResolvedValue({}),
  saveApiKeys: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@shared/utils/validation', () => ({
  validateVideoLink: vi.fn().mockReturnValue([])
}))

// Mock React Query
const mockRefetch = vi.fn()
const mockMutate = vi.fn()
const mockMutateAsync = vi.fn().mockResolvedValue(undefined)
const mockInvalidateQueries = vi.fn()
const mockSetQueryData = vi.fn()

const mockUseQuery = vi.fn(() => ({
  data: [],
  isLoading: false,
  error: null,
  refetch: mockRefetch
}))

const mockUseMutation = vi.fn(() => ({
  mutate: mockMutate,
  mutateAsync: mockMutateAsync,
  isPending: false,
  error: null,
  data: null
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
    setQueryData: mockSetQueryData
  })
}))

// Mock hooks that cross module boundaries
vi.mock('@features/Baker', () => ({
  generateBreadcrumbsBlock: vi.fn().mockReturnValue(''),
  updateTrelloCardWithBreadcrumbs: vi.fn().mockResolvedValue(undefined),
  useBreadcrumbsVideoLinks: () => ({
    videoLinks: [],
    isLoading: false,
    error: null,
    addVideoLink: vi.fn(),
    removeVideoLink: vi.fn(),
    reorderVideoLinks: vi.fn(),
    isUpdating: false,
    addError: null
  }),
  useAppendBreadcrumbs: vi.fn().mockReturnValue({
    getBreadcrumbsBlock: vi.fn().mockResolvedValue(null),
    applyBreadcrumbsToCard: vi.fn().mockResolvedValue(undefined)
  })
}))

// useBreadcrumbsVideoLinks mock is included in @features/Baker mock above

vi.mock('@features/Upload', () => ({
  useFileUpload: () => ({
    selectedFile: null,
    uploading: false,
    response: null,
    selectFile: vi.fn(),
    uploadFile: vi.fn(),
    resetUploadState: vi.fn()
  }),
  useSproutVideoApi: () => ({
    fetchVideoDetailsAsync: vi.fn(),
    isFetching: false
  }),
  useSproutVideoProcessor: () => ({
    reset: vi.fn()
  }),
  useUploadEvents: () => ({
    progress: 0,
    message: ''
  })
}))

import * as trelloBarrel from '../index'

// --- Shape Tests ---

describe('Trello Barrel Exports - Shape', () => {
  const expectedExports = [
    // Components
    'TrelloIntegrationButton',
    'TrelloIntegrationModal',
    'TrelloCardsManager',
    'TrelloCardItem',
    'TrelloCardUpdateDialog',
    'TrelloBoardSelector',
    'TrelloBoardError',
    'CardDetailsDialog',
    'AddCardDialog',
    'UploadTrello',
    // Hooks
    'useTrelloBoards',
    'useTrelloBoard',
    'useTrelloBoardId',
    'useTrelloBoardSearch',
    'useTrelloCardDetails',
    'useTrelloCardSelection',
    'useTrelloCardsManager',
    'useTrelloActions',
    'useTrelloBreadcrumbs',
    'useUploadTrello',
    'useTrelloVideoInfo',
    'useParsedTrelloDescription',
    'useBakerTrelloIntegration',
    'useVideoLinksManager',
    'useBreadcrumbsTrelloCards',
    // Factory functions
    'createDefaultSproutUploadResponse'
  ].sort()

  it('exports exactly the expected named exports (no more, no fewer)', () => {
    const exportNames = Object.keys(trelloBarrel).sort()
    expect(exportNames).toEqual(expectedExports)
  })

  it('exports exactly 26 members', () => {
    expect(Object.keys(trelloBarrel)).toHaveLength(26)
  })

  // Component shape checks
  const componentNames = [
    'TrelloIntegrationButton',
    'TrelloIntegrationModal',
    'TrelloCardsManager',
    'TrelloCardItem',
    'TrelloCardUpdateDialog',
    'TrelloBoardSelector',
    'TrelloBoardError',
    'CardDetailsDialog',
    'AddCardDialog',
    'UploadTrello'
  ] as const

  for (const name of componentNames) {
    it(`exports ${name} as a function`, () => {
      expect(typeof trelloBarrel[name]).toBe('function')
    })
  }

  // Hook shape checks
  const hookNames = [
    'useTrelloBoards',
    'useTrelloBoard',
    'useTrelloBoardId',
    'useTrelloBoardSearch',
    'useTrelloCardDetails',
    'useTrelloCardSelection',
    'useTrelloCardsManager',
    'useTrelloActions',
    'useTrelloBreadcrumbs',
    'useUploadTrello',
    'useTrelloVideoInfo',
    'useParsedTrelloDescription',
    'useBakerTrelloIntegration',
    'useVideoLinksManager',
    'useBreadcrumbsTrelloCards'
  ] as const

  for (const name of hookNames) {
    it(`exports ${name} as a function`, () => {
      expect(typeof trelloBarrel[name]).toBe('function')
    })
  }

  it('exports createDefaultSproutUploadResponse as a function', () => {
    expect(typeof trelloBarrel.createDefaultSproutUploadResponse).toBe('function')
  })

  it('does NOT export internal modules (TrelloCards, trelloBoardValidation)', () => {
    const exportNames = Object.keys(trelloBarrel)
    expect(exportNames).not.toContain('groupCardsByList')
    expect(exportNames).not.toContain('validateBoardAccess')
    expect(exportNames).not.toContain('TrelloCardList')
    expect(exportNames).not.toContain('TrelloCardMembers')
  })
})

// --- Behavioral Tests ---

describe('useTrelloBoards - Behavior', () => {
  it('returns boards array, loading state, error, and refetch', () => {
    const { result } = renderHook(() => trelloBarrel.useTrelloBoards())

    expect(result.current).toHaveProperty('boards')
    expect(result.current).toHaveProperty('isLoading')
    expect(result.current).toHaveProperty('error')
    expect(result.current).toHaveProperty('refetch')
    expect(Array.isArray(result.current.boards)).toBe(true)
  })

  it('calls useQuery with trello boards query key', () => {
    mockUseQuery.mockClear()
    renderHook(() => trelloBarrel.useTrelloBoards())

    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['trello', 'boards'],
        retry: 2,
        refetchOnWindowFocus: false
      })
    )
  })
})

describe('useTrelloBoardId - Behavior', () => {
  it('returns boardId, setBoardId, isLoading, and validateStoredBoardId', () => {
    const { result } = renderHook(() => trelloBarrel.useTrelloBoardId())

    expect(result.current).toHaveProperty('boardId')
    expect(result.current).toHaveProperty('setBoardId')
    expect(result.current).toHaveProperty('isLoading')
    expect(result.current).toHaveProperty('validateStoredBoardId')
    expect(typeof result.current.setBoardId).toBe('function')
    expect(typeof result.current.validateStoredBoardId).toBe('function')
  })

  it('falls back to default board ID when no stored value', () => {
    const { result } = renderHook(() => trelloBarrel.useTrelloBoardId())

    // Should return the default board ID when store and API keys are empty
    expect(result.current.boardId).toBe('55a504d70bed2bd21008dc5a')
  })
})

describe('useVideoLinksManager - Behavior', () => {
  it('returns expected interface shape', () => {
    const { result } = renderHook(() =>
      trelloBarrel.useVideoLinksManager({ projectPath: '/test/path' })
    )

    // Data
    expect(result.current).toHaveProperty('videoLinks')
    expect(result.current).toHaveProperty('isLoading')
    expect(result.current).toHaveProperty('error')

    // Form state
    expect(result.current).toHaveProperty('formData')
    expect(result.current).toHaveProperty('updateFormField')
    expect(result.current).toHaveProperty('validationErrors')

    // Handlers
    expect(result.current).toHaveProperty('handleAddVideo')
    expect(result.current).toHaveProperty('handleRemove')
    expect(result.current).toHaveProperty('handleMoveUp')
    expect(result.current).toHaveProperty('handleMoveDown')
    expect(result.current).toHaveProperty('handleUploadAndAdd')
    expect(result.current).toHaveProperty('handleTrelloCardUpdate')

    // Computed
    expect(result.current).toHaveProperty('hasApiKey')
    expect(result.current).toHaveProperty('canAddVideo')
  })
})

describe('createDefaultSproutUploadResponse - Behavior', () => {
  it('returns object with expected default fields', () => {
    const result = trelloBarrel.createDefaultSproutUploadResponse()

    expect(result).toHaveProperty('id')
    expect(result).toHaveProperty('title')
    expect(result).toHaveProperty('state')
  })
})
