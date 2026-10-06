// Generated from src-tauri/src/breadcrumbs by
// `UPDATE_BINDINGS=1 cargo test b11_2` in src-tauri. Do not edit by hand.

export type FileInfo = { 
/**
 * The `N` of the `Footage/Camera N` folder holding the file.
 */
camera: number, name: string, 
/**
 * Project-relative (`Footage/Camera N/<name>`). Files written by older
 * versions may hold an absolute path, which callers use as it is.
 */
path: string, };

export type VideoLink = { 
/**
 * Full video URL (e.g., https://sproutvideo.com/videos/abc123)
 */
url: string, 
/**
 * Extracted Sprout Video ID (e.g., "abc123")
 */
sproutVideoId?: string, 
/**
 * User-provided or fetched video title
 */
title: string, 
/**
 * Cached thumbnail URL from Sprout API
 */
thumbnailUrl?: string, 
/**
 * ISO 8601 timestamp of upload
 */
uploadDate?: string, 
/**
 * Original filename from Renders/ folder
 */
sourceRenderFile?: string, };

export type TrelloCard = { 
/**
 * Full Trello card URL (e.g., https://trello.com/c/abc123/project-name)
 */
url: string, 
/**
 * Extracted card ID (e.g., "abc123")
 */
cardId: string, 
/**
 * Fetched card name/title from Trello API
 */
title: string, 
/**
 * Optional board name from Trello API
 */
boardName?: string, 
/**
 * ISO 8601 timestamp of last title fetch
 */
lastFetched?: string, };

export type Breadcrumbs = { projectTitle: string, numberOfCameras: number, files: Array<FileInfo>, 
/**
 * The folder that contains the project folder.
 */
parentFolder: string, createdBy: string, creationDateTime: string, folderSizeBytes?: number, lastModified?: string, scannedBy?: string, videoLinks?: Array<VideoLink>, trelloCards?: Array<TrelloCard>, };

export type Fix = { "kind": "createdByNotAString" } | { "kind": "migratedTrelloCardUrl" } | { "kind": "parentFolderWasProjectFolder" };

export type Change = { "kind": "create", title: string, createdBy: string, } | { "kind": "rescan" } | { "kind": "refreshSizes" } | { "kind": "addVideoLink", link: VideoLink, } | { "kind": "updateVideoLink", index: number, expectedUrl: string, link: VideoLink, } | { "kind": "removeVideoLink", index: number, } | { "kind": "reorderVideoLinks", from: number, to: number, } | { "kind": "addTrelloCard", card: TrelloCard, } | { "kind": "removeTrelloCard", cardId: string, };

export type ChangeError = { "kind": "projectNotFound" } | { "kind": "noBreadcrumbs" } | { "kind": "alreadyExists" } | { "kind": "unreadable", reason: string, } | { "kind": "nothingToDescribe" } | { "kind": "limitReached", limit: number, } | { "kind": "indexOutOfRange", index: number, } | { "kind": "linkChanged", expectedUrl: string, actualUrl: string, } | { "kind": "cardNotLinked", cardId: string, } | { "kind": "io", message: string, };

export type Read = { "kind": "missing" } | { "kind": "found", file: Breadcrumbs, fixes: Array<Fix>, } | { "kind": "unreadable", reason: string, } | { "kind": "projectNotFound" } | { "kind": "inaccessible", reason: string, };

export type Preview = { 
/**
 * The file as read, or `None` when there was none (or it was unreadable).
 */
before: Breadcrumbs | null, 
/**
 * The file `apply` would write.
 */
after: Breadcrumbs, };

export type ApplyOutcome = { "status": "applied", project: string, file: Breadcrumbs, } | { "status": "failed", project: string, error: ChangeError, message: string, };

export type PreviewOutcome = { "status": "previewed", project: string, preview: Preview, } | { "status": "failed", project: string, error: ChangeError, message: string, };

export const MAX_VIDEO_LINKS = 20

export const MAX_TRELLO_CARDS = 50
