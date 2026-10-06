/**
 * Breadcrumbs feature barrel (issue #303)
 *
 * The one way into a project's breadcrumbs.json. Named re-exports only.
 */

// I/O
/** Read a project's breadcrumbs file, repaired in memory */
export { readBreadcrumbs } from './api'
/** Apply one named change to one or more projects */
export { applyBreadcrumbsChange } from './api'
/** Work out what a change would write, without writing */
export { previewBreadcrumbsChange } from './api'

// Limits
/** Most video links one project may hold, as the Rust module enforces */
export { MAX_VIDEO_LINKS } from './internal/bindings.generated'
/** Most Trello cards one project may hold, as the Rust module enforces */
export { MAX_TRELLO_CARDS } from './internal/bindings.generated'

// Types
/** A project's breadcrumbs file */
export type { Breadcrumbs } from './internal/bindings.generated'
/** One footage file recorded in the breadcrumbs file */
export type { FileInfo } from './internal/bindings.generated'
/** A video link recorded in the breadcrumbs file */
export type { VideoLink } from './internal/bindings.generated'
/** A Trello card linked from the breadcrumbs file */
export type { TrelloCard } from './internal/bindings.generated'
/** A named edit to a breadcrumbs file */
export type { Change } from './internal/bindings.generated'
/** Why a change could not be applied to one project */
export type { ChangeError } from './internal/bindings.generated'
/** A repair a read made to a drifted file */
export type { Fix } from './internal/bindings.generated'
/** What a read found: missing, found (with fixes) or unreadable */
export type { Read } from './internal/bindings.generated'
/** A change worked out but not written */
export type { Preview } from './internal/bindings.generated'
/** One project's result from applying a change */
export type { ApplyOutcome } from './internal/bindings.generated'
/** One project's result from previewing a change */
export type { PreviewOutcome } from './internal/bindings.generated'
