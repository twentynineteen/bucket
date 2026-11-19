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
