/**
 * Shared Utils Barrel
 *
 * Re-exports logger, storage, debounce, validation, version utilities,
 * and breadcrumbs formatting/comparison utilities.
 */

// Logger
/** Structured logger with namespace, level filtering, and console output */
export { logger } from './logger'
/** Create a namespaced logger instance for module-specific logging */
export { createNamespacedLogger } from './logger'

// Storage (API keys persistence)
/** Persist API keys (Sprout Video, Trello) to secure local storage */
export { saveApiKeys } from './storage'
/** Load saved API keys from secure local storage */
export { loadApiKeys } from './storage'
/** API keys shape with optional Sprout Video and Trello key fields */
export type { ApiKeys } from './storage'

// Debounce
/** Debounce a function call by a specified delay in milliseconds */
export { debounce } from './debounce'

// Validation
/** Validate a video link object -- URL format, title length, required fields */
export { validateVideoLink } from './validation'
/** Validate a Trello card object -- URL format, required fields */
export { validateTrelloCard } from './validation'
/** Extract the Trello card ID from a full Trello card URL */
export { extractTrelloCardId } from './validation'
/** Check if a string is a valid HTTPS URL */
export { isValidHttpsUrl } from './validation'
/** Check if a string is a valid ISO 8601 date-time format */
export { isValidIso8601 } from './validation'
/** Check if a string length is within a specified maximum */
export { isWithinLength } from './validation'

// Version utilities
/** Normalize a version string to consistent semver format */
export { normalizeVersion } from './versionUtils'
/** Parse a version string into major, minor, patch numeric components */
export { parseVersion } from './versionUtils'
/** Compare two version strings -- returns -1, 0, or 1 */
export { compareVersions } from './versionUtils'
/** Check if a remote version is newer than the current local version */
export { isUpdateAvailable } from './versionUtils'

// CSS class merging
/** Merge Tailwind CSS classes with conflict resolution via clsx + twMerge */
export { cn } from './cn'

// Breadcrumbs utilities
/** Format a date for breadcrumbs display with full month and year */
export { formatBreadcrumbDate } from './breadcrumbs'
/** Format a date for breadcrumbs in short compact format */
export { formatBreadcrumbDateSimple } from './breadcrumbs'
/** Convert a breadcrumbs field key to a human-readable label */
export { formatFieldName } from './breadcrumbs'
/** Format a breadcrumbs field value for display -- handles arrays, dates, booleans */
export { formatFieldValue } from './breadcrumbs'
/** Format a file size in bytes to human-readable string (KB, MB, GB) */
export { formatFileSize } from './breadcrumbs'
/** Compare two breadcrumbs objects and return all field-level differences */
export { compareBreadcrumbs } from './breadcrumbs'
/** Compare breadcrumbs ignoring non-meaningful changes like whitespace */
export { compareBreadcrumbsMeaningful } from './breadcrumbs'
/** Categorize a breadcrumbs field into a display group -- metadata, media, links */
export { categorizeField } from './breadcrumbs'
/** Create a detailed field change record with old value, new value, and change type */
export { createDetailedFieldChange } from './breadcrumbs'
/** Generate a human-readable summary of all changes in a project update */
export { generateProjectChangeDetail } from './breadcrumbs'
/** Generate a full preview of breadcrumbs changes before applying */
export { generateBreadcrumbsPreview } from './breadcrumbs'
/** Debug utility for logging breadcrumbs comparison details */
export { debugComparison } from './breadcrumbs'
