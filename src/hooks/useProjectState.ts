import { PROJECT_LIMITS } from '@constants/project'
import { createNamespacedLogger } from '@utils/logger'
import { useCallback, useMemo, useState } from 'react'

import { FootageFile } from './useCameraAutoRemap'
import { selectFiles } from './useFileSelector'

const logger = createNamespacedLogger('useProjectState')

/**
 * Manages the core state and business logic for the BuildProject workflow
 * Encapsulates all project configuration state, file management, and user actions
 */
export function useProjectState() {
  const [title, setTitle] = useState('')
  const [numCameras, setNumCameras] = useState(PROJECT_LIMITS.DEFAULT_CAMERAS)
  const [files, setFiles] = useState<FootageFile[]>([])
  const [selectedFolder, setSelectedFolder] = useState<string>('')
  const [titleSanitized, setTitleSanitized] = useState(false)

  // Sanitize title to prevent folder creation from forward slashes and other OS-unsafe characters
  const sanitizeTitle = useCallback((input: string): string => {
    // Only replace OS-unsafe characters, preserve spaces as-is
    return input.replace(/[/\\:*?"<>|]/g, '-')
  }, [])

  // Handle title change with sanitization
  const handleTitleChange = useCallback(
    (newTitle: string) => {
      const sanitized = sanitizeTitle(newTitle)
      const wasSanitized = sanitized !== newTitle
      setTitle(sanitized)
      setTitleSanitized(wasSanitized)
    },
    [sanitizeTitle]
  )

  // Select and add files to the project
  const handleSelectFiles = useCallback(async () => {
    const newFiles = await selectFiles()
    setFiles((prev) => [...prev, ...newFiles])
  }, [])

  // Logic to mark a given file with the camera number
  const updateFileCamera = useCallback(
    (index: number, camera: number) => {
      // Validate camera number is within valid range
      if (camera < PROJECT_LIMITS.MIN_CAMERAS || camera > numCameras) {
        logger.warn(
          `Invalid camera number ${camera}. Must be between ${PROJECT_LIMITS.MIN_CAMERAS} and ${numCameras}`
        )
        return
      }

      setFiles((currentFiles) => {
        const updatedFiles = currentFiles.map((item, idx) =>
          idx === index ? { ...item, camera } : item
        )
        return updatedFiles
      })
    },
    [numCameras]
  )

  // Removes the selected file from the folder tree
  const handleDeleteFile = useCallback((index: number) => {
    setFiles((prevFiles) => {
      const updatedFiles = prevFiles.filter((_, idx) => idx !== index)
      if (import.meta.env.DEV) {
        logger.log('Updated files:', updatedFiles)
      }
      return updatedFiles
    })
  }, [])

  // Clears all the fields to their initial state (does NOT reset completion state)
  const clearAllFields = useCallback(() => {
    setTitle('')
    setNumCameras(PROJECT_LIMITS.DEFAULT_CAMERAS)
    setFiles([])
    setSelectedFolder('')
    setTitleSanitized(false)
  }, [])

  return useMemo(
    () => ({
      // State
      title,
      numCameras,
      files,
      selectedFolder,
      titleSanitized,
      // Setters (for direct updates)
      setNumCameras,
      setSelectedFolder,
      setFiles, // Exposed for useCameraAutoRemap
      // Handlers (with business logic)
      handleTitleChange,
      handleSelectFiles,
      updateFileCamera,
      handleDeleteFile,
      clearAllFields
    }),
    [
      title,
      numCameras,
      files,
      selectedFolder,
      titleSanitized,
      handleTitleChange,
      handleSelectFiles,
      updateFileCamera,
      handleDeleteFile,
      clearAllFields
    ]
  )
}
