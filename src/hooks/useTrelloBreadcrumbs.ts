/**
 * useTrelloBreadcrumbs - Breadcrumbs operations for Trello cards
 * Handles appending breadcrumbs to cards and saving to local files
 */

import { appStore } from '@store/useAppStore'
import { writeTextFile } from '@tauri-apps/plugin-fs'
import type { TrelloCard } from '@utils/TrelloCards'
import { useCallback } from 'react'

import { logger } from '@/utils/logger'

import { useAppendBreadcrumbs } from './useAppendBreadcrumbs'
import { useParsedTrelloDescription } from './useParsedTrelloDescription'

/**
 * Hook to manage breadcrumbs operations for Trello cards
 * @param apiKey - Trello API key
 * @param token - Trello auth token
 * @param selectedCardDetails - Currently selected card details
 * @param refetchCard - Function to refresh card details
 * @returns Breadcrumbs data and operations
 */
export function useTrelloBreadcrumbs(
  apiKey: string | null,
  token: string | null,
  selectedCardDetails: TrelloCard | null | undefined,
  refetchCard: () => void
) {
  const { getBreadcrumbsBlock, applyBreadcrumbsToCard } = useAppendBreadcrumbs(
    apiKey,
    token
  )

  // Parse card description for breadcrumbs
  const rawDescription = selectedCardDetails?.desc ?? ''
  const { mainDescription, breadcrumbsData, breadcrumbsBlock } =
    useParsedTrelloDescription(rawDescription)

  // Handle appending breadcrumbs to card
  const handleAppendBreadcrumbs = useCallback(async () => {
    if (!selectedCardDetails) return

    // First, add the Trello card URL to the breadcrumbs data
    const currentBreadcrumbs = appStore.getState().breadcrumbs
    const trelloCardUrl = `https://trello.com/c/${selectedCardDetails.id}`
    const updatedBreadcrumbs = {
      ...currentBreadcrumbs,
      trelloCardUrl
    }

    // Temporarily update the in-app store so getBreadcrumbsBlock includes the URL
    appStore.getState().setBreadcrumbs(updatedBreadcrumbs)

    const block = await getBreadcrumbsBlock(selectedCardDetails)
    if (block && selectedCardDetails) {
      await applyBreadcrumbsToCard(selectedCardDetails, block)

      // Save the updated breadcrumbs to the local file if we have the path info
      if (
        currentBreadcrumbs &&
        currentBreadcrumbs.parentFolder &&
        currentBreadcrumbs.projectTitle
      ) {
        const breadcrumbsPath = `${currentBreadcrumbs.parentFolder}/${currentBreadcrumbs.projectTitle}/breadcrumbs.json`
        try {
          await writeTextFile(
            breadcrumbsPath,
            JSON.stringify(updatedBreadcrumbs, null, 2)
          )
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          alert('Failed to save breadcrumbs: ' + errorMessage)
          logger.error('Failed to write breadcrumbs file:', error)
        }
      }

      // Refresh card details to show updated breadcrumbs
      refetchCard()
    }
  }, [selectedCardDetails, getBreadcrumbsBlock, applyBreadcrumbsToCard, refetchCard])

  return {
    mainDescription,
    breadcrumbsData,
    breadcrumbsBlock,
    handleAppendBreadcrumbs
  }
}
