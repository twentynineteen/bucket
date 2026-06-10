/**
 * Baker Trello Integration Hook
 *
 * Handles complex Trello card updating logic for Baker batch operations.
 * Lives in Trello module per CONTEXT.md locked decision.
 */

import { useCallback } from 'react'

import { logger } from '@shared/utils'

import { fetchTrelloCardById, readBreadcrumbsFile } from '../api'

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
 * Signature of the breadcrumbs-applying function imported from `@features/Baker`.
 * Injected into `updateSingleTrelloCard` so the dynamic import happens once per
 * project rather than once per card.
 */
type ApplyBreadcrumbsFn = (
  card: { id: string; desc: string; name: string; idList: string },
  breadcrumbsBlock: string,
  apiKey: string,
  token: string,
  options: { autoReplace?: boolean; silentErrors?: boolean }
) => Promise<void>

/**
 * Update a single Trello card with breadcrumbs data.
 *
 * Fetches the card's CURRENT description first so existing content is preserved
 * (the breadcrumbs block is replaced/appended in place rather than overwriting
 * the whole description). Errors are surfaced (not silenced) so the caller can
 * report which cards failed instead of the update silently doing nothing.
 */
async function updateSingleTrelloCard(
  cardId: string,
  breadcrumbsBlock: string,
  apiKey: string,
  token: string,
  applyBreadcrumbs: ApplyBreadcrumbsFn
): Promise<void> {
  // Fetch the live card so we keep its existing description and metadata.
  // If the fetch fails we still attempt the update with an empty description
  // rather than aborting outright.
  let card = {
    id: cardId,
    desc: '',
    name: 'Baker Update',
    idList: ''
  }

  try {
    const current = (await fetchTrelloCardById(cardId, apiKey, token)) as {
      desc?: string
      name?: string
      idList?: string
    }
    card = {
      id: cardId,
      desc: current.desc ?? '',
      name: current.name ?? 'Baker Update',
      idList: current.idList ?? ''
    }
  } catch (err) {
    logger.warn(`Could not fetch current Trello card ${cardId}, proceeding:`, err)
  }

  await applyBreadcrumbs(card, breadcrumbsBlock, apiKey, token, {
    autoReplace: true,
    silentErrors: false
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
  // Import the Baker helpers ONCE per project (not once per card). Doing N
  // concurrent dynamic imports of the same module is wasteful and also defeats
  // module mocking under concurrency.
  const { generateBreadcrumbsBlock, updateTrelloCardWithBreadcrumbs } =
    await import('@features/Baker')

  const block = generateBreadcrumbsBlock(breadcrumbsData)
  if (!block) return

  // Priority 1: Check for new trelloCards array (Phase 004)
  const trelloCards = breadcrumbsData.trelloCards as
    | Array<{ cardId: string; url: string }>
    | undefined

  if (trelloCards && trelloCards.length > 0) {
    // Update ALL cards in the array. Use allSettled so every card is attempted
    // even if some fail, then aggregate failures so the caller can surface them
    // (previously failures were only logged, making updates silently no-op).
    const results = await Promise.allSettled(
      trelloCards.map((card) =>
        updateSingleTrelloCard(
          card.cardId,
          block,
          apiKey,
          token,
          updateTrelloCardWithBreadcrumbs
        )
      )
    )

    const failures = results
      .map((result, index) => ({ result, card: trelloCards[index] }))
      .filter(({ result }) => result.status === 'rejected')

    failures.forEach(({ result, card }) => {
      logger.error(
        `Failed to update card ${card.cardId}:`,
        (result as PromiseRejectedResult).reason
      )
    })

    if (failures.length > 0) {
      const reasons = failures
        .map(({ result, card }) => {
          const reason = (result as PromiseRejectedResult).reason
          const message = reason instanceof Error ? reason.message : String(reason)
          return `${card.cardId} (${message})`
        })
        .join(', ')
      throw new Error(
        `${failures.length} of ${trelloCards.length} Trello card(s) failed to update: ${reasons}`
      )
    }

    return
  }

  // Fallback: Check for legacy trelloCardUrl field
  const trelloCardUrl = breadcrumbsData.trelloCardUrl as string | undefined
  if (!trelloCardUrl) return

  const cardId = extractCardIdFromUrl(trelloCardUrl)
  if (!cardId) return

  await updateSingleTrelloCard(
    cardId,
    block,
    apiKey,
    token,
    updateTrelloCardWithBreadcrumbs
  )
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
          // Read the updated breadcrumbs file via api layer
          const breadcrumbsPath = `${projectPath}/breadcrumbs.json`
          const breadcrumbsContent = await readBreadcrumbsFile(breadcrumbsPath)
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
