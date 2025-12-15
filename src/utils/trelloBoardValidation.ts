import { TrelloBoard } from '@types/media'

/**
 * Board status categories for validation
 */
export type BoardStatus = 'accessible' | 'inaccessible' | 'unknown'

/**
 * Validates whether a board ID exists in the list of available boards
 *
 * @param boardId - The board ID to validate
 * @param availableBoards - Array of boards the user has access to
 * @returns true if the board is accessible, false otherwise
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
 *
 * @param boardId - The board ID to check
 * @param boards - Array of boards (can be undefined during loading)
 * @returns 'accessible' if found, 'inaccessible' if not found but boards loaded, 'unknown' if boards not yet loaded
 */
export function categorizeBoardStatus(
  boardId: string | undefined,
  boards: TrelloBoard[] | undefined
): BoardStatus {
  // If no board ID provided, status is unknown
  if (!boardId) {
    return 'unknown'
  }

  // If boards haven't loaded yet, status is unknown
  if (!boards) {
    return 'unknown'
  }

  // If boards loaded but empty, board is inaccessible
  if (boards.length === 0) {
    return 'inaccessible'
  }

  // Check if board exists in available boards
  const isAccessible = boards.some((board) => board.id === boardId)
  return isAccessible ? 'accessible' : 'inaccessible'
}

/**
 * Finds a board by ID in the available boards list
 *
 * @param boardId - The board ID to find
 * @param boards - Array of available boards
 * @returns The matching board or undefined if not found
 */
export function findBoardById(
  boardId: string,
  boards: TrelloBoard[]
): TrelloBoard | undefined {
  return boards.find((board) => board.id === boardId)
}

/**
 * Groups boards by organization name
 *
 * @param boards - Array of boards to group
 * @returns Map of organization name to boards array, with null key for personal boards
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
 *
 * @param board - The board to format
 * @returns Formatted display name (e.g., "Board Name · Org Name · 🔒")
 */
export function formatBoardDisplayName(board: TrelloBoard): string {
  const parts: string[] = [board.name]

  if (board.organization?.name) {
    parts.push(board.organization.name)
  }

  // Add visibility icon
  const icon = getVisibilityIcon(board.prefs.permissionLevel)
  if (icon) {
    parts.push(icon)
  }

  return parts.join(' · ')
}

/**
 * Gets the appropriate icon for a board's visibility level
 *
 * @param permissionLevel - The board's permission level
 * @returns Emoji icon representing the visibility
 */
export function getVisibilityIcon(permissionLevel: string): string {
  switch (permissionLevel) {
    case 'private':
      return '🔒'
    case 'org':
      return '🏢'
    case 'public':
      return '🌐'
    default:
      return ''
  }
}
