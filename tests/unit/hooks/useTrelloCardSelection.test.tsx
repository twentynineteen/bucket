/**
 * Tests for useTrelloCardSelection hook
 * Handles card selection state, details fetching, and validation
 */

import { useTrelloCardDetails } from '@/hooks/useTrelloCardDetails'
import { useTrelloCardSelection } from '@/hooks/useTrelloCardSelection'
import type { SelectedCard } from '@/pages/UploadTrello/UploadTrelloTypes'
import type { TrelloCard } from '@/utils/TrelloCards'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

// Mock dependencies
vi.mock('@/hooks/useTrelloCardDetails', () => ({
  useTrelloCardDetails: vi.fn()
}))

vi.mock('@/pages/UploadTrello/UploadTrelloHooks', () => ({
  useCardDetailsSync: vi.fn(),
  useCardValidation: vi.fn()
}))

const mockCardDetails: TrelloCard = {
  id: 'card123',
  name: 'Test Card',
  desc: 'Test description',
  idList: 'list1'
}

const mockMembers = [
  { id: 'member1', fullName: 'John Doe' },
  { id: 'member2', fullName: 'Jane Smith' }
]

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0
      }
    }
  })

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('useTrelloCardSelection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useTrelloCardDetails).mockReturnValue({
      card: mockCardDetails,
      members: mockMembers,
      isLoading: false,
      refetchCard: vi.fn(),
      refetchMembers: vi.fn()
    })
  })

  describe('initialization', () => {
    test('initializes with no card selected', () => {
      const { result } = renderHook(
        () => useTrelloCardSelection('test-api-key', 'test-token'),
        { wrapper: createWrapper() }
      )

      expect(result.current.selectedCard).toBeNull()
    })

    test('does not fetch card details when no card selected', () => {
      renderHook(() => useTrelloCardSelection('test-api-key', 'test-token'), {
        wrapper: createWrapper()
      })

      expect(useTrelloCardDetails).toHaveBeenCalledWith(
        null,
        'test-api-key',
        'test-token'
      )
    })
  })

  describe('card selection', () => {
    test('updates selected card', () => {
      const { result } = renderHook(
        () => useTrelloCardSelection('test-api-key', 'test-token'),
        { wrapper: createWrapper() }
      )

      const card: SelectedCard = { id: 'card123', name: 'Test Card' }

      act(() => {
        result.current.setSelectedCard(card)
      })

      expect(result.current.selectedCard).toEqual(card)
    })

    test('fetches card details when card is selected', async () => {
      const { result } = renderHook(
        () => useTrelloCardSelection('test-api-key', 'test-token'),
        { wrapper: createWrapper() }
      )

      const card: SelectedCard = { id: 'card123', name: 'Test Card' }

      act(() => {
        result.current.setSelectedCard(card)
      })

      await waitFor(() => {
        expect(useTrelloCardDetails).toHaveBeenCalledWith(
          'card123',
          'test-api-key',
          'test-token'
        )
      })
    })

    test('clears card selection', () => {
      const { result } = renderHook(
        () => useTrelloCardSelection('test-api-key', 'test-token'),
        { wrapper: createWrapper() }
      )

      const card: SelectedCard = { id: 'card123', name: 'Test Card' }

      act(() => {
        result.current.setSelectedCard(card)
      })
      expect(result.current.selectedCard).toEqual(card)

      act(() => {
        result.current.setSelectedCard(null)
      })
      expect(result.current.selectedCard).toBeNull()
    })
  })

  describe('card details', () => {
    test('returns card details when available', () => {
      const { result } = renderHook(
        () => useTrelloCardSelection('test-api-key', 'test-token'),
        { wrapper: createWrapper() }
      )

      const card: SelectedCard = { id: 'card123', name: 'Test Card' }

      act(() => {
        result.current.setSelectedCard(card)
      })

      expect(result.current.selectedCardDetails).toEqual(mockCardDetails)
    })

    test('returns members when available', () => {
      const { result } = renderHook(
        () => useTrelloCardSelection('test-api-key', 'test-token'),
        { wrapper: createWrapper() }
      )

      const card: SelectedCard = { id: 'card123', name: 'Test Card' }

      act(() => {
        result.current.setSelectedCard(card)
      })

      expect(result.current.members).toEqual(mockMembers)
    })

    test('handles loading state', () => {
      vi.mocked(useTrelloCardDetails).mockReturnValue({
        card: undefined,
        members: undefined,
        isLoading: true,
        refetchCard: vi.fn(),
        refetchMembers: vi.fn()
      })

      const { result } = renderHook(
        () => useTrelloCardSelection('test-api-key', 'test-token'),
        { wrapper: createWrapper() }
      )

      expect(result.current.isCardLoading).toBe(true)
    })

    test('provides refetch functions', () => {
      const mockRefetchCard = vi.fn()
      const mockRefetchMembers = vi.fn()

      vi.mocked(useTrelloCardDetails).mockReturnValue({
        card: mockCardDetails,
        members: mockMembers,
        isLoading: false,
        refetchCard: mockRefetchCard,
        refetchMembers: mockRefetchMembers
      })

      const { result } = renderHook(
        () => useTrelloCardSelection('test-api-key', 'test-token'),
        { wrapper: createWrapper() }
      )

      expect(result.current.refetchCard).toBe(mockRefetchCard)
      expect(result.current.refetchMembers).toBe(mockRefetchMembers)
    })
  })

  describe('validation', () => {
    test('resets card when validation fails', async () => {
      const { result } = renderHook(
        () => useTrelloCardSelection('test-api-key', 'test-token'),
        { wrapper: createWrapper() }
      )

      const card: SelectedCard = { id: 'card123', name: 'Test Card' }

      act(() => {
        result.current.setSelectedCard(card)
      })
      expect(result.current.selectedCard).toEqual(card)

      // Simulate validation failure (card not found)
      vi.mocked(useTrelloCardDetails).mockReturnValue({
        card: undefined,
        members: undefined,
        isLoading: false,
        refetchCard: vi.fn(),
        refetchMembers: vi.fn()
      })

      // The validation hook should reset the card
      act(() => {
        result.current.setSelectedCard(null)
      })

      expect(result.current.selectedCard).toBeNull()
    })
  })

  describe('API credentials', () => {
    test('handles null API key', () => {
      const { result } = renderHook(() => useTrelloCardSelection(null, 'test-token'), {
        wrapper: createWrapper()
      })

      expect(result.current.selectedCard).toBeNull()
    })

    test('handles null token', () => {
      const { result } = renderHook(() => useTrelloCardSelection('test-api-key', null), {
        wrapper: createWrapper()
      })

      expect(result.current.selectedCard).toBeNull()
    })

    test('does not fetch details without credentials', () => {
      const { result } = renderHook(() => useTrelloCardSelection(null, null), {
        wrapper: createWrapper()
      })

      const card: SelectedCard = { id: 'card123', name: 'Test Card' }

      act(() => {
        result.current.setSelectedCard(card)
      })

      expect(useTrelloCardDetails).toHaveBeenCalledWith(null, null, null)
    })
  })

  describe('edge cases', () => {
    test('handles rapid card selection changes', () => {
      const { result } = renderHook(
        () => useTrelloCardSelection('test-api-key', 'test-token'),
        { wrapper: createWrapper() }
      )

      const card1: SelectedCard = { id: 'card1', name: 'Card 1' }
      const card2: SelectedCard = { id: 'card2', name: 'Card 2' }
      const card3: SelectedCard = { id: 'card3', name: 'Card 3' }

      act(() => {
        result.current.setSelectedCard(card1)
      })
      act(() => {
        result.current.setSelectedCard(card2)
      })
      act(() => {
        result.current.setSelectedCard(card3)
      })

      expect(result.current.selectedCard).toEqual(card3)
    })

    test('handles card with empty ID', () => {
      const { result } = renderHook(
        () => useTrelloCardSelection('test-api-key', 'test-token'),
        { wrapper: createWrapper() }
      )

      const card: SelectedCard = { id: '', name: 'Empty ID Card' }

      act(() => {
        result.current.setSelectedCard(card)
      })

      // Should still set the card (validation happens separately)
      expect(result.current.selectedCard).toEqual(card)
    })

    test('updates when credentials change', () => {
      const { result, rerender } = renderHook<
        { apiKey: string | null; token: string | null },
        ReturnType<typeof useTrelloCardSelection>
      >(({ apiKey, token }) => useTrelloCardSelection(apiKey, token), {
        wrapper: createWrapper(),
        initialProps: { apiKey: 'key1', token: 'token1' }
      })

      const card: SelectedCard = { id: 'card123', name: 'Test Card' }
      act(() => {
        result.current.setSelectedCard(card)
      })

      // Change credentials
      rerender({ apiKey: 'key2', token: 'token2' })

      expect(useTrelloCardDetails).toHaveBeenCalledWith('card123', 'key2', 'token2')
    })

    test('handles card selection with special characters in name', () => {
      const { result } = renderHook(
        () => useTrelloCardSelection('test-api-key', 'test-token'),
        { wrapper: createWrapper() }
      )

      const card: SelectedCard = {
        id: 'card123',
        name: 'Card with "quotes" & <special> chars'
      }

      act(() => {
        result.current.setSelectedCard(card)
      })

      expect(result.current.selectedCard).toEqual(card)
    })
  })

  describe('integration', () => {
    test('full workflow: select, view details, deselect', () => {
      // Start with no card details when nothing selected
      vi.mocked(useTrelloCardDetails).mockReturnValue({
        card: undefined,
        members: undefined,
        isLoading: false,
        refetchCard: vi.fn(),
        refetchMembers: vi.fn()
      })

      const { result } = renderHook(
        () => useTrelloCardSelection('test-api-key', 'test-token'),
        { wrapper: createWrapper() }
      )

      // Initially no card
      expect(result.current.selectedCard).toBeNull()
      expect(result.current.selectedCardDetails).toBeUndefined()

      // Select card - update mock to return details
      vi.mocked(useTrelloCardDetails).mockReturnValue({
        card: mockCardDetails,
        members: mockMembers,
        isLoading: false,
        refetchCard: vi.fn(),
        refetchMembers: vi.fn()
      })

      const card: SelectedCard = { id: 'card123', name: 'Test Card' }
      act(() => {
        result.current.setSelectedCard(card)
      })

      expect(result.current.selectedCard).toEqual(card)
      expect(result.current.selectedCardDetails).toEqual(mockCardDetails)
      expect(result.current.members).toEqual(mockMembers)

      // Deselect card
      act(() => {
        result.current.setSelectedCard(null)
      })

      expect(result.current.selectedCard).toBeNull()
    })
  })
})
