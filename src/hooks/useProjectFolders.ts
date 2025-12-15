/**
 * useProjectFolders Hook
 * Purpose: Handle project folder structure creation
 *
 * Responsibilities:
 * - Create main project folder
 * - Create camera folders (1 to numCameras)
 * - Create support folders (Graphics, Renders, Projects, Scripts)
 * - Handle errors during folder creation
 *
 * Complexity: Low (< 5)
 * Lines: ~80
 */

import { mkdir } from '@tauri-apps/plugin-fs'

interface FolderCreationResult {
  success: boolean
  error?: string
}

export function useProjectFolders() {
  /**
   * Create main project folder
   */
  const createMainFolder = async (projectFolder: string): Promise<void> => {
    await mkdir(projectFolder, { recursive: true })
  }

  /**
   * Create camera folders (1 to numCameras)
   */
  const createCameraFolders = async (
    projectFolder: string,
    numCameras: number
  ): Promise<void> => {
    if (numCameras <= 0) return

    for (let cam = 1; cam <= numCameras; cam++) {
      await mkdir(`${projectFolder}/Footage/Camera ${cam}`, { recursive: true })
    }
  }

  /**
   * Create support folders in parallel
   */
  const createSupportFolders = async (projectFolder: string): Promise<void> => {
    await Promise.all([
      mkdir(`${projectFolder}/Graphics`, { recursive: true }),
      mkdir(`${projectFolder}/Renders`, { recursive: true }),
      mkdir(`${projectFolder}/Projects`, { recursive: true }),
      mkdir(`${projectFolder}/Scripts`, { recursive: true })
    ])
  }

  /**
   * Create complete folder structure
   */
  const createFolderStructure = async (
    projectFolder: string,
    numCameras: number
  ): Promise<FolderCreationResult> => {
    try {
      // Create main folder
      await createMainFolder(projectFolder)

      // Create camera folders sequentially
      await createCameraFolders(projectFolder, numCameras)

      // Create support folders in parallel
      await createSupportFolders(projectFolder)

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  return {
    createMainFolder,
    createCameraFolders,
    createSupportFolders,
    createFolderStructure
  }
}
