/**
 * Tests for useTrelloBreadcrumbs hook
 * Handles breadcrumbs operations including file I/O
 */

import { useAppendBreadcrumbs } from '@/hooks/useAppendBreadcrumbs'
import { useParsedTrelloDescription } from '@/hooks/useParsedTrelloDescription'
import { useTrelloBreadcrumbs } from '@/hooks/useTrelloBreadcrumbs'
import { appStore } from '@/store/useAppStore'
import type { TrelloCard } from '@/utils/TrelloCards'
import { writeTextFile } from '@tauri-apps/plugin-fs'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

// Mock dependencies
vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: vi.fn()
}))

vi.mock('@/hooks/useAppendBreadcrumbs', () => ({
  useAppendBreadcrumbs: vi.fn()
}))

vi.mock('@/hooks/useParsedTrelloDescription', () => ({
  useParsedTrelloDescription: vi.fn()
}))

vi.mock('@/store/useAppStore', () => ({
  appStore: {
    getState: vi.fn()
  }
}))

const mockCard: TrelloCard = {
  id: 'card123',
  name: 'Test Card',
  desc: 'Test description\n\n**Breadcrumbs:**\nProject: Test Project',
  idList: 'list1'
}

const mockBreadcrumbsData = {
  projectTitle: 'Test Project',
  parentFolder: '/path/to/projects',
  date: '2024-01-01'
}

const mockBreadcrumbsBlock = '**Breadcrumbs:**\nProject: Test Project\nDate: 2024-01-01'

