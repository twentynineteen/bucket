/**
 * useFileOperations Hook
 * Purpose: Handle file moving operations with progress tracking
 */

import { logger } from '@shared/utils/logger'

import type { FootageFile } from '../types'
import { moveFiles as apiMoveFiles, listenCopyComplete } from '../api'

interface MoveFilesWithProgressParams {
  files: FootageFile[]
  projectFolder: string
  setProgress?: (value: number) => void
  setCompleted?: (value: boolean) => void
  onComplete: () => Promise<void>
}

interface MoveFilesResult {
  success: boolean
  unlisten?: () => void
  error?: string
}

export function useFileOperations() {
  /**
   * Convert FootageFile[] to format expected by move_files command
   */
  const prepareFileList = (files: FootageFile[]): [string, number][] => {
    return files.map(({ file, camera }) => [file.path, camera])
  }

  /**
   * Setup event listener for copy_complete
   */
  const setupProgressListener = async (
    onComplete: () => Promise<void>
  ): Promise<() => void> => {
    const unlisten = await listenCopyComplete(async () => {
      try {
        await onComplete()
      } catch (error) {
        logger.error('Error in copy_complete handler:', error)
      } finally {
        unlisten()
      }
    })

    return unlisten
  }

  /**
   * Invoke move_files command
   */
  const moveFiles = async (
    files: FootageFile[],
    projectFolder: string
  ): Promise<void> => {
    const fileList = prepareFileList(files)

    await apiMoveFiles(fileList, projectFolder)
  }

  /**
   * Move files with progress tracking (complete flow)
   */
  const moveFilesWithProgress = async ({
    files,
    projectFolder,
    setProgress,
    setCompleted,
    onComplete
  }: MoveFilesWithProgressParams): Promise<MoveFilesResult> => {
    let unlistenFn: (() => void) | undefined

    try {
      // Initialize progress
      setProgress?.(0)
      setCompleted?.(false)

      // Setup event listener BEFORE moving files
      unlistenFn = await setupProgressListener(async () => {
        setCompleted?.(true)
        await onComplete()
      })

      // Move files
      await moveFiles(files, projectFolder)

      return {
        success: true,
        unlisten: unlistenFn
      }
    } catch (error) {
      // Cleanup listener on error
      if (unlistenFn) {
        unlistenFn()
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  return {
    prepareFileList,
    setupProgressListener,
    moveFiles,
    moveFilesWithProgress
  }
}
