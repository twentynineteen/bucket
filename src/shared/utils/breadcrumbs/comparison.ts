/**
 * Breadcrumbs Comparison Core Logic
 *
 * Core functions for comparing breadcrumbs files and generating diffs.
 */

import type { BreadcrumbsDiff, BreadcrumbsFile, FieldChange } from '@/types/baker'

/**
 * Deep equality check for any value type
 * Optimized with fast-paths for common cases
 */
function deepEqual(a: unknown, b: unknown): boolean {
  // Fast-path: Identical references (includes primitives and same object)
  if (a === b) return true

  // Fast-path: null/undefined
  if (a == null || b == null) return a === b

  // Fast-path: Different types
  if (typeof a !== typeof b) return false

  // Fast-path: Primitives (string, number, boolean, symbol, bigint)
  // If we reach here and type is not 'object' or 'function', they're different primitives
  if (typeof a !== 'object' && typeof a !== 'function') return false

  // Deep comparison for objects and arrays
  if (typeof a === 'object') {
    // Fast-path: Array type mismatch
    if (Array.isArray(a) !== Array.isArray(b)) return false

    if (Array.isArray(a)) {
      // Fast-path: Different array lengths
      if (a.length !== (b as unknown[]).length) return false
      // Recursive array comparison
      return a.every((item, index) => deepEqual(item, (b as unknown[])[index]))
    }

    // Object comparison with optimizations
    const keysA = Object.keys(a)
    const keysB = Object.keys(b)

    // Fast-path: Different number of keys
    if (keysA.length !== keysB.length) return false

    // Recursive object comparison
    return keysA.every((key) =>
      deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])
    )
  }

  // Functions and other types are not equal if not identical
  return false
}

/**
 * Compare two breadcrumbs files and generate a diff
 * @param current - Current breadcrumbs file (null if doesn't exist)
 * @param updated - What Baker will create/update to
 * @param includeMaintenance - Whether to include maintenance fields (timestamps, scannedBy)
 */
export function compareBreadcrumbs(
  current: BreadcrumbsFile | null,
  updated: BreadcrumbsFile,
  includeMaintenance: boolean = true
): BreadcrumbsDiff {
  const changes: FieldChange[] = []

  // Define meaningful content fields (always compared)
  const contentFields = [
    'projectTitle',
    'numberOfCameras',
    'files',
    'parentFolder',
    'createdBy',
    'creationDateTime',
    'folderSizeBytes',
    'trelloCardUrl'
  ] as const

  // Define maintenance fields (only compared if includeMaintenance is true)
  const maintenanceFields = ['lastModified', 'scannedBy'] as const

  const fieldsToCompare = includeMaintenance
    ? [...contentFields, ...maintenanceFields]
    : contentFields

  if (!current) {
    // All fields are new
    fieldsToCompare.forEach((field: keyof BreadcrumbsFile) => {
      if (updated[field] !== undefined) {
        changes.push({
          type: 'added',
          field,
          newValue: updated[field]
        })
      }
    })
  } else {
    // Compare each field
    fieldsToCompare.forEach((field: keyof BreadcrumbsFile) => {
      const oldValue = current[field]
      const newValue = updated[field]

      if (oldValue === undefined && newValue !== undefined) {
        changes.push({
          type: 'added',
          field,
          newValue
        })
      } else if (oldValue !== undefined && newValue === undefined) {
        changes.push({
          type: 'removed',
          field,
          oldValue
        })
      } else if (!deepEqual(oldValue, newValue)) {
        changes.push({
          type: 'modified',
          field,
          oldValue,
          newValue
        })
      } else if (oldValue !== undefined) {
        changes.push({
          type: 'unchanged',
          field,
          oldValue,
          newValue
        })
      }
    })
  }

  // Calculate summary
  const summary = changes.reduce(
    (acc, change) => {
      acc[change.type]++
      return acc
    },
    { added: 0, modified: 0, removed: 0, unchanged: 0 }
  )

  return {
    hasChanges: summary.added > 0 || summary.modified > 0 || summary.removed > 0,
    changes,
    summary
  }
}

/**
 * Detect if a createdBy change is just Baker maintenance (adding "- updated by Baker")
 */
function isBakerMaintenanceChange(oldValue: unknown, newValue: unknown): boolean {
  if (typeof oldValue !== 'string' || typeof newValue !== 'string') {
    return false
  }

  // Check if new value is just old value + Baker suffix
  const bakerSuffix = ' - updated by Baker'
  return (
    newValue === oldValue + bakerSuffix ||
    (newValue.endsWith(bakerSuffix) && newValue.startsWith(oldValue))
  )
}

/**
 * Compare breadcrumbs files for meaningful changes only (excluding maintenance)
 * Use this for determining if user confirmation is actually needed
 */
export function compareBreadcrumbsMeaningful(
  current: BreadcrumbsFile | null,
  updated: BreadcrumbsFile
): BreadcrumbsDiff {
  const fullDiff = compareBreadcrumbs(current, updated, true)

  // Filter out maintenance changes
  const meaningfulChanges = fullDiff.changes.filter((change) => {
    // Always exclude scannedBy (pure maintenance)
    if (change.field === 'scannedBy') {
      return false
    }

    // For lastModified, allow changes if current value is invalid/corrupted
    if (change.field === 'lastModified') {
      if (change.type === 'added') {
        return true // Adding missing lastModified is meaningful
      }
      if (change.type === 'modified' && change.oldValue) {
        // Check if old value is invalid date - if so, fixing it is meaningful
        try {
          const oldDate = new Date(change.oldValue as string)
          if (isNaN(oldDate.getTime())) {
            return true // Fixing invalid date is meaningful
          }
        } catch {
          return true // Fixing unparseable date is meaningful
        }
      }
      return false // Otherwise, lastModified updates are maintenance
    }

    // Filter out Baker maintenance createdBy changes
    if (change.field === 'createdBy' && change.type === 'modified') {
      return !isBakerMaintenanceChange(change.oldValue, change.newValue)
    }

    // For folderSizeBytes, meaningful if added or modified (indicates content changes)
    if (change.field === 'folderSizeBytes') {
      return change.type === 'added' || change.type === 'modified'
    }

    return true
  })

  // Recalculate summary for meaningful changes only
  const summary = meaningfulChanges.reduce(
    (acc, change) => {
      acc[change.type]++
      return acc
    },
    { added: 0, modified: 0, removed: 0, unchanged: 0 }
  )

  return {
    hasChanges: summary.added > 0 || summary.modified > 0 || summary.removed > 0,
    changes: meaningfulChanges,
    summary
  }
}
