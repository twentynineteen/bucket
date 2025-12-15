/**
 * useTrelloVideoInfo - Video info operations for Trello cards
 * Handles uploading and parsing video information
 */

import { appStore } from '@store/useAppStore'
import type { TrelloCard } from '@utils/TrelloCards'
import { useCallback, useMemo } from 'react'

import { useAppendVideoInfo } from './useAppendVideoInfo'
import { useVideoInfoBlock } from './useVideoInfoBlock'

/**
 * Hook to manage video info operations for Trello cards
 * @param apiKey - Trello API key
 * @param token - Trello auth token
 * @param selectedCardDetails - Currently selected card details
 * @param refetchCard - Function to refresh card details
 * @returns Video info data and operations
 */
export function useTrelloVideoInfo(
  apiKey: string | null,
  token: string | null,
  selectedCardDetails: TrelloCard | null | undefined,
  refetchCard: () => void
) {
  const { applyVideoInfoToCard } = useAppendVideoInfo(apiKey, token)

  // Get uploaded video from app state
  const uploadedVideo = useMemo(() => {
    const state = appStore.getState()
    return state?.latestSproutUpload || null
  }, [])

  // Parse card description for video info
  const rawDescription = selectedCardDetails?.desc ?? ''
  const { videoInfoData, videoInfoBlock } = useVideoInfoBlock(rawDescription)

  // Handle appending video info to card
  const handleAppendVideoInfo = useCallback(async () => {
    if (selectedCardDetails && uploadedVideo) {
      await applyVideoInfoToCard(selectedCardDetails, uploadedVideo)
      // Refresh card details to show updated video info
      refetchCard()
    }
  }, [selectedCardDetails, uploadedVideo, applyVideoInfoToCard, refetchCard])

  return {
    uploadedVideo,
    videoInfoData,
    videoInfoBlock,
    handleAppendVideoInfo
  }
}
