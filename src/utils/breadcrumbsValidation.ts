/**
 * Breadcrumbs Validation and Error Handling Utilities
 *
 * Utilities for validating breadcrumbs files, handling corrupted data,
 * and providing graceful fallbacks for edge cases.
 */

import type { BreadcrumbsFile, FileInfo } from '@/types/baker'

export interface ValidationError {
  field: string
  message: string
  severity: 'error' | 'warning' | 'info'
}

export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings: ValidationError[]
  canRecover: boolean
  recoveredData?: Partial<BreadcrumbsFile>
}

/**
 * Validate a single file info object
 * Extracted to reduce nesting in validateBreadcrumbs
 */
function validateFileInfo(
  file: unknown,
  index: number,
  warnings: ValidationError[]
): FileInfo | null {
  // Early return for invalid file objects
  if (typeof file !== 'object' || file === null) {
    warnings.push({
      field: `files[${index}]`,
      message: `File ${index}: Invalid file object, skipping`,
      severity: 'warning'
    })
    return null
  }

  const fileObj = file as Record<string, unknown>
  const validFile: Partial<FileInfo> = {}

  // Validate camera number
  validFile.camera = validateFileCamera(fileObj.camera, index, warnings)

  // Validate file name
  validFile.name = validateFileName(fileObj.name, index, warnings)

  // Validate file path
  validFile.path = validateFilePath(fileObj.path, validFile.name, index, warnings)

  // Only return file if all required fields are present
  if (validFile.camera && validFile.name && validFile.path) {
    return validFile as FileInfo
  }

  return null
}

/**
 * Validate file camera number
 */
function validateFileCamera(
  camera: unknown,
  index: number,
  warnings: ValidationError[]
): number {
  if (typeof camera === 'number') {
    if (camera >= 1) {
      return camera
    }
    warnings.push({
      field: `files[${index}].camera`,
      message: `File ${index}: Invalid camera number, defaulting to 1`,
      severity: 'warning'
    })
    return 1
  }

  warnings.push({
    field: `files[${index}].camera`,
    message: `File ${index}: Missing camera number, defaulting to 1`,
    severity: 'warning'
  })
  return 1
}

/**
 * Validate file name
 */
function validateFileName(
  name: unknown,
  index: number,
  warnings: ValidationError[]
): string {
  if (typeof name === 'string' && name.trim()) {
    return name.trim()
  }

  warnings.push({
    field: `files[${index}].name`,
    message: `File ${index}: Invalid or missing name, using placeholder`,
    severity: 'warning'
  })
  return `Unknown_File_${index + 1}`
}

/**
 * Validate file path
 */
function validateFilePath(
  path: unknown,
  fallbackName: string | undefined,
  index: number,
  warnings: ValidationError[]
): string {
  if (typeof path === 'string' && path.trim()) {
    return path.trim()
  }

  warnings.push({
    field: `files[${index}].path`,
    message: `File ${index}: Missing path, will need to be rescanned`,
    severity: 'warning'
  })
  return fallbackName || `Unknown_Path_${index + 1}`
}

/**
 * Validate a breadcrumbs file for corruption and missing data
 */
