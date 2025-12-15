import { appStore } from '@store/useAppStore'
import { useQueryClient } from '@tanstack/react-query'
import { ask, confirm, open } from '@tauri-apps/plugin-dialog'
import { readTextFile } from '@tauri-apps/plugin-fs'
import { TrelloCard as LegacyTrelloCard } from '@utils/TrelloCards'
import type { Breadcrumb } from '@utils/types'

import { logger } from '@/utils/logger'

function formatBreadcrumbsForHumans(breadcrumbs: Breadcrumb): string {
  const lines = ['PROJECT DETAILS', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━']

  if (breadcrumbs.projectTitle) {
    lines.push(`**Project:** ${breadcrumbs.projectTitle}`)
  }

  if (breadcrumbs.numberOfCameras) {
    lines.push(`**Cameras:** ${breadcrumbs.numberOfCameras} cameras`)
  }

  if (breadcrumbs.parentFolder) {
    lines.push(`**Location:** ${breadcrumbs.parentFolder}`)
  }

  if (breadcrumbs.createdBy) {
    const creator =
      typeof breadcrumbs.createdBy === 'string'
        ? breadcrumbs.createdBy
        : breadcrumbs.createdBy?.data || 'Unknown User'
    lines.push(`**Created by:** ${creator}`)
  }

  if (breadcrumbs.creationDateTime) {
    lines.push(`**Created:** ${breadcrumbs.creationDateTime}`)
  }

  // Add video links if present (Phase 004)
  if (breadcrumbs.videoLinks && breadcrumbs.videoLinks.length > 0) {
    lines.push(`\n**Videos:** ${breadcrumbs.videoLinks.length} linked`)
    breadcrumbs.videoLinks.forEach((video, index) => {
      lines.push(`   ${index + 1}. [${video.title}](${video.url})`)
    })
  }

  if (breadcrumbs.trelloCardUrl) {
    lines.push(`\n**Trello Card:** ${breadcrumbs.trelloCardUrl}`)
  }

  // Add Trello cards if present (Phase 004)
  if (breadcrumbs.trelloCards && breadcrumbs.trelloCards.length > 0) {
    lines.push(`**Trello Cards:** ${breadcrumbs.trelloCards.length} linked`)
    breadcrumbs.trelloCards.forEach((card, index) => {
      lines.push(`   ${index + 1}. [${card.title}](${card.url})`)
    })
  }

  if (breadcrumbs.files && breadcrumbs.files.length > 0) {
    const totalFiles = breadcrumbs.files.length
    lines.push(`**Files:** ${totalFiles} footage files total`)

    // Group files by camera
    const filesByCamera: Record<number, number> = {}
    breadcrumbs.files.forEach((file) => {
      filesByCamera[file.camera] = (filesByCamera[file.camera] || 0) + 1
    })

    Object.entries(filesByCamera)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .forEach(([camera, count]) => {
        lines.push(`   • Camera ${camera}: ${count} files`)
      })
  }

  return lines.join('\n')
}

// Utility function to generate breadcrumbs block without dialogs
export function generateBreadcrumbsBlock(breadcrumbsData: Breadcrumb): string {
  const humanReadableSummary = formatBreadcrumbsForHumans(breadcrumbsData)
  const breadcrumbMarker = '```json\n// BREADCRUMBS'
  const technicalBlock = `${breadcrumbMarker}\n${JSON.stringify(breadcrumbsData, null, 2)}\n\`\`\``

  return `${humanReadableSummary}\n\n---\n*Technical details for Bucket app below:*\n${technicalBlock}`
}

// Utility function to update Trello card with breadcrumbs without dialogs
export async function updateTrelloCardWithBreadcrumbs(
  card: LegacyTrelloCard,
  breadcrumbsBlock: string,
  apiKey: string,
  token: string,
  options: {
    autoReplace?: boolean
    silentErrors?: boolean
  } = {}
): Promise<void> {
  try {
    const currentDesc = card.desc ?? ''

    // Define regex patterns (without global flag for testing, with global flag for replacement)
    const newFormatPattern =
      /PROJECT DETAILS\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━[\s\S]*?```json\n\/\/ BREADCRUMBS[\s\S]*?```/
    const legacyFormatPattern = /```json\n\/\/ BREADCRUMBS[\s\S]*?```/

    // Check for existing breadcrumbs
    const hasNewFormatBreadcrumbs = newFormatPattern.test(currentDesc)
    const hasLegacyFormatBreadcrumbs =
      legacyFormatPattern.test(currentDesc) && !hasNewFormatBreadcrumbs
    const hasBreadcrumbs = hasNewFormatBreadcrumbs || hasLegacyFormatBreadcrumbs

    // Create global regex for replacement
    const replacementRegex = hasNewFormatBreadcrumbs
      ? new RegExp(newFormatPattern.source, 'g')
      : new RegExp(legacyFormatPattern.source, 'g')

    let updatedDesc = currentDesc

    if (hasBreadcrumbs && options.autoReplace) {
      // Auto-replace existing breadcrumbs
      updatedDesc = currentDesc.replace(replacementRegex, breadcrumbsBlock)
    } else if (!hasBreadcrumbs) {
      // Add new breadcrumbs
      updatedDesc = `${currentDesc}\n\n${breadcrumbsBlock}`
    }

    const response = await fetch(
      `https://api.trello.com/1/cards/${card.id}?key=${apiKey}&token=${token}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ desc: updatedDesc })
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to update card: ${response.statusText}`)
    }

    // Add a comment to the card indicating breadcrumbs were linked
    const commentResponse = await fetch(
      `https://api.trello.com/1/cards/${card.id}/actions/comments?key=${apiKey}&token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: 'Linked this card to the project and left some breadcrumbs...'
        })
      }
    )

    if (!commentResponse.ok) {
      logger.warn(`Failed to add comment: ${commentResponse.statusText}`)
    }
  } catch (err) {
    logger.error('Failed to update Trello card with breadcrumbs:', err)
    if (!options.silentErrors) {
      throw err
    }
  }
}

export function useAppendBreadcrumbs(
  apiKey: string | null,
  token: string | null,
  options: {
    skipDialogs?: boolean
    breadcrumbsData?: Breadcrumb
    autoReplace?: boolean
    silentErrors?: boolean
  } = {}
): {
  getBreadcrumbsBlock: (card: LegacyTrelloCard | null) => Promise<string | null>
  applyBreadcrumbsToCard: (
    card: LegacyTrelloCard,
    breadcrumbsBlock: string
  ) => Promise<void>
} {
  const queryClient = useQueryClient()

  async function getBreadcrumbsBlock(
    card: LegacyTrelloCard | null
  ): Promise<string | null> {
    if (!card || !apiKey || !token) return null

    try {
      let finalBreadcrumbs

      if (options.skipDialogs && options.breadcrumbsData) {
        // Baker mode: use provided breadcrumbs data directly
        finalBreadcrumbs = options.breadcrumbsData
      } else {
        // UploadTrello mode: use dialogs to get breadcrumbs
        const breadcrumbs = appStore.getState().breadcrumbs

        const useCurrent: boolean = await ask(
          'Use current in-app breadcrumbs? Click "No" to load from a JSON file.',
          {
            title: 'Choose Breadcrumb Source',
            okLabel: 'Use Current',
            cancelLabel: 'Load from File'
          }
        )

        finalBreadcrumbs = breadcrumbs

        if (!useCurrent) {
          const selectedFile = await open({
            multiple: false,
            filters: [{ name: 'JSON Files', extensions: ['json'] }]
          })
          if (typeof selectedFile === 'string') {
            const fileContents: string = await readTextFile(selectedFile)
            finalBreadcrumbs = JSON.parse(fileContents)
          } else {
            return null // User canceled file selection
          }
        }
      }

      const humanReadableSummary = formatBreadcrumbsForHumans(finalBreadcrumbs)
      const breadcrumbMarker = '```json\n// BREADCRUMBS'
      const technicalBlock = `${breadcrumbMarker}\n${JSON.stringify(finalBreadcrumbs, null, 2)}\n\`\`\``

      const breadcrumbsBlock = `${humanReadableSummary}\n\n---\n*Technical details for Bucket app below:*\n${technicalBlock}`

      return breadcrumbsBlock
    } catch (err) {
      logger.error('Failed to prepare breadcrumbs:', err)
      if (options.silentErrors) {
        return null // Don't throw in batch mode
      }
      throw err
    }
  }

  async function applyBreadcrumbsToCard(
    card: LegacyTrelloCard,
    breadcrumbsBlock: string
  ): Promise<void> {
    try {
      const currentDesc = card.desc ?? ''

      // Define regex patterns (without global flag for testing, with global flag for replacement)
      const newFormatPattern =
        /PROJECT DETAILS\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━[\s\S]*?```json\n\/\/ BREADCRUMBS[\s\S]*?```/
      const legacyFormatPattern = /```json\n\/\/ BREADCRUMBS[\s\S]*?```/

      // Check for existing breadcrumbs
      const hasNewFormatBreadcrumbs = newFormatPattern.test(currentDesc)
      const hasLegacyFormatBreadcrumbs =
        legacyFormatPattern.test(currentDesc) && !hasNewFormatBreadcrumbs
      const hasBreadcrumbs = hasNewFormatBreadcrumbs || hasLegacyFormatBreadcrumbs

      // Create global regex for replacement
      const replacementRegex = hasNewFormatBreadcrumbs
        ? new RegExp(newFormatPattern.source, 'g')
        : new RegExp(legacyFormatPattern.source, 'g')

      let updatedDesc = currentDesc

      if (hasBreadcrumbs) {
        // Check if we should auto-replace or ask user
        if (options.autoReplace) {
          // Baker mode: automatically replace
          updatedDesc = currentDesc.replace(replacementRegex, breadcrumbsBlock)
        } else {
          // UploadTrello mode: ask user for confirmation
          const breadcrumbsType = hasNewFormatBreadcrumbs
            ? 'project details'
            : 'legacy breadcrumbs'
          const warningMessage = `This Trello card already contains ${breadcrumbsType} from a previous project link.\n\nReplacing them will remove the existing project connection and add the new one.\n\nDo you want to continue?`

          const shouldReplace: boolean = await confirm(warningMessage, {
            title: 'Breadcrumbs Already Exist',
            okLabel: 'Replace Existing',
            cancelLabel: 'Cancel'
          })
          if (!shouldReplace) return
          updatedDesc = currentDesc.replace(replacementRegex, breadcrumbsBlock)
        }
      } else {
        updatedDesc = `${currentDesc}\n\n${breadcrumbsBlock}`
      }

      const response = await fetch(
        `https://api.trello.com/1/cards/${card.id}?key=${apiKey}&token=${token}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ desc: updatedDesc })
        }
      )

      if (!response.ok) {
        throw new Error(`Failed to update card: ${response.statusText}`)
      }

      // Add a comment to the card indicating breadcrumbs were linked
      const commentResponse = await fetch(
        `https://api.trello.com/1/cards/${card.id}/actions/comments?key=${apiKey}&token=${token}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: 'Linked this card to the project and left some breadcrumbs...'
          })
        }
      )

      if (!commentResponse.ok) {
        logger.warn(`Failed to add comment: ${commentResponse.statusText}`)
      }

      await queryClient.invalidateQueries({ queryKey: ['trello-card', card.id] })
    } catch (err) {
      logger.error('Failed to apply breadcrumbs to card:', err)
      if (options.silentErrors) {
        // In batch mode, don't throw - let caller handle the error
        return
      }
      throw err
    }
  }

  return { getBreadcrumbsBlock, applyBreadcrumbsToCard }
}
