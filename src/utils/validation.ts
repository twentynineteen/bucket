/**
 * Validation utilities for VideoLink and TrelloCard
 * Feature: 004-embed-multiple-video
 */

import { LIMITS } from '@constants/timing'

import type { TrelloCard, VideoLink } from '@/types/media'

/**
 * Validates a VideoLink object
 * @returns Array of error messages (empty if valid)
 */
export function validateVideoLink(link: VideoLink): string[] {
  const errors: string[] = []

  // Validate URL
  if (!link.url.startsWith('https://')) {
    errors.push('Video URL must use HTTPS')
  }

  if (link.url.length > LIMITS.URL_MAX_LENGTH) {
    errors.push(`Video URL exceeds maximum length (${LIMITS.URL_MAX_LENGTH} characters)`)
  }

  // Validate title
  if (!link.title || link.title.trim().length === 0) {
    errors.push('Video title is required')
  }

  if (link.title && link.title.length > 200) {
    errors.push('Video title exceeds maximum length (200 characters)')
  }

  // Validate optional thumbnail URL
  if (link.thumbnailUrl && !link.thumbnailUrl.startsWith('https://')) {
    errors.push('Thumbnail URL must use HTTPS')
  }

  // Validate optional upload date
  if (link.uploadDate && !isValidIso8601(link.uploadDate)) {
    errors.push('Upload date must be in ISO 8601 format')
  }

  return errors
}

/**
 * Validates a TrelloCard object
 * @returns Array of error messages (empty if valid)
 */
export function validateTrelloCard(card: TrelloCard): string[] {
  const errors: string[] = []

  // Validate URL format
  const urlPattern = /^https:\/\/trello\.com\/c\/([a-zA-Z0-9]{8,24})(\/.*)?$/
  const match = card.url.match(urlPattern)

  if (!match) {
    errors.push('Invalid Trello card URL format')
  } else {
    const extractedCardId = match[1]
    if (extractedCardId !== card.cardId) {
      errors.push('Card ID does not match URL')
    }
  }

  // Validate title
  if (!card.title || card.title.trim().length === 0) {
    errors.push('Trello card title is required')
  }

  if (card.title && card.title.length > 200) {
    errors.push('Trello card title exceeds maximum length (200 characters)')
  }

  // Validate optional last fetched date
  if (card.lastFetched && !isValidIso8601(card.lastFetched)) {
    errors.push('Last fetched timestamp must be in ISO 8601 format')
  }

  return errors
}

/**
 * Extracts Trello card ID from a Trello card URL
 * @returns Card ID or null if invalid URL
 */
export function extractTrelloCardId(url: string): string | null {
  const pattern = /trello\.com\/c\/([a-zA-Z0-9]{8,24})/
  const match = url.match(pattern)
  return match ? match[1] : null
}

/**
 * Helper: Validates if a string is a valid HTTPS URL
 */
export function isValidHttpsUrl(
  url: string,
  maxLength: number = LIMITS.URL_MAX_LENGTH
): boolean {
  return url.startsWith('https://') && url.length <= maxLength
}

/**
 * Helper: Validates if a string is valid ISO 8601 format
 */
export function isValidIso8601(dateString: string): boolean {
  // ISO 8601 / RFC3339 format: YYYY-MM-DDTHH:mm:ss.sss+00:00 or YYYY-MM-DDTHH:mm:ssZ
  // More flexible to accept various formats including subseconds with varying precision
  const iso8601Pattern =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?([+-]\d{2}:\d{2}|Z)$/
  if (!iso8601Pattern.test(dateString)) {
    return false
  }

  // Verify it's a valid date
  const date = new Date(dateString)
  return !isNaN(date.getTime())
}

/**
 * Helper: Validates string length is within bounds
 */
export function isWithinLength(str: string, min: number, max: number): boolean {
  return str.length >= min && str.length <= max
}