export function validateBreadcrumbs(data: unknown): ValidationResult {
  const errors: ValidationError[] = []
  const warnings: ValidationError[] = []

  if (!data || typeof data !== 'object') {
    return {
      isValid: false,
      errors: [
        {
          field: 'root',
          message: 'Invalid or missing breadcrumbs data',
          severity: 'error'
        }
      ],
      warnings: [],
      canRecover: false
    }
  }

  const breadcrumbs = data as Record<string, unknown>
  const recoveredData: Partial<BreadcrumbsFile> = {}

  // Validate required fields
  if (!breadcrumbs.projectTitle || typeof breadcrumbs.projectTitle !== 'string') {
    if (!breadcrumbs.projectTitle) {
      errors.push({
        field: 'projectTitle',
        message: 'Project title is required',
        severity: 'error'
      })
    } else {
      warnings.push({
        field: 'projectTitle',
        message: 'Project title should be a string',
        severity: 'warning'
      })
      recoveredData.projectTitle = String(breadcrumbs.projectTitle)
    }
  } else {
    recoveredData.projectTitle = breadcrumbs.projectTitle
  }

  // Validate number of cameras
  if (typeof breadcrumbs.numberOfCameras !== 'number') {
    if (breadcrumbs.numberOfCameras === undefined) {
      warnings.push({
        field: 'numberOfCameras',
        message: 'Number of cameras not specified, defaulting to 1',
        severity: 'warning'
      })
      recoveredData.numberOfCameras = 1
    } else {
      const parsed = parseInt(String(breadcrumbs.numberOfCameras), 10)
      if (isNaN(parsed) || parsed < 1) {
        errors.push({
          field: 'numberOfCameras',
          message: 'Number of cameras must be a positive number',
          severity: 'error'
        })
      } else {
        warnings.push({
          field: 'numberOfCameras',
          message: 'Number of cameras converted to integer',
          severity: 'warning'
        })
        recoveredData.numberOfCameras = parsed
      }
    }
  } else {
    if (breadcrumbs.numberOfCameras < 1) {
      errors.push({
        field: 'numberOfCameras',
        message: 'Number of cameras must be at least 1',
        severity: 'error'
      })
    } else {
      recoveredData.numberOfCameras = breadcrumbs.numberOfCameras
    }
  }

  // Validate files array
  if (breadcrumbs.files !== undefined) {
    if (!Array.isArray(breadcrumbs.files)) {
      warnings.push({
        field: 'files',
        message: 'Files should be an array, clearing invalid data',
        severity: 'warning'
      })
      recoveredData.files = []
    } else {
      const validFiles: FileInfo[] = []
      breadcrumbs.files.forEach((file, index) => {
        const validatedFile = validateFileInfo(file, index, warnings)
        if (validatedFile) {
          validFiles.push(validatedFile)
        }
      })
      recoveredData.files = validFiles
    }
  }

  // Validate timestamps
  const validateTimestamp = (field: string, value: unknown) => {
    if (typeof value === 'string') {
      try {
        const date = new Date(value)
        if (isNaN(date.getTime())) {
          warnings.push({
            field,
            message: `Invalid timestamp format, will use current time`,
            severity: 'warning'
          })
          return new Date().toISOString()
        }
        return value
      } catch {
        warnings.push({
          field,
          message: `Corrupted timestamp, will use current time`,
          severity: 'warning'
        })
        return new Date().toISOString()
      }
    }
    return undefined
  }

  if (breadcrumbs.creationDateTime) {
    recoveredData.creationDateTime =
      validateTimestamp('creationDateTime', breadcrumbs.creationDateTime) ||
      new Date().toISOString()
  }

  if (breadcrumbs.lastModified) {
    recoveredData.lastModified = validateTimestamp(
      'lastModified',
      breadcrumbs.lastModified
    )
  }

  // Validate string fields
  const validateString = (field: string, value: unknown) => {
    if (value !== undefined) {
      if (typeof value === 'string') {
        return value.trim() || undefined
      } else {
        warnings.push({
          field,
          message: `${field} should be a string`,
          severity: 'warning'
        })
        return String(value).trim() || undefined
      }
    }
    return undefined
  }

  recoveredData.parentFolder = validateString('parentFolder', breadcrumbs.parentFolder)
  recoveredData.createdBy = validateString('createdBy', breadcrumbs.createdBy)
  recoveredData.scannedBy = validateString('scannedBy', breadcrumbs.scannedBy)

  // Validate folder size
  if (breadcrumbs.folderSizeBytes !== undefined) {
    if (
      typeof breadcrumbs.folderSizeBytes === 'number' &&
      breadcrumbs.folderSizeBytes >= 0
    ) {
      recoveredData.folderSizeBytes = breadcrumbs.folderSizeBytes
    } else {
      warnings.push({
        field: 'folderSizeBytes',
        message: 'Invalid folder size, will be recalculated',
        severity: 'warning'
      })
      recoveredData.folderSizeBytes = undefined
    }
  }

  const isValid = errors.length === 0
  const canRecover = isValid || (errors.length === 0 && warnings.length > 0)

  return {
    isValid,
    errors,
    warnings,
    canRecover,
    recoveredData: canRecover ? (recoveredData as BreadcrumbsFile) : undefined
  }
}

/**
 * Attempt to recover corrupted breadcrumbs data
 */
export function recoverBreadcrumbs(
  corruptedData: unknown,
  projectPath: string
): BreadcrumbsFile {
  const validation = validateBreadcrumbs(corruptedData)

  if (validation.recoveredData && validation.canRecover) {
    return {
      projectTitle:
        validation.recoveredData.projectTitle || extractProjectNameFromPath(projectPath),
      numberOfCameras: validation.recoveredData.numberOfCameras || 1,
      files: validation.recoveredData.files || [],
      parentFolder:
        validation.recoveredData.parentFolder || extractParentFromPath(projectPath),
      createdBy: validation.recoveredData.createdBy || 'Unknown',
      creationDateTime:
        validation.recoveredData.creationDateTime || new Date().toISOString(),
      folderSizeBytes: validation.recoveredData.folderSizeBytes,
      lastModified: validation.recoveredData.lastModified,
      scannedBy: validation.recoveredData.scannedBy
    }
  }

  // Fallback: create minimal valid breadcrumbs
  return {
    projectTitle: extractProjectNameFromPath(projectPath),
    numberOfCameras: 1,
    files: [],
    parentFolder: extractParentFromPath(projectPath),
    createdBy: 'Baker (Recovered)',
    creationDateTime: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    scannedBy: 'Baker'
  }
}

/**
 * Extract project name from file path
 */
function extractProjectNameFromPath(path: string): string {
  const parts = path.split(/[/\\]/)
  return parts[parts.length - 1] || 'Unknown Project'
}

/**
 * Extract parent folder from file path
 */
function extractParentFromPath(path: string): string {
  const parts = path.split(/[/\\]/)
  return parts.slice(0, -1).join('/') || '/'
}

/**
 * Check if breadcrumbs data has known schema issues
 */
export function hasSchemaIssues(data: unknown): boolean {
  if (!data || typeof data !== 'object') return true

  const obj = data as Record<string, unknown>

  // Check for old schema without path field in files
  if (Array.isArray(obj.files)) {
    return obj.files.some((file: unknown) => {
      if (typeof file === 'object' && file !== null) {
        const fileObj = file as Record<string, unknown>
        return !fileObj.path || typeof fileObj.path !== 'string'
      }
      return true
    })
  }

  return false
}

/**
 * Get user-friendly error message for validation errors
 */
export function getErrorMessage(validation: ValidationResult): string {
  if (validation.isValid) return ''

  const criticalErrors = validation.errors.filter((e) => e.severity === 'error')

  if (criticalErrors.length === 1) {
    return criticalErrors[0].message
  } else if (criticalErrors.length > 1) {
    return `${criticalErrors.length} validation errors detected. The breadcrumbs file appears to be corrupted.`
  }

  return 'Unknown validation error'
}
