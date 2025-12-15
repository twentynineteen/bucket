/**
 * Tests for useTrelloVideoInfo hook
 * Handles video info operations for Trello cards
 */

import { useAppendVideoInfo } from '@/hooks/useAppendVideoInfo'
import { useTrelloVideoInfo } from '@/hooks/useTrelloVideoInfo'
import { useVideoInfoBlock } from '@/hooks/useVideoInfoBlock'
import { appStore } from '@/store/useAppStore'
import type { TrelloCard } from '@/utils/TrelloCards'
import type { SproutUploadResponse } from '@/utils/types'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

// Mock dependencies
vi.mock('@/hooks/useAppendVideoInfo', () => ({
  useAppendVideoInfo: vi.fn()
}))

vi.mock('@/hooks/useVideoInfoBlock', () => ({
  useVideoInfoBlock: vi.fn()
}))

vi.mock('@/store/useAppStore', () => ({
  appStore: {
    getState: vi.fn()
  }
}))

const mockCard: TrelloCard = {
  id: 'card123',
  name: 'Test Card',
  desc: 'Test description\n\n**Video Info:**\nTitle: Test Video',
  idList: 'list1'
}

const mockUploadedVideo: SproutUploadResponse = {
  id: 'video123',
  title: 'Test Video',
  privacy: 2,
  embedCode: '<iframe></iframe>',
  duration: 120,
  assets: {
    thumbnails: [{ url: 'https://example.com/thumb.jpg' }],
    videos: []
  }
}

const mockVideoInfoData = {
  title: 'Test Video',
  duration: 120
}

const mockVideoInfoBlock = '**Video Info:**\nTitle: Test Video\nDuration: 2:00'

