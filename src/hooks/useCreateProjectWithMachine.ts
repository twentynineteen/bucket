// hooks/useCreateProjectWithMachine.ts

import type { BuildProjectEvent } from '@machines/buildProjectMachine'
import { appStore } from '@store/useAppStore'
import { invoke } from '@tauri-apps/api/core'
import { confirm } from '@tauri-apps/plugin-dialog'
import { exists, mkdir, remove, stat, writeTextFile } from '@tauri-apps/plugin-fs'
import { Breadcrumb } from '@utils/types'

import { logger } from '@/utils/logger'

import { FootageFile } from './useCameraAutoRemap'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

interface CreateProjectParams {
  title: string
  files: FootageFile[]
  selectedFolder: string
  numCameras: number
  username: string
  send: (event: BuildProjectEvent) => void
}

export function useCreateProjectWithMachine() {
  const createProject = async ({
    title,
    files,
    selectedFolder,
    numCameras,
    username,
    send
  }: CreateProjectParams) => {
    // Step 1: Validate inputs
    if (!selectedFolder) {
      send({ type: 'VALIDATION_ERROR', error: 'Please select a destination folder.' })
      return
    }

    if (!title.trim()) {
      send({ type: 'VALIDATION_ERROR', error: 'Please enter a project title.' })
      return
    }

    if (files.length === 0) {
      const confirmNoFiles = await confirm(
        'No files have been added to the drag and drop section. Are you sure you want to create the project?'
      )
      if (!confirmNoFiles) {
        send({ type: 'VALIDATION_ERROR', error: 'Project creation cancelled' })
        return
      }
    }

    const projectFolder = `${selectedFolder}/${title.trim()}`

    if (await exists(projectFolder)) {
      const overwrite = await confirm(
        `The folder "${projectFolder}" already exists. Do you want to overwrite it?`
      )
      if (!overwrite) {
        send({ type: 'VALIDATION_ERROR', error: 'Project creation cancelled' })
        return
      }
      await remove(projectFolder, { recursive: true })
    }

    // Validation passed
    send({ type: 'VALIDATION_SUCCESS', projectFolder })

    // Step 2: Create folder structure
    try {
      await mkdir(projectFolder, { recursive: true })

      for (let cam = 1; cam <= numCameras; cam++) {
        await mkdir(`${projectFolder}/Footage/Camera ${cam}`, { recursive: true })
      }

      await Promise.all([
        mkdir(`${projectFolder}/Graphics`, { recursive: true }),
        mkdir(`${projectFolder}/Renders`, { recursive: true }),
        mkdir(`${projectFolder}/Projects`, { recursive: true }),
        mkdir(`${projectFolder}/Scripts`, { recursive: true })
      ])

      send({ type: 'FOLDERS_CREATED' })
    } catch (mkdirError) {
      logger.error('Error creating folders:', mkdirError)
      send({ type: 'FOLDERS_ERROR', error: String(mkdirError) })
      return
    }

    // Step 3: Create and save breadcrumbs
    try {
      const now = new Date()
      const formattedDateTime = now.toISOString()

      let folderSizeBytes: number | undefined
      try {
        folderSizeBytes = await invoke<number>('get_folder_size', {
          folderPath: projectFolder
        })
      } catch (error) {
        logger.warn('Failed to calculate folder size:', error)
        folderSizeBytes = undefined
      }

      const projectData: Breadcrumb = {
        projectTitle: title.trim(),
        numberOfCameras: numCameras,
        files: files.map((f) => ({
          camera: f.camera,
          name: f.file.name,
          path: f.file.path
        })),
        parentFolder: selectedFolder,
        createdBy: username || 'Unknown User',
        creationDateTime: formattedDateTime,
        folderSizeBytes
      }

      appStore.getState().setBreadcrumbs(projectData)

      await writeTextFile(
        `${projectFolder}/breadcrumbs.json`,
        JSON.stringify(projectData, null, 2)
      )

      send({ type: 'BREADCRUMBS_SAVED' })

      // Step 4: Move files
      const filesToMove: [string, number][] = files.map(({ file, camera }) => [
        file.path,
        camera
      ])

      // Calculate total size of files to copy
      let totalBytes = 0
      try {
        const fileSizes = await Promise.all(
          files.map(async ({ file }) => {
            const metadata = await stat(file.path)
            return metadata.size
          })
        )
        totalBytes = fileSizes.reduce((sum, size) => sum + size, 0)
      } catch (sizeError) {
        logger.warn('Failed to calculate total file size:', sizeError)
        // Continue anyway - the copy will fail if there's not enough space
      }

      // Check disk space before starting copy
      if (totalBytes > 0) {
        try {
          const hasSpace = await invoke<boolean>('check_disk_space', {
            path: projectFolder,
            requiredBytes: totalBytes
          })

          if (!hasSpace) {
            send({
              type: 'COPY_ERROR',
              error: `Insufficient disk space. Need ${formatBytes(totalBytes)} to copy files.`
            })
            return
          }
        } catch (spaceError) {
          logger.warn('Failed to check disk space:', spaceError)
          // Continue anyway - better to try and fail than to block on a check error
        }
      }

      try {
        if (import.meta.env.DEV) {
          logger.log(
            'Starting move_files, expecting copy_progress and copy_complete events...'
          )
        }
        // This will trigger copy_progress and copy_complete events
        // which are listened to by useBuildProjectMachine
        await invoke('move_files', {
          files: filesToMove,
          baseDest: projectFolder
        })
        if (import.meta.env.DEV) {
          logger.log('move_files invoke completed')
        }
      } catch (moveError) {
        logger.error('Error moving files:', moveError)
        send({ type: 'COPY_ERROR', error: String(moveError) })
        return
      }
    } catch (error) {
      logger.error('Error creating breadcrumbs:', error)
      send({ type: 'BREADCRUMBS_ERROR', error: String(error) })
      return
    }
  }

  return { createProject }
}
