/**
 * Migration utilities for backward compatibility
 * Feature: 004-embed-multiple-video
 */

import type { BreadcrumbsFile, TrelloCard } from '@/types/baker'

import { extractTrelloCardId } from './validation'

/**
 * Migrates legacy trelloCardUrl to trelloCards array format
 * @returns Array of TrelloCard objects (may be empty)
 */
export function migrateTrelloCardUrl(breadcrumbs: BreadcrumbsFile): TrelloCard[] {
  // If already has new format, return it
  if (breadcrumbs.trelloCards && breadcrumbs.trelloCards.length > 0) {
    return breadcrumbs.trelloCards
  }

  // If has legacy format, migrate it
  if (breadcrumbs.trelloCardUrl) {
    const cardId = extractTrelloCardId(breadcrumbs.trelloCardUrl)
    if (cardId) {
      return [
        {
          url: breadcrumbs.trelloCardUrl,
          cardId,
          title: `Card ${cardId}` // Default title for migrated cards
        }
      ]
    }
  }

  return []
}

/**
 * Ensures breadcrumbs file maintains backward compatibility
 * Updates trelloCardUrl field to match first card in array
 * @returns Modified breadcrumbs with backward-compatible fields
 */
export function ensureBackwardCompatibleWrite(
  breadcrumbs: BreadcrumbsFile
): BreadcrumbsFile {
  const result = { ...breadcrumbs }

  // Update trelloCardUrl to point to first card (or undefined if none)
  if (result.trelloCards && result.trelloCards.length > 0) {
    result.trelloCardUrl = result.trelloCards[0].url
  } else {
    result.trelloCardUrl = undefined
  }

  return result
}

/**
 * Checks if a breadcrumbs file uses legacy format
 */
export function isLegacyFormat(breadcrumbs: BreadcrumbsFile): boolean {
  return !!breadcrumbs.trelloCardUrl && !breadcrumbs.trelloCards
}

/**
 * Checks if a breadcrumbs file uses new format
 */
export function isNewFormat(breadcrumbs: BreadcrumbsFile): boolean {
  return (
    (breadcrumbs.trelloCards && breadcrumbs.trelloCards.length > 0) ||
    (breadcrumbs.videoLinks && breadcrumbs.videoLinks.length > 0)
  )
}
