/**
 * useProjectFolders Hook
 * Purpose: Handle project folder structure creation
 */

import { createDirectory } from '../api'

interface FolderCreationResult {
  success: boolean
  error?: string
}

export function useProjectFolders() {
  /**
   * Create main project folder
   */
  const createMainFolder = async (projectFolder: string): Promise<void> => {
    await createDirectory(projectFolder, { recursive: true })
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
      await createDirectory(`${projectFolder}/Footage/Camera ${cam}`, { recursive: true })
    }
  }

  /**
   * Create support folders in parallel
   */
  const createSupportFolders = async (projectFolder: string): Promise<void> => {
    await Promise.all([
      createDirectory(`${projectFolder}/Graphics`, { recursive: true }),
      createDirectory(`${projectFolder}/Renders`, { recursive: true }),
      createDirectory(`${projectFolder}/Projects`, { recursive: true }),
      createDirectory(`${projectFolder}/Scripts`, { recursive: true })
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
