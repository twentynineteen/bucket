/**
 * Tests for useTrelloCardsManager auto-sync behaviour.
 *
 * Covers the BuildProject "Project Created Successfully" auto-sync path
 * (autoSyncToTrello=true) and the two regressions:
 *  1. Only the most-recently-added card was synced (others were left stale).
 *  2. The breadcrumbs file was read before the new card finished persisting.
 */

import { useTrelloCardsManager } from '@features/Trello/hooks/useTrelloCardsManager'
import {
  generateBreadcrumbsBlock,
  updateTrelloCardWithBreadcrumbs
} from '@features/Baker'
import { fetchTrelloCardById, readBreadcrumbsFile } from '@features/Trello/api'
import { useBreadcrumbsTrelloCards } from '@features/Trello/hooks/useBreadcrumbsTrelloCards'
import { useTrelloBoard } from '@features/Trello/hooks/useTrelloBoard'
import { useFuzzySearch } from '@shared/hooks'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('@features/Trello/api', () => ({
  readBreadcrumbsFile: vi.fn(),
  fetchTrelloCardById: vi.fn()
}))
vi.mock('@features/Trello/hooks/useBreadcrumbsTrelloCards', () => ({
  useBreadcrumbsTrelloCards: vi.fn()
}))
vi.mock('@features/Trello/hooks/useTrelloBoard', () => ({
  useTrelloBoard: vi.fn()
}))
vi.mock('@shared/hooks', () => ({
  useFuzzySearch: vi.fn()
}))
vi.mock('@features/Baker', () => ({
  generateBreadcrumbsBlock: vi.fn(() => '## Breadcrumbs Block'),
  updateTrelloCardWithBreadcrumbs: vi.fn().mockResolvedValue(undefined)
}))
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() }
}))

const mockUseBreadcrumbsTrelloCards = vi.mocked(useBreadcrumbsTrelloCards)
const mockUseTrelloBoard = vi.mocked(useTrelloBoard)
const mockUseFuzzySearch = vi.mocked(useFuzzySearch)
const mockReadBreadcrumbs = vi.mocked(readBreadcrumbsFile)
const mockFetchCard = vi.mocked(fetchTrelloCardById)
const mockUpdateCard = vi.mocked(updateTrelloCardWithBreadcrumbs)
const mockGenerateBlock = vi.mocked(generateBreadcrumbsBlock)

const API_KEY = 'key'
const API_TOKEN = 'token'
const PROJECT = '/path/to/project'

// breadcrumbs file already containing 3 linked cards + a video link
const THREE_CARD_FILE = JSON.stringify({
  projectTitle: 'Demo',
  videoLinks: [{ title: 'Vid', url: 'https://v/1' }],
  trelloCards: [
    { cardId: 'aaa', url: 'https://trello.com/c/aaa' },
    { cardId: 'bbb', url: 'https://trello.com/c/bbb' },
    { cardId: 'ccc', url: 'https://trello.com/c/ccc' }
  ]
})

let addTrelloCard: ReturnType<typeof vi.fn>
let addTrelloCardAsync: ReturnType<typeof vi.fn>
let fetchCardDetailsAsync: ReturnType<typeof vi.fn>

function setup(autoSyncToTrello = true) {
  return renderHook(() =>
    useTrelloCardsManager({
      projectPath: PROJECT,
      trelloApiKey: API_KEY,
      trelloApiToken: API_TOKEN,
      autoSyncToTrello
    })
  )
}

