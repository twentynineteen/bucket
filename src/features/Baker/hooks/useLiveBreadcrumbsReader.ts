/**
 * useLiveBreadcrumbsReader Hook
 *
 * Enhanced breadcrumbs reader that shows current file system state
 * instead of stale cached breadcrumbs data.
 */

import { useCallback, useState } from 'react'

import {
  bakerReadBreadcrumbs,
  bakerReadRawBreadcrumbs,
  bakerScanCurrentFiles
} from '../api'
import type { BreadcrumbsFile, FileInfo } from '../types'
import { logger } from '@shared/utils'

// Constants
const RAW_CONTENT_PREVIEW_LIMIT = 200

/**
 * Camera count as observed on disk. 0 is a legitimate value (podcast/audio-only
 * projects) and must never be clamped up — when no files exist the fallback
 * (usually the recorded numberOfCameras) is used instead.
 */
const liveCameraCount = (files: FileInfo[], fallback: number): number =>
  files.length > 0 ? Math.max(...files.map((f) => f.camera)) : fallback

interface UseLiveBreadcrumbsReaderResult {
  breadcrumbs: BreadcrumbsFile | null
  isLoading: boolean
  error: string | null
  readLiveBreadcrumbs: (projectPath: string) => Promise<void>
  clearBreadcrumbs: () => void
}

export function useLiveBreadcrumbsReader(): UseLiveBreadcrumbsReaderResult {
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbsFile | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const readLiveBreadcrumbs = useCallback(async (projectPath: string) => {
    setIsLoading(true)
    setError(null)

    try {
      // Read existing breadcrumbs file for metadata
      let existingBreadcrumbs: BreadcrumbsFile | null = null
      try {
        existingBreadcrumbs = await bakerReadBreadcrumbs(projectPath)
      } catch (breadcrumbsError) {
        logger.warn(
          `Failed to read existing breadcrumbs for ${projectPath}:`,
          breadcrumbsError
        )
        // Continue without existing breadcrumbs - will create from file system
      }

      // Get actual current files from file system
      let actualFiles: FileInfo[] = []
      try {
        actualFiles = await bakerScanCurrentFiles(projectPath)
      } catch (scanError) {
        logger.warn(
          `Failed to scan current files for ${projectPath}, using cached data:`,
          scanError
        )
        // Fall back to existing breadcrumbs files if file system scan fails
        if (existingBreadcrumbs?.files) {
          actualFiles = existingBreadcrumbs.files
        }
      }

      if (existingBreadcrumbs) {
        // Create hybrid breadcrumbs with live file data
        const liveBreadcrumbs: BreadcrumbsFile = {
          ...existingBreadcrumbs,
          files: actualFiles,
          numberOfCameras: liveCameraCount(
            actualFiles,
            existingBreadcrumbs.numberOfCameras
          )
        }
        setBreadcrumbs(liveBreadcrumbs)
      } else if (actualFiles.length > 0) {
        // Create minimal breadcrumbs from file system data only
        const projectName = projectPath.split('/').pop() || 'Unknown Project'
        const liveBreadcrumbs: BreadcrumbsFile = {
          projectTitle: projectName,
          numberOfCameras: liveCameraCount(actualFiles, 0),
          files: actualFiles,
          parentFolder: projectPath.split('/').slice(0, -1).join('/'),
          createdBy: 'Unknown',
          creationDateTime: new Date().toISOString()
        }
        setBreadcrumbs(liveBreadcrumbs)
      } else {
        setBreadcrumbs(null)
        setError('No breadcrumbs file found and no files detected in project')
      }
    } catch (err) {
      // Check if we have an invalid breadcrumbs file that we can show raw content for
      try {
        const rawContent = await bakerReadRawBreadcrumbs(projectPath)

        if (rawContent) {
          // We have a corrupted breadcrumbs file - try to get file system data as fallback
          let actualFiles: FileInfo[] = []
          try {
            actualFiles = await bakerScanCurrentFiles(projectPath)
          } catch {
            // Ignore file scan errors
          }

          const projectName = projectPath.split('/').pop() || 'Unknown Project'
          const fallbackBreadcrumbs: BreadcrumbsFile = {
            projectTitle: projectName,
            numberOfCameras: liveCameraCount(actualFiles, 0),
            files: actualFiles,
            parentFolder: projectPath.split('/').slice(0, -1).join('/'),
            createdBy: 'Baker (recovered from file system)',
            creationDateTime: new Date().toISOString()
          }

          setBreadcrumbs(fallbackBreadcrumbs)
          setError(
            `Warning: Breadcrumbs file is corrupted. Showing data recovered from file system. Raw content: ${rawContent.substring(0, RAW_CONTENT_PREVIEW_LIMIT)}${rawContent.length > RAW_CONTENT_PREVIEW_LIMIT ? '...' : ''}`
          )
          return
        }
      } catch {
        // Ignore raw content read errors - fallback to regular error handling
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to read project data'
        setError(errorMessage)
        setBreadcrumbs(null)
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  const clearBreadcrumbs = useCallback(() => {
    setBreadcrumbs(null)
    setError(null)
  }, [])

  return {
    breadcrumbs,
    isLoading,
    error,
    readLiveBreadcrumbs,
    clearBreadcrumbs
  }
}
