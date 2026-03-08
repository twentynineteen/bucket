/**
 * Shared Utils Barrel
 *
 * Re-exports logger, storage, debounce, validation, version utilities,
 * and breadcrumbs formatting/comparison utilities.
 */

// Logger
export { logger, createNamespacedLogger } from './logger'

// Storage (API keys persistence)
export { saveApiKeys, loadApiKeys } from './storage'
export type { ApiKeys } from './storage'

// Debounce
export { debounce } from './debounce'

// Validation
export {
  validateVideoLink,
  validateTrelloCard,
  extractTrelloCardId,
  isValidHttpsUrl,
  isValidIso8601,
  isWithinLength
} from './validation'

// Version utilities
export {
  normalizeVersion,
  parseVersion,
  compareVersions,
  isUpdateAvailable
} from './versionUtils'

// Breadcrumbs utilities
export {
  formatBreadcrumbDate,
  formatBreadcrumbDateSimple,
  formatFieldName,
  formatFieldValue,
  formatFileSize,
  compareBreadcrumbs,
  compareBreadcrumbsMeaningful,
  categorizeField,
  createDetailedFieldChange,
  generateProjectChangeDetail,
  generateBreadcrumbsPreview,
  debugComparison
} from './breadcrumbs'