beforeEach(() => {
  vi.clearAllMocks()

  addTrelloCard = vi.fn()
  addTrelloCardAsync = vi.fn().mockResolvedValue(undefined)
  fetchCardDetailsAsync = vi.fn().mockResolvedValue({
    cardId: 'ccc',
    url: 'https://trello.com/c/ccc',
    title: 'Card CCC'
  })

  mockUseBreadcrumbsTrelloCards.mockReturnValue({
    trelloCards: [],
    isLoading: false,
    error: null,
    addTrelloCard,
    addTrelloCardAsync,
    removeTrelloCard: vi.fn(),
    removeTrelloCardAsync: vi.fn(),
    fetchCardDetails: vi.fn(),
    fetchCardDetailsAsync,
    isUpdating: false,
    isFetchingDetails: false,
    addError: null,
    removeError: null,
    fetchError: null,
    fetchedCardData: undefined
  } as unknown as ReturnType<typeof useBreadcrumbsTrelloCards>)

  mockUseTrelloBoard.mockReturnValue({
    grouped: {},
    isLoading: false
  } as unknown as ReturnType<typeof useTrelloBoard>)

  mockUseFuzzySearch.mockReturnValue({
    searchTerm: '',
    setSearchTerm: vi.fn(),
    results: []
  } as unknown as ReturnType<typeof useFuzzySearch>)

  mockGenerateBlock.mockReturnValue('## Breadcrumbs Block')
  mockUpdateCard.mockResolvedValue(undefined)
  mockReadBreadcrumbs.mockResolvedValue(THREE_CARD_FILE)
  mockFetchCard.mockResolvedValue({
    cardId: 'x',
    url: 'u',
    title: 'live',
    desc: 'existing desc',
    idList: 'list1'
  } as unknown as Awaited<ReturnType<typeof fetchTrelloCardById>>)
})

describe('useTrelloCardsManager auto-sync', () => {
  test('REGRESSION: syncs EVERY linked card (not just the one added)', async () => {
    const { result } = setup(true)

    await act(async () => {
      await result.current.handleSelectCard({ id: 'ccc', name: 'Card CCC' })
    })

    // Persisted via the awaited async mutation (race fix), not fire-and-forget
    expect(addTrelloCardAsync).toHaveBeenCalledTimes(1)
    expect(addTrelloCard).not.toHaveBeenCalled()

    // Read the fresh file AFTER persisting
    expect(mockReadBreadcrumbs).toHaveBeenCalledWith(`${PROJECT}/breadcrumbs.json`)

    // Every linked card in the file gets updated, not just 'ccc'
    expect(mockUpdateCard).toHaveBeenCalledTimes(3)
    const syncedIds = mockUpdateCard.mock.calls.map((call) => call[0].id)
    expect(syncedIds).toEqual(['aaa', 'bbb', 'ccc'])

    // Each card's live description is fetched + preserved, breadcrumbs replaced
    expect(mockFetchCard).toHaveBeenCalledTimes(3)
    expect(mockUpdateCard.mock.calls[0][0].desc).toBe('existing desc')
    expect(mockUpdateCard.mock.calls[0][4]).toMatchObject({
      autoReplace: true,
      silentErrors: false
    })
  })

  test('persists then syncs (awaits add before reading breadcrumbs)', async () => {
    const order: string[] = []
    addTrelloCardAsync.mockImplementation(async () => {
      order.push('add')
    })
    mockReadBreadcrumbs.mockImplementation(async () => {
      order.push('read')
      return THREE_CARD_FILE
    })

    const { result } = setup(true)
    await act(async () => {
      await result.current.handleSelectCard({ id: 'ccc', name: 'Card CCC' })
    })

    expect(order).toEqual(['add', 'read'])
  })

  test('does NOT sync to Trello when autoSyncToTrello is false', async () => {
    const { result } = setup(false)

    await act(async () => {
      await result.current.handleSelectCard({ id: 'ccc', name: 'Card CCC' })
    })

    expect(addTrelloCardAsync).toHaveBeenCalledTimes(1)
    expect(mockReadBreadcrumbs).not.toHaveBeenCalled()
    expect(mockUpdateCard).not.toHaveBeenCalled()
  })

  test('continues syncing remaining cards when one card fails, and reports it', async () => {
    mockUpdateCard
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Trello 500'))
      .mockResolvedValueOnce(undefined)

    const { toast } = await import('sonner')
    const { result } = setup(true)

    await act(async () => {
      await result.current.handleSelectCard({ id: 'ccc', name: 'Card CCC' })
    })

    // All three were attempted despite the middle failure
    expect(mockUpdateCard).toHaveBeenCalledTimes(3)
    await waitFor(() =>
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        expect.stringContaining('1 of 3')
      )
    )
  })
})
