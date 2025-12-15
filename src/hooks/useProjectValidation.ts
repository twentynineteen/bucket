/**
 * useProjectValidation Hook
 * Purpose: Handle all validation logic for project creation
 *
 * Responsibilities:
 * - Validate folder selection
 * - Validate project title
 * - Confirm when no files added
 * - Check folder existence and handle overwrite
 *
 * Complexity: Low (< 5)
 * Lines: ~100
 */

import { confirm } from '@tauri-apps/plugin-dialog'
import { exists, remove } from '@tauri-apps/plugin-fs'

import { FootageFile } from './useCameraAutoRemap'

interface ValidationResult {
  isValid: boolean
  error?: string
  userCancelled?: boolean
  trimmedTitle?: string
  projectFolder?: string
  folderExists?: boolean
}

interface FolderExistsResult {
  exists: boolean
  shouldProceed: boolean
  shouldRemove?: boolean
  error?: string
}

interface ValidateAllParams {
  title: string
  selectedFolder: string
  files: FootageFile[]
}

export function useProjectValidation() {
  /**
   * Validate folder selection
   */
  const validateFolder = async (selectedFolder: string): Promise<ValidationResult> => {
    if (!selectedFolder) {
      return {
        isValid: false,
        error: 'Please select a destination folder.'
      }
    }

    return { isValid: true }
  }

  /**
   * Validate project title
   */
  const validateTitle = async (title: string): Promise<ValidationResult> => {
    const trimmed = title.trim()

    if (!trimmed) {
      return {
        isValid: false,
        error: 'Please enter a project title.'
      }
    }

    return {
      isValid: true,
      trimmedTitle: trimmed
    }
  }

  /**
   * Validate files (confirm if empty)
   */
  const validateFiles = async (files: FootageFile[]): Promise<ValidationResult> => {
    if (files.length === 0) {
      const confirmNoFiles = await confirm(
        'No files have been added to the drag and drop section. Are you sure you want to create the project?'
      )

      if (!confirmNoFiles) {
        return {
          isValid: false,
          userCancelled: true
        }
      }

      return {
        isValid: true,
        userCancelled: false
      }
    }

    return { isValid: true, userCancelled: false }
  }

  /**
   * Check if folder exists and handle overwrite confirmation
   */
  const checkFolderExists = async (
    projectFolder: string
  ): Promise<FolderExistsResult> => {
    try {
      const folderExists = await exists(projectFolder)

      if (!folderExists) {
        return {
          exists: false,
          shouldProceed: true
        }
      }

      const overwrite = await confirm(
        `The folder "${projectFolder}" already exists. Do you want to overwrite it?`
      )

      return {
        exists: true,
        shouldProceed: overwrite,
        shouldRemove: overwrite
      }
    } catch (error) {
      return {
        exists: false,
        shouldProceed: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * Remove existing folder
   */
  const removeExistingFolder = async (projectFolder: string): Promise<void> => {
    await remove(projectFolder, { recursive: true })
  }

  /**
   * Validate all inputs at once
   */
  const validateAll = async ({
    title,
    selectedFolder,
    files
  }: ValidateAllParams): Promise<ValidationResult> => {
    // Validate folder
    const folderValidation = await validateFolder(selectedFolder)
    if (!folderValidation.isValid) {
      return folderValidation
    }

    // Validate title
    const titleValidation = await validateTitle(title)
    if (!titleValidation.isValid) {
      return titleValidation
    }

    const trimmedTitle = titleValidation.trimmedTitle!
    const projectFolder = `${selectedFolder}/${trimmedTitle}`

    // Validate files
    const filesValidation = await validateFiles(files)
    if (!filesValidation.isValid) {
      return filesValidation
    }

    // Check folder existence
    const folderCheck = await checkFolderExists(projectFolder)
    if (folderCheck.error) {
      return {
        isValid: false,
        error: folderCheck.error
      }
    }

    if (!folderCheck.shouldProceed) {
      return {
        isValid: false,
        userCancelled: true
      }
    }

    // Remove existing folder if needed
    if (folderCheck.shouldRemove) {
      try {
        await removeExistingFolder(projectFolder)
      } catch (error) {
        return {
          isValid: false,
          error:
            error instanceof Error
              ? `Failed to remove existing folder: ${error.message}`
              : 'Failed to remove existing folder'
        }
      }
    }

    return {
      isValid: true,
      trimmedTitle,
      projectFolder,
      folderExists: folderCheck.exists
    }
  }

  return {
    validateFolder,
    validateTitle,
    validateFiles,
    checkFolderExists,
    removeExistingFolder,
    validateAll
  }
}
