/**
 * Media Types - Video Links and Trello Cards
 * Feature: 004-embed-multiple-video
 */

/**
 * Represents a video link (typically Sprout Video) associated with a project
 */
export interface VideoLink {
  /** Full video URL (e.g., https://sproutvideo.com/videos/abc123) */
  url: string

  /** Extracted Sprout Video ID (e.g., "abc123") */
  sproutVideoId?: string

  /** User-provided or fetched video title */
  title: string

  /** Cached thumbnail URL from Sprout API */
  thumbnailUrl?: string

  /** ISO 8601 timestamp of upload */
  uploadDate?: string

  /** Original filename from Renders/ folder */
  sourceRenderFile?: string
}

/**
 * Represents a Trello card associated with a project
 */
export interface TrelloCard {
  /** Full Trello card URL (e.g., https://trello.com/c/abc123/project-name) */
  url: string

  /** Extracted card ID (e.g., "abc123") */
  cardId: string

  /** Fetched card name/title from Trello API */
  title: string

  /** Optional board name from Trello API */
  boardName?: string

  /** ISO 8601 timestamp of last title fetch */
  lastFetched?: string
}

/**
 * Represents a Trello board with metadata
 * Returned from fetch_trello_boards Tauri command
 */
export interface TrelloBoard {
  /** Board ID (24-character alphanumeric) */
  id: string

  /** Board display name */
  name: string

  /** Organization details (if board belongs to an org) */
  organization?: TrelloOrganization

  /** Board preferences including visibility */
  prefs: TrelloBoardPrefs
}

/**
 * Trello organization information
 */
export interface TrelloOrganization {
  /** Organization display name */
  name: string
}

/**
 * Trello board preferences
 */
export interface TrelloBoardPrefs {
  /** Board permission level (e.g., "public", "private", "org") */
  permissionLevel: string
}

/**
 * Sprout Video API response structure
 * Returned from fetch_sprout_video_details Tauri command
 */
export interface SproutVideoDetails {
  /** Sprout Video ID */
  id: string

  /** Video title from Sprout API */
  title: string

  /** Video description (optional) */
  description?: string

  /** Video duration in seconds (floating point for precision) */
  duration: number

  /** Asset URLs including thumbnails */
  assets: SproutAssets

  /** ISO 8601 timestamp of video creation */
  created_at: string
}

/**
 * Sprout Video assets structure
 */
export interface SproutAssets {
  /** Array of poster frame/thumbnail URLs */
  poster_frames: string[]
}
