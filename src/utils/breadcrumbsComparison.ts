/**
 * Breadcrumbs Comparison Utilities
 *
 * Re-exports all breadcrumbs comparison utilities from the breadcrumbs/ module.
 * This file provides backward compatibility for existing imports.
 */

export {
  // Date formatting
  formatBreadcrumbDate,
  formatBreadcrumbDateSimple,
  // Display formatting
  formatFieldName,
  formatFieldValue,
  formatFileSize,
  // Core comparison logic
  compareBreadcrumbs,
  compareBreadcrumbsMeaningful,
  // Field categorization and details
  categorizeField,
  createDetailedFieldChange,
  generateProjectChangeDetail,
  // Preview generation
  generateBreadcrumbsPreview,
  // Debug utilities
  debugComparison
} from './breadcrumbs'
