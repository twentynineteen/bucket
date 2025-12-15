/**
 * Tests for useTrelloActions hook
 * Handles external actions: opening card in Trello, closing dialog
 */

import { useTrelloActions } from '@/hooks/useTrelloActions'
import { SelectedCard } from '@/pages/UploadTrello/UploadTrelloTypes'
import { open } from '@tauri-apps/plugin-shell'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

// Mock Tauri shell plugin
vi.mock('@tauri-apps/plugin-shell', () => ({
  open: vi.fn()
}))

describe('useTrelloActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('handleOpenInTrello', () => {
    test('opens Trello card in browser with correct URL', async () => {
      const selectedCard: SelectedCard = {
        id: 'abc123',
        name: 'Test Card'
      }

      const { result } = renderHook(() => useTrelloActions(selectedCard))

      await act(async () => {
        await result.current.handleOpenInTrello()
      })

      expect(open).toHaveBeenCalledWith('https://trello.com/c/abc123')
    })

    test('does nothing when no card is selected', async () => {
      const { result } = renderHook(() => useTrelloActions(null))

      await act(async () => {
        await result.current.handleOpenInTrello()
      })

      expect(open).not.toHaveBeenCalled()
    })

    test('handles open() errors gracefully', async () => {
      const selectedCard: SelectedCard = {
        id: 'abc123',
        name: 'Test Card'
      }

      vi.mocked(open).mockRejectedValueOnce(new Error('Failed to open'))

      const { result } = renderHook(() => useTrelloActions(selectedCard))

      await expect(
        act(async () => {
          await result.current.handleOpenInTrello()
        })
      ).rejects.toThrow('Failed to open')
    })

    test('generates correct URL for different card IDs', async () => {
      const testCases = [
        { id: 'short', expected: 'https://trello.com/c/short' },
        {
          id: 'veryLongCardId123456',
          expected: 'https://trello.com/c/veryLongCardId123456'
        },
        { id: '12345', expected: 'https://trello.com/c/12345' }
      ]

      for (const { id, expected } of testCases) {
        vi.clearAllMocks()
        const selectedCard: SelectedCard = { id, name: 'Test' }
        const { result } = renderHook(() => useTrelloActions(selectedCard))

        await act(async () => {
          await result.current.handleOpenInTrello()
        })

        expect(open).toHaveBeenCalledWith(expected)
      }
    })
  })

  describe('handleCloseDialog', () => {
    test('calls onClose callback when provided', () => {
      const onClose = vi.fn()
      const { result } = renderHook(() => useTrelloActions(null, onClose))

      act(() => {
        result.current.handleCloseDialog()
      })

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    test('does nothing when onClose is not provided', () => {
      const { result } = renderHook(() => useTrelloActions(null))

      // Should not throw
      expect(() => {
        act(() => {
          result.current.handleCloseDialog()
        })
      }).not.toThrow()
    })

    test('calls onClose with no arguments', () => {
      const onClose = vi.fn()
      const { result } = renderHook(() => useTrelloActions(null, onClose))

      act(() => {
        result.current.handleCloseDialog()
      })

      expect(onClose).toHaveBeenCalledWith()
    })
  })

  describe('integration', () => {
    test('can open card and close dialog in sequence', async () => {
      const selectedCard: SelectedCard = {
        id: 'abc123',
        name: 'Test Card'
      }
      const onClose = vi.fn()

      const { result } = renderHook(() => useTrelloActions(selectedCard, onClose))

      // Open card in Trello
      await act(async () => {
        await result.current.handleOpenInTrello()
      })

      expect(open).toHaveBeenCalledWith('https://trello.com/c/abc123')

      // Close dialog
      act(() => {
        result.current.handleCloseDialog()
      })

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    test('updates when selected card changes', async () => {
      const card1: SelectedCard = { id: 'card1', name: 'Card 1' }
      const card2: SelectedCard = { id: 'card2', name: 'Card 2' }

      const { result, rerender } = renderHook(({ card }) => useTrelloActions(card), {
        initialProps: { card: card1 }
      })

      await act(async () => {
        await result.current.handleOpenInTrello()
      })
      expect(open).toHaveBeenCalledWith('https://trello.com/c/card1')

      // Change card
      rerender({ card: card2 })
      vi.clearAllMocks()

      await act(async () => {
        await result.current.handleOpenInTrello()
      })
      expect(open).toHaveBeenCalledWith('https://trello.com/c/card2')
    })
  })

  describe('edge cases', () => {
    test('handles card with special characters in ID', async () => {
      const selectedCard: SelectedCard = {
        id: 'abc-123_XYZ',
        name: 'Test Card'
      }

      const { result } = renderHook(() => useTrelloActions(selectedCard))

      await act(async () => {
        await result.current.handleOpenInTrello()
      })

      expect(open).toHaveBeenCalledWith('https://trello.com/c/abc-123_XYZ')
    })

    test('handles empty card ID', async () => {
      const selectedCard: SelectedCard = {
        id: '',
        name: 'Test Card'
      }

      const { result } = renderHook(() => useTrelloActions(selectedCard))

      await act(async () => {
        await result.current.handleOpenInTrello()
      })

      // Should still call open with empty ID (URL will be invalid but that's expected)
      expect(open).toHaveBeenCalledWith('https://trello.com/c/')
    })

    test('onClose callback can be changed dynamically', () => {
      const onClose1 = vi.fn()
      const onClose2 = vi.fn()

      const { result, rerender } = renderHook(
        ({ callback }) => useTrelloActions(null, callback),
        { initialProps: { callback: onClose1 } }
      )

      act(() => {
        result.current.handleCloseDialog()
      })
      expect(onClose1).toHaveBeenCalledTimes(1)
      expect(onClose2).not.toHaveBeenCalled()

      // Change callback
      rerender({ callback: onClose2 })

      act(() => {
        result.current.handleCloseDialog()
      })
      expect(onClose1).toHaveBeenCalledTimes(1) // Still only called once
      expect(onClose2).toHaveBeenCalledTimes(1)
    })
  })
})
