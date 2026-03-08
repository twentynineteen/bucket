/**
 * Breadcrumbs Display Formatting Utilities
 *
 * Functions for formatting field names and values for UI display.
 */

/**
 * Format field names for display
 */
export function formatFieldName(field: string): string {
  const fieldNames: Record<string, string> = {
    projectTitle: 'Project Title',
    numberOfCameras: 'Number of Cameras',
    files: 'Files',
    parentFolder: 'Parent Folder',
    createdBy: 'Created By',
    creationDateTime: 'Creation Date',
    folderSizeBytes: 'Folder Size',
    lastModified: 'Last Modified',
    scannedBy: 'Scanned By',
    trelloCardUrl: 'Trello Card'
  }

  return fieldNames[field] || field
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Format values for display in the diff
 */
export function formatFieldValue(value: unknown, field: string): string {
  if (value === null || value === undefined) {
    return 'Not set'
  }

  if (field === 'folderSizeBytes' && typeof value === 'number') {
    return formatFileSize(value)
  }

  if (field === 'files' && Array.isArray(value)) {
    return `${value.length} files`
  }

  if (
    field === 'creationDateTime' ||
    field === 'lastModified' ||
    field === 'creation date' ||
    field === 'last modified'
  ) {
    try {
      return new Date(value as string).toLocaleString()
    } catch {
      return String(value)
    }
  }

  if (field === 'trelloCardUrl' || field === 'trello card') {
    return String(value)
  }

  return String(value)
}
