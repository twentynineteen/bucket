/**
 * Baker Trello Integration Hook
 *
 * Handles complex Trello card updating logic for Baker batch operations.
 */

import { readTextFile } from '@tauri-apps/plugin-fs'
import { useCallback } from 'react'

import { logger } from '@/utils/logger'

interface TrelloError {
  project: string
  error: string
}

interface UseBakerTrelloIntegrationProps {
  apiKey?: string
  token?: string
}

interface UseBakerTrelloIntegrationResult {
  updateTrelloCards: (projectPaths: string[]) => Promise<TrelloError[]>
}

/**
 * Extract card ID from Trello URL
 */
function extractCardIdFromUrl(trelloCardUrl: string): string | null {
  const cardIdMatch = trelloCardUrl.match(/\/c\/([^/]+)/)
  return cardIdMatch ? cardIdMatch[1] : null
}

/**
 * Update a single Trello card with breadcrumbs data
 */
async function updateSingleTrelloCard(
  cardId: string,
  breadcrumbsBlock: string,
  apiKey: string,
  token: string
): Promise<void> {
  // Create a mock TrelloCard object for the API call
  const mockCard = {
    id: cardId,
    desc: '',
    name: 'Baker Update',
    idList: ''
  }

  const { updateTrelloCardWithBreadcrumbs } = await import('@hooks/useAppendBreadcrumbs')

  await updateTrelloCardWithBreadcrumbs(mockCard, breadcrumbsBlock, apiKey, token, {
    autoReplace: true,
    silentErrors: true
  })
}

/**
 * Update all Trello cards for a project with breadcrumbs data
 * Handles both new trelloCards array and legacy trelloCardUrl field
 */
async function updateProjectTrelloCards(
  breadcrumbsData: Record<string, unknown>,
  apiKey: string,
  token: string
): Promise<void> {
  const { generateBreadcrumbsBlock } = await import('@hooks/useAppendBreadcrumbs')

  const block = generateBreadcrumbsBlock(breadcrumbsData)
  if (!block) return

  // Priority 1: Check for new trelloCards array (Phase 004)
  const trelloCards = breadcrumbsData.trelloCards as
    | Array<{ cardId: string; url: string }>
    | undefined

  if (trelloCards && trelloCards.length > 0) {
    // Update all cards in the array asynchronously
    const updatePromises = trelloCards.map((card) =>
      updateSingleTrelloCard(card.cardId, block, apiKey, token).catch((err) => {
        logger.warn(`Failed to update Trello card ${card.cardId}:`, err)
        throw err // Re-throw to be caught by Promise.allSettled
      })
    )

    // Use allSettled to ensure all cards are attempted even if some fail
    const results = await Promise.allSettled(updatePromises)

    // Log any failures but don't throw
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        logger.error(`Failed to update card ${trelloCards[index].cardId}:`, result.reason)
      }
    })

    return
  }

  // Fallback: Check for legacy trelloCardUrl field
  const trelloCardUrl = breadcrumbsData.trelloCardUrl as string | undefined
  if (!trelloCardUrl) return

  const cardId = extractCardIdFromUrl(trelloCardUrl)
  if (!cardId) return

  await updateSingleTrelloCard(cardId, block, apiKey, token)
}

export function useBakerTrelloIntegration({
  apiKey,
  token
}: UseBakerTrelloIntegrationProps): UseBakerTrelloIntegrationResult {
  const updateTrelloCards = useCallback(
    async (projectPaths: string[]): Promise<TrelloError[]> => {
      const trelloErrors: TrelloError[] = []

      // Only proceed if we have API credentials
      if (!apiKey || !token) {
        return trelloErrors
      }

      for (const projectPath of projectPaths) {
        try {
          // Read the updated breadcrumbs file
          const breadcrumbsPath = `${projectPath}/breadcrumbs.json`
          const breadcrumbsContent = await readTextFile(breadcrumbsPath)
          const breadcrumbsData = JSON.parse(breadcrumbsContent)

          await updateProjectTrelloCards(breadcrumbsData, apiKey, token)
        } catch (trelloError) {
          const projectName = projectPath.split('/').pop() || projectPath
          trelloErrors.push({
            project: projectName,
            error:
              trelloError instanceof Error ? trelloError.message : String(trelloError)
          })
          logger.warn(`Failed to update Trello card for ${projectPath}:`, trelloError)
        }
      }

      return trelloErrors
    },
    [apiKey, token]
  )

  return {
    updateTrelloCards
  }
}
