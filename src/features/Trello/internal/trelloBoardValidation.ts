/**
 * Internal Trello board validation utilities
 * Not exported from barrel - module-internal only
 */

import { TrelloBoard } from '@shared/types'

/**
 * Board status categories for validation
 */
export type BoardStatus = 'accessible' | 'inaccessible' | 'unknown'

/**
 * Validates whether a board ID exists in the list of available boards
 */
export function validateBoardAccess(
  boardId: string,
  availableBoards: TrelloBoard[]
): boolean {
  if (!boardId || !availableBoards || availableBoards.length === 0) {
    return false
  }

  return availableBoards.some((board) => board.id === boardId)
}

/**
 * Categorizes the access status of a board ID
 */
export function categorizeBoardStatus(
  boardId: string | undefined,
  boards: TrelloBoard[] | undefined
): BoardStatus {
  if (!boardId) {
    return 'unknown'
  }

  if (!boards) {
    return 'unknown'
  }

  if (boards.length === 0) {
    return 'inaccessible'
  }

  const isAccessible = boards.some((board) => board.id === boardId)
  return isAccessible ? 'accessible' : 'inaccessible'
}

/**
 * Finds a board by ID in the available boards list
 */
export function findBoardById(
  boardId: string,
  boards: TrelloBoard[]
): TrelloBoard | undefined {
  return boards.find((board) => board.id === boardId)
}

/**
 * Groups boards by organization name
 */
export function groupBoardsByOrganization(
  boards: TrelloBoard[]
): Map<string | null, TrelloBoard[]> {
  const grouped = new Map<string | null, TrelloBoard[]>()

  for (const board of boards) {
    const orgName = board.organization?.name || null
    const existing = grouped.get(orgName) || []
    grouped.set(orgName, [...existing, board])
  }

  return grouped
}

/**
 * Formats a board's display name with organization context
 */
export function formatBoardDisplayName(board: TrelloBoard): string {
  const parts: string[] = [board.name]

  if (board.organization?.name) {
    parts.push(board.organization.name)
  }

  const icon = getVisibilityIcon(board.prefs.permissionLevel)
  if (icon) {
    parts.push(icon)
  }

  return parts.join(' \u00b7 ')
}

/**
 * Gets the appropriate icon for a board's visibility level
 */
export function getVisibilityIcon(permissionLevel: string): string {
  switch (permissionLevel) {
    case 'private':
      return '\uD83D\uDD12'
    case 'org':
      return '\uD83C\uDFE2'
    case 'public':
      return '\uD83C\uDF10'
    default:
      return ''
  }
}
