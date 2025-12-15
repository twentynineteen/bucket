/**
 * Breadcrumbs Field Categorization Utilities
 *
 * Functions for categorizing and detailing field changes.
 */

import type {
  BreadcrumbsDiff,
  DetailedFieldChange,
  FieldChange,
  ProjectChangeDetail
} from '@/types/baker'

import { logger } from '../logger'
import { formatFieldName, formatFieldValue } from './displayFormatting'

/**
 * Categorize fields by their type and importance
 */
export function categorizeField(field: string): {
  category: 'content' | 'metadata' | 'maintenance'
  impact: 'high' | 'medium' | 'low'
} {
  const fieldCategories = {
    // Content fields - directly affect project data
    files: { category: 'content', impact: 'high' },
    numberOfCameras: { category: 'content', impact: 'high' },
    projectTitle: { category: 'content', impact: 'medium' },
    trelloCardUrl: { category: 'content', impact: 'medium' },

    // Metadata fields - organizational information
    parentFolder: { category: 'metadata', impact: 'low' },
    folderSizeBytes: { category: 'metadata', impact: 'medium' },
    createdBy: { category: 'metadata', impact: 'low' },
    creationDateTime: { category: 'metadata', impact: 'low' },

    // Maintenance fields - system-generated information
    lastModified: { category: 'maintenance', impact: 'low' },
    scannedBy: { category: 'maintenance', impact: 'low' }
  } as const

  if (fieldCategories[field as keyof typeof fieldCategories]) {
    return fieldCategories[field as keyof typeof fieldCategories]
  } else {
    logger.warn(
      `[breadcrumbsComparison] Unknown field encountered in categorizeField: '${field}'. Defaulting to category 'metadata' with 'medium' impact.`
    )
    return { category: 'metadata', impact: 'medium' }
  }
}

/**
 * Create detailed field change with formatted values and categorization
 */
export function createDetailedFieldChange(change: FieldChange): DetailedFieldChange {
  const { category, impact } = categorizeField(change.field)

  return {
    ...change,
    fieldDisplayName: formatFieldName(change.field),
    formattedOldValue: formatFieldValue(change.oldValue, change.field),
    formattedNewValue: formatFieldValue(change.newValue, change.field),
    category,
    impact
  }
}

/**
 * Generate detailed project change information
 */
export function generateProjectChangeDetail(
  projectPath: string,
  diff: BreadcrumbsDiff
): ProjectChangeDetail {
  const projectName = projectPath.split('/').pop() || 'Unknown Project'

  // Convert all changes to detailed changes
  const detailedChanges = diff.changes.map(createDetailedFieldChange)

  // Categorize changes (exclude unchanged fields by default)
  const changeCategories = {
    content: detailedChanges.filter(
      (c) => c.category === 'content' && c.type !== 'unchanged'
    ),
    metadata: detailedChanges.filter(
      (c) => c.category === 'metadata' && c.type !== 'unchanged'
    ),
    maintenance: detailedChanges.filter(
      (c) => c.category === 'maintenance' && c.type !== 'unchanged'
    )
  }

  // Calculate summary (only count actual changes, not unchanged fields)
  const actualChanges = detailedChanges.filter((c) => c.type !== 'unchanged')
  const summary = {
    contentChanges: changeCategories.content.length,
    metadataChanges: changeCategories.metadata.length,
    maintenanceChanges: changeCategories.maintenance.length,
    totalChanges: actualChanges.length
  }

  return {
    projectPath,
    projectName,
    hasChanges: diff.hasChanges,
    changeCategories,
    summary
  }
}