describe('useTrelloVideoInfo', () => {
  const mockApplyVideoInfoToCard = vi.fn()
  const mockRefetchCard = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useAppendVideoInfo).mockReturnValue({
      applyVideoInfoToCard: mockApplyVideoInfoToCard
    })
    vi.mocked(useVideoInfoBlock).mockReturnValue({
      videoInfoData: mockVideoInfoData,
      videoInfoBlock: mockVideoInfoBlock
    })
    vi.mocked(appStore.getState).mockReturnValue({
      latestSproutUpload: mockUploadedVideo
    })
  })

  describe('initialization', () => {
    test('returns video info from app store', () => {
      const { result } = renderHook(() =>
        useTrelloVideoInfo('api-key', 'token', null, mockRefetchCard)
      )

      expect(result.current.uploadedVideo).toEqual(mockUploadedVideo)
    })

    test('returns null when no video in app store', () => {
      vi.mocked(appStore.getState).mockReturnValue({
        latestSproutUpload: null
      })

      const { result } = renderHook(() =>
        useTrelloVideoInfo('api-key', 'token', null, mockRefetchCard)
      )

      expect(result.current.uploadedVideo).toBeNull()
    })

    test('parses video info from card description', () => {
      const { result } = renderHook(() =>
        useTrelloVideoInfo('api-key', 'token', mockCard, mockRefetchCard)
      )

      expect(result.current.videoInfoData).toEqual(mockVideoInfoData)
      expect(result.current.videoInfoBlock).toEqual(mockVideoInfoBlock)
    })

    test('handles card with no description', () => {
      const cardWithoutDesc = { ...mockCard, desc: '' }

      const { result } = renderHook(() =>
        useTrelloVideoInfo('api-key', 'token', cardWithoutDesc, mockRefetchCard)
      )

      expect(useVideoInfoBlock).toHaveBeenCalledWith('')
    })
  })

  describe('handleAppendVideoInfo', () => {
    test('appends video info to card', async () => {
      const { result } = renderHook(() =>
        useTrelloVideoInfo('api-key', 'token', mockCard, mockRefetchCard)
      )

      await act(async () => {
        await result.current.handleAppendVideoInfo()
      })

      expect(mockApplyVideoInfoToCard).toHaveBeenCalledWith(mockCard, mockUploadedVideo)
    })

    test('refreshes card after appending video info', async () => {
      const { result } = renderHook(() =>
        useTrelloVideoInfo('api-key', 'token', mockCard, mockRefetchCard)
      )

      await act(async () => {
        await result.current.handleAppendVideoInfo()
      })

      expect(mockRefetchCard).toHaveBeenCalled()
    })

    test('does nothing when no card selected', async () => {
      const { result } = renderHook(() =>
        useTrelloVideoInfo('api-key', 'token', null, mockRefetchCard)
      )

      await act(async () => {
        await result.current.handleAppendVideoInfo()
      })

      expect(mockApplyVideoInfoToCard).not.toHaveBeenCalled()
      expect(mockRefetchCard).not.toHaveBeenCalled()
    })

    test('does nothing when no uploaded video', async () => {
      vi.mocked(appStore.getState).mockReturnValue({
        latestSproutUpload: null
      })

      const { result } = renderHook(() =>
        useTrelloVideoInfo('api-key', 'token', mockCard, mockRefetchCard)
      )

      await act(async () => {
        await result.current.handleAppendVideoInfo()
      })

      expect(mockApplyVideoInfoToCard).not.toHaveBeenCalled()
      expect(mockRefetchCard).not.toHaveBeenCalled()
    })

    test('handles API errors gracefully', async () => {
      mockApplyVideoInfoToCard.mockRejectedValueOnce(new Error('API Error'))

      const { result } = renderHook(() =>
        useTrelloVideoInfo('api-key', 'token', mockCard, mockRefetchCard)
      )

      await expect(
        act(async () => {
          await result.current.handleAppendVideoInfo()
        })
      ).rejects.toThrow('API Error')

      // Should not call refetch if API call failed
      expect(mockRefetchCard).not.toHaveBeenCalled()
    })
  })

  describe('video info parsing', () => {
    test('updates when card description changes', () => {
      const { result, rerender } = renderHook<
        { card: TrelloCard | null },
        ReturnType<typeof useTrelloVideoInfo>
      >(({ card }) => useTrelloVideoInfo('api-key', 'token', card, mockRefetchCard), {
        initialProps: { card: mockCard }
      })

      expect(useVideoInfoBlock).toHaveBeenCalledWith(mockCard.desc)

      // Change card description
      const updatedCard = { ...mockCard, desc: 'New description' }
      rerender({ card: updatedCard })

      expect(useVideoInfoBlock).toHaveBeenCalledWith('New description')
    })

    test('handles empty description', () => {
      const { result } = renderHook(() =>
        useTrelloVideoInfo('api-key', 'token', { ...mockCard, desc: '' }, mockRefetchCard)
      )

      expect(useVideoInfoBlock).toHaveBeenCalledWith('')
    })
  })

  describe('API credentials', () => {
    test('uses provided API credentials', () => {
      const { result } = renderHook(() =>
        useTrelloVideoInfo('custom-key', 'custom-token', mockCard, mockRefetchCard)
      )

      expect(useAppendVideoInfo).toHaveBeenCalledWith('custom-key', 'custom-token')
    })

    test('handles null credentials', () => {
      const { result } = renderHook(() =>
        useTrelloVideoInfo(null, null, mockCard, mockRefetchCard)
      )

      expect(useAppendVideoInfo).toHaveBeenCalledWith(null, null)
    })
  })

  describe('edge cases', () => {
    test('handles partial video data', () => {
      const partialVideo = {
        id: 'video123',
        title: 'Partial'
      }

      vi.mocked(appStore.getState).mockReturnValue({
        latestSproutUpload: partialVideo
      })

      const { result } = renderHook(() =>
        useTrelloVideoInfo('api-key', 'token', mockCard, mockRefetchCard)
      )

      expect(result.current.uploadedVideo).toEqual(partialVideo)
    })

    test('handles card without video info block', () => {
      vi.mocked(useVideoInfoBlock).mockReturnValue({
        videoInfoData: null,
        videoInfoBlock: ''
      })

      const { result } = renderHook(() =>
        useTrelloVideoInfo('api-key', 'token', mockCard, mockRefetchCard)
      )

      expect(result.current.videoInfoData).toBeNull()
      expect(result.current.videoInfoBlock).toBe('')
    })

    test('handles multiple rapid append calls', async () => {
      const { result } = renderHook(() =>
        useTrelloVideoInfo('api-key', 'token', mockCard, mockRefetchCard)
      )

      await act(async () => {
        await Promise.all([
          result.current.handleAppendVideoInfo(),
          result.current.handleAppendVideoInfo(),
          result.current.handleAppendVideoInfo()
        ])
      })

      expect(mockApplyVideoInfoToCard).toHaveBeenCalledTimes(3)
      expect(mockRefetchCard).toHaveBeenCalledTimes(3)
    })

    test('reads video from store on mount', () => {
      // Note: useMemo with empty deps means video is read once on mount
      // This is correct behavior - store value is snapshot at mount time
      const { result } = renderHook(() =>
        useTrelloVideoInfo('api-key', 'token', mockCard, mockRefetchCard)
      )

      expect(result.current.uploadedVideo).toEqual(mockUploadedVideo)
      expect(appStore.getState).toHaveBeenCalled()
    })
  })

  describe('integration', () => {
    test('complete workflow: get video, append, refresh', async () => {
      const { result } = renderHook(() =>
        useTrelloVideoInfo('api-key', 'token', mockCard, mockRefetchCard)
      )

      // Video should be available from store
      expect(result.current.uploadedVideo).toEqual(mockUploadedVideo)

      // Append video info
      await act(async () => {
        await result.current.handleAppendVideoInfo()
      })

      expect(mockApplyVideoInfoToCard).toHaveBeenCalledWith(mockCard, mockUploadedVideo)
      expect(mockRefetchCard).toHaveBeenCalled()
    })
  })
})
