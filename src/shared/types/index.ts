/**
 * Shared Types Barrel
 *
 * Re-exports core domain types and media types.
 */

// Media types (video links, Trello cards, Sprout video)
export type {
  VideoLink,
  TrelloCard,
  TrelloBoard,
  TrelloOrganization,
  TrelloBoardPrefs,
  SproutVideoDetails,
  SproutAssets
} from './media'

// Core domain types (breadcrumbs, footage, sprout upload)
export type {
  SproutFolder,
  GetFoldersResponse,
  FootageData,
  Breadcrumb,
  SproutUploadResponse
} from './types'
