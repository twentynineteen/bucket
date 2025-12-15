/**
 * useProjectBreadcrumbs Hook
 * Purpose: Handle breadcrumbs generation and storage
 *
 * Responsibilities:
 * - Calculate folder size
 * - Create breadcrumbs data structure
 * - Write breadcrumbs.json file
 * - Update app store with breadcrumbs data
 *
 * Complexity: Low (< 5)
 * Lines: ~110
 */

import { appStore } from '@store/useAppStore'
import { invoke } from '@tauri-apps/api/core'
import { writeTextFile } from '@tauri-apps/plugin-fs'
import { Breadcrumb } from '@utils/types'

import { logger } from '@/utils/logger'

import { FootageFile } from './useCameraAutoRemap'

interface CreateBreadcrumbsParams {
  title: string
  numCameras: number
  files: FootageFile[]
  parentFolder: string
  username: string
  folderSizeBytes?: number
}

interface CreateAndSaveParams extends CreateBreadcrumbsParams {
  projectFolder: string
}

interface BreadcrumbsResult {
  success: boolean
  breadcrumbs?: Breadcrumb
  error?: string
}

export function useProjectBreadcrumbs() {
  /**
   * Calculate folder size (returns undefined on error)
   */
  const calculateFolderSize = async (folderPath: string): Promise<number | undefined> => {
    try {
      const size = await invoke<number>('get_folder_size', { folderPath })
      return size
    } catch (error) {
      logger.warn('Failed to calculate folder size:', error)
      return undefined
    }
  }

  /**
   * Create breadcrumbs data structure
   */
  const createBreadcrumbsData = async ({
    title,
    numCameras,
    files,
    parentFolder,
    username,
    folderSizeBytes
  }: CreateBreadcrumbsParams): Promise<Breadcrumb> => {
    const now = new Date()
    const formattedDateTime = now.toISOString()

    const breadcrumbs: Breadcrumb = {
      projectTitle: title,
      numberOfCameras: numCameras,
      files: files.map((f) => ({
        camera: f.camera,
        name: f.file.name,
        path: f.file.path
      })),
      parentFolder,
      createdBy: username || 'Unknown User',
      creationDateTime: formattedDateTime,
      folderSizeBytes
    }

    return breadcrumbs
  }

  /**
   * Write breadcrumbs to file
   */
  const writeBreadcrumbsFile = async (
    projectFolder: string,
    breadcrumbs: Breadcrumb
  ): Promise<void> => {
    const filePath = `${projectFolder}/breadcrumbs.json`
    const content = JSON.stringify(breadcrumbs, null, 2)
    await writeTextFile(filePath, content)
  }

  /**
   * Update app store with breadcrumbs
   */
  const updateAppStore = (breadcrumbs: Breadcrumb): void => {
    appStore.getState().setBreadcrumbs(breadcrumbs)
  }

  /**
   * Complete flow: calculate size, create data, write file, update store
   */
  const createAndSaveBreadcrumbs = async ({
    projectFolder,
    title,
    numCameras,
    files,
    parentFolder,
    username
  }: CreateAndSaveParams): Promise<BreadcrumbsResult> => {
    try {
      // Calculate folder size (non-blocking if fails)
      const folderSizeBytes = await calculateFolderSize(projectFolder)

      // Create breadcrumbs data
      const breadcrumbs = await createBreadcrumbsData({
        title,
        numCameras,
        files,
        parentFolder,
        username,
        folderSizeBytes
      })

      // Write to file
      await writeBreadcrumbsFile(projectFolder, breadcrumbs)

      // Update app store
      updateAppStore(breadcrumbs)

      return {
        success: true,
        breadcrumbs
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  return {
    calculateFolderSize,
    createBreadcrumbsData,
    writeBreadcrumbsFile,
    updateAppStore,
    createAndSaveBreadcrumbs
  }
}