describe('useTrelloBreadcrumbs', () => {
  const mockGetBreadcrumbsBlock = vi.fn()
  const mockApplyBreadcrumbsToCard = vi.fn()
  const mockRefetchCard = vi.fn()
  const mockSetBreadcrumbs = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(useAppendBreadcrumbs).mockReturnValue({
      getBreadcrumbsBlock: mockGetBreadcrumbsBlock,
      applyBreadcrumbsToCard: mockApplyBreadcrumbsToCard
    })

    vi.mocked(useParsedTrelloDescription).mockReturnValue({
      mainDescription: 'Test description',
      breadcrumbsData: mockBreadcrumbsData,
      breadcrumbsBlock: mockBreadcrumbsBlock
    })

    vi.mocked(appStore.getState).mockReturnValue({
      breadcrumbs: mockBreadcrumbsData,
      setBreadcrumbs: mockSetBreadcrumbs
    })

    mockGetBreadcrumbsBlock.mockResolvedValue(mockBreadcrumbsBlock)
  })

  describe('initialization', () => {
    test('parses breadcrumbs from card description', () => {
      const { result } = renderHook(() =>
        useTrelloBreadcrumbs('api-key', 'token', mockCard, mockRefetchCard)
      )

      expect(result.current.breadcrumbsData).toEqual(mockBreadcrumbsData)
      expect(result.current.breadcrumbsBlock).toEqual(mockBreadcrumbsBlock)
    })

    test('handles card with no description', () => {
      const cardWithoutDesc = { ...mockCard, desc: '' }

      const { result } = renderHook(() =>
        useTrelloBreadcrumbs('api-key', 'token', cardWithoutDesc, mockRefetchCard)
      )

      expect(useParsedTrelloDescription).toHaveBeenCalledWith('')
    })

    test('handles null card', () => {
      const { result } = renderHook(() =>
        useTrelloBreadcrumbs('api-key', 'token', null, mockRefetchCard)
      )

      expect(useParsedTrelloDescription).toHaveBeenCalledWith('')
    })
  })

  describe('handleAppendBreadcrumbs', () => {
    test('appends breadcrumbs to Trello card', async () => {
      const { result } = renderHook(() =>
        useTrelloBreadcrumbs('api-key', 'token', mockCard, mockRefetchCard)
      )

      await act(async () => {
        await result.current.handleAppendBreadcrumbs()
      })

      expect(mockApplyBreadcrumbsToCard).toHaveBeenCalledWith(
        mockCard,
        mockBreadcrumbsBlock
      )
    })

    test('adds Trello card URL to breadcrumbs before appending', async () => {
      const { result } = renderHook(() =>
        useTrelloBreadcrumbs('api-key', 'token', mockCard, mockRefetchCard)
      )

      await act(async () => {
        await result.current.handleAppendBreadcrumbs()
      })

      expect(mockSetBreadcrumbs).toHaveBeenCalledWith({
        ...mockBreadcrumbsData,
        trelloCardUrl: `https://trello.com/c/${mockCard.id}`
      })
    })

    test('saves breadcrumbs to file after appending', async () => {
      const { result } = renderHook(() =>
        useTrelloBreadcrumbs('api-key', 'token', mockCard, mockRefetchCard)
      )

      await act(async () => {
        await result.current.handleAppendBreadcrumbs()
      })

      const expectedPath = '/path/to/projects/Test Project/breadcrumbs.json'
      const expectedContent = JSON.stringify(
        {
          ...mockBreadcrumbsData,
          trelloCardUrl: `https://trello.com/c/${mockCard.id}`
        },
        null,
        2
      )

      expect(writeTextFile).toHaveBeenCalledWith(expectedPath, expectedContent)
    })

    test('refreshes card after appending', async () => {
      const { result } = renderHook(() =>
        useTrelloBreadcrumbs('api-key', 'token', mockCard, mockRefetchCard)
      )

      await act(async () => {
        await result.current.handleAppendBreadcrumbs()
      })

      expect(mockRefetchCard).toHaveBeenCalled()
    })

    test('does nothing when no card selected', async () => {
      const { result } = renderHook(() =>
        useTrelloBreadcrumbs('api-key', 'token', null, mockRefetchCard)
      )

      await act(async () => {
        await result.current.handleAppendBreadcrumbs()
      })

      expect(mockApplyBreadcrumbsToCard).not.toHaveBeenCalled()
      expect(writeTextFile).not.toHaveBeenCalled()
      expect(mockRefetchCard).not.toHaveBeenCalled()
    })

    test('does not save file when breadcrumbs block is null', async () => {
      mockGetBreadcrumbsBlock.mockResolvedValueOnce(null)

      const { result } = renderHook(() =>
        useTrelloBreadcrumbs('api-key', 'token', mockCard, mockRefetchCard)
      )

      await act(async () => {
        await result.current.handleAppendBreadcrumbs()
      })

      expect(mockApplyBreadcrumbsToCard).not.toHaveBeenCalled()
      expect(writeTextFile).not.toHaveBeenCalled()
      expect(mockRefetchCard).not.toHaveBeenCalled()
    })

    test('does not save file when missing parentFolder', async () => {
      vi.mocked(appStore.getState).mockReturnValue({
        breadcrumbs: { ...mockBreadcrumbsData, parentFolder: undefined },
        setBreadcrumbs: mockSetBreadcrumbs
      })

      const { result } = renderHook(() =>
        useTrelloBreadcrumbs('api-key', 'token', mockCard, mockRefetchCard)
      )

      await act(async () => {
        await result.current.handleAppendBreadcrumbs()
      })

      expect(mockApplyBreadcrumbsToCard).toHaveBeenCalled()
      expect(writeTextFile).not.toHaveBeenCalled()
      expect(mockRefetchCard).toHaveBeenCalled()
    })

    test('does not save file when missing projectTitle', async () => {
      vi.mocked(appStore.getState).mockReturnValue({
        breadcrumbs: { ...mockBreadcrumbsData, projectTitle: undefined },
        setBreadcrumbs: mockSetBreadcrumbs
      })

      const { result } = renderHook(() =>
        useTrelloBreadcrumbs('api-key', 'token', mockCard, mockRefetchCard)
      )

      await act(async () => {
        await result.current.handleAppendBreadcrumbs()
      })

      expect(mockApplyBreadcrumbsToCard).toHaveBeenCalled()
      expect(writeTextFile).not.toHaveBeenCalled()
      expect(mockRefetchCard).toHaveBeenCalled()
    })

    test('handles file write errors gracefully', async () => {
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      vi.mocked(writeTextFile).mockRejectedValueOnce(new Error('File write failed'))

      const { result } = renderHook(() =>
        useTrelloBreadcrumbs('api-key', 'token', mockCard, mockRefetchCard)
      )

      await act(async () => {
        await result.current.handleAppendBreadcrumbs()
      })

      expect(alertSpy).toHaveBeenCalledWith(
        'Failed to save breadcrumbs: File write failed'
      )
      expect(consoleErrorSpy).toHaveBeenCalled()
      expect(mockRefetchCard).toHaveBeenCalled() // Should still refresh card

      alertSpy.mockRestore()
      consoleErrorSpy.mockRestore()
    })

    test('handles non-Error exceptions in file write', async () => {
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      vi.mocked(writeTextFile).mockRejectedValueOnce('String error')

      const { result } = renderHook(() =>
        useTrelloBreadcrumbs('api-key', 'token', mockCard, mockRefetchCard)
      )

      await act(async () => {
        await result.current.handleAppendBreadcrumbs()
      })

      expect(alertSpy).toHaveBeenCalledWith('Failed to save breadcrumbs: String error')
      expect(consoleErrorSpy).toHaveBeenCalled()

      alertSpy.mockRestore()
      consoleErrorSpy.mockRestore()
    })
  })

  describe('API credentials', () => {
    test('uses provided API credentials', () => {
      renderHook(() =>
        useTrelloBreadcrumbs('custom-key', 'custom-token', mockCard, mockRefetchCard)
      )

      expect(useAppendBreadcrumbs).toHaveBeenCalledWith('custom-key', 'custom-token')
    })

    test('handles null credentials', () => {
      renderHook(() => useTrelloBreadcrumbs(null, null, mockCard, mockRefetchCard))

      expect(useAppendBreadcrumbs).toHaveBeenCalledWith(null, null)
    })
  })

  describe('breadcrumbs URL generation', () => {
    test('generates correct Trello card URL', async () => {
      const cards = [
        { ...mockCard, id: 'short' },
        { ...mockCard, id: 'veryLongCardId123456' },
        { ...mockCard, id: 'card-with-dash_underscore' }
      ]

      for (const card of cards) {
        vi.clearAllMocks()

        const { result } = renderHook(() =>
          useTrelloBreadcrumbs('api-key', 'token', card, mockRefetchCard)
        )

        await act(async () => {
          await result.current.handleAppendBreadcrumbs()
        })

        expect(mockSetBreadcrumbs).toHaveBeenCalledWith(
          expect.objectContaining({
            trelloCardUrl: `https://trello.com/c/${card.id}`
          })
        )
      }
    })
  })

  describe('file path construction', () => {
    test('constructs correct breadcrumbs file path', async () => {
      const testCases = [
        {
          breadcrumbs: {
            projectTitle: 'Simple',
            parentFolder: '/root'
          },
          expected: '/root/Simple/breadcrumbs.json'
        },
        {
          breadcrumbs: {
            projectTitle: 'Project With Spaces',
            parentFolder: '/path/to/folder'
          },
          expected: '/path/to/folder/Project With Spaces/breadcrumbs.json'
        },
        {
          breadcrumbs: {
            projectTitle: 'Special-Chars_123',
            parentFolder: '/complex/path/here'
          },
          expected: '/complex/path/here/Special-Chars_123/breadcrumbs.json'
        }
      ]

      for (const { breadcrumbs, expected } of testCases) {
        vi.clearAllMocks()
        vi.mocked(appStore.getState).mockReturnValue({
          breadcrumbs,
          setBreadcrumbs: mockSetBreadcrumbs
        })

        const { result } = renderHook(() =>
          useTrelloBreadcrumbs('api-key', 'token', mockCard, mockRefetchCard)
        )

        await act(async () => {
          await result.current.handleAppendBreadcrumbs()
        })

        expect(writeTextFile).toHaveBeenCalledWith(expected, expect.any(String))
      }
    })
  })

  describe('edge cases', () => {
    test('handles empty breadcrumbs data', async () => {
      vi.mocked(appStore.getState).mockReturnValue({
        breadcrumbs: {},
        setBreadcrumbs: mockSetBreadcrumbs
      })

      const { result } = renderHook(() =>
        useTrelloBreadcrumbs('api-key', 'token', mockCard, mockRefetchCard)
      )

      await act(async () => {
        await result.current.handleAppendBreadcrumbs()
      })

      expect(mockSetBreadcrumbs).toHaveBeenCalledWith({
        trelloCardUrl: `https://trello.com/c/${mockCard.id}`
      })
    })

    test('preserves existing breadcrumbs data when adding URL', async () => {
      const existingData = {
        projectTitle: 'Existing',
        customField: 'custom value',
        nested: { data: 'value' }
      }

      vi.mocked(appStore.getState).mockReturnValue({
        breadcrumbs: existingData,
        setBreadcrumbs: mockSetBreadcrumbs
      })

      const { result } = renderHook(() =>
        useTrelloBreadcrumbs('api-key', 'token', mockCard, mockRefetchCard)
      )

      await act(async () => {
        await result.current.handleAppendBreadcrumbs()
      })

      expect(mockSetBreadcrumbs).toHaveBeenCalledWith({
        ...existingData,
        trelloCardUrl: `https://trello.com/c/${mockCard.id}`
      })
    })

    test('handles rapid sequential append calls', async () => {
      const { result } = renderHook(() =>
        useTrelloBreadcrumbs('api-key', 'token', mockCard, mockRefetchCard)
      )

      await act(async () => {
        await Promise.all([
          result.current.handleAppendBreadcrumbs(),
          result.current.handleAppendBreadcrumbs(),
          result.current.handleAppendBreadcrumbs()
        ])
      })

      expect(mockApplyBreadcrumbsToCard).toHaveBeenCalledTimes(3)
      expect(writeTextFile).toHaveBeenCalledTimes(3)
      expect(mockRefetchCard).toHaveBeenCalledTimes(3)
    })

    test('updates when card changes', () => {
      const { result, rerender } = renderHook<
        { card: TrelloCard | null },
        ReturnType<typeof useTrelloBreadcrumbs>
      >(({ card }) => useTrelloBreadcrumbs('api-key', 'token', card, mockRefetchCard), {
        initialProps: { card: mockCard }
      })

      expect(useParsedTrelloDescription).toHaveBeenCalledWith(mockCard.desc)

      const newCard = { ...mockCard, id: 'newcard', desc: 'New description' }
      rerender({ card: newCard })

      expect(useParsedTrelloDescription).toHaveBeenCalledWith('New description')
    })
  })

  describe('integration', () => {
    test('complete workflow: parse, update store, append, save file, refresh', async () => {
      const { result } = renderHook(() =>
        useTrelloBreadcrumbs('api-key', 'token', mockCard, mockRefetchCard)
      )

      // Breadcrumbs should be parsed from description
      expect(result.current.breadcrumbsData).toEqual(mockBreadcrumbsData)
      expect(result.current.breadcrumbsBlock).toEqual(mockBreadcrumbsBlock)

      // Append breadcrumbs
      await act(async () => {
        await result.current.handleAppendBreadcrumbs()
      })

      const expectedBreadcrumbs = {
        ...mockBreadcrumbsData,
        trelloCardUrl: `https://trello.com/c/${mockCard.id}`
      }

      // Should update store
      expect(mockSetBreadcrumbs).toHaveBeenCalledWith(expectedBreadcrumbs)

      // Should get breadcrumbs block
      expect(mockGetBreadcrumbsBlock).toHaveBeenCalledWith(mockCard)

      // Should append to card
      expect(mockApplyBreadcrumbsToCard).toHaveBeenCalledWith(
        mockCard,
        mockBreadcrumbsBlock
      )

      // Should save to file
      expect(writeTextFile).toHaveBeenCalledWith(
        '/path/to/projects/Test Project/breadcrumbs.json',
        JSON.stringify(expectedBreadcrumbs, null, 2)
      )

      // Should refresh card
      expect(mockRefetchCard).toHaveBeenCalled()
    })
  })
})
