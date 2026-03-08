/**
 * Breadcrumbs Comparison Utilities
 *
 * Re-exports all breadcrumbs comparison and formatting utilities.
 */

// Date formatting
export { formatBreadcrumbDate, formatBreadcrumbDateSimple } from './dateFormatting'

// Display formatting
export { formatFieldName, formatFieldValue, formatFileSize } from './displayFormatting'

// Core comparison logic
export { compareBreadcrumbs, compareBreadcrumbsMeaningful } from './comparison'

// Field categorization and details
export {
  categorizeField,
  createDetailedFieldChange,
  generateProjectChangeDetail
} from './fieldCategorization'

// Preview generation
export { generateBreadcrumbsPreview } from './previewGeneration'

// Debug utilities (development only)
export { debugComparison } from './debug'
