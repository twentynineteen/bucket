/**
 * useCreateProject Hook (Refactored)
 * Purpose: Orchestrate the complete project creation workflow
 *
 * This is a REFACTORED version that composes focused, single-responsibility hooks:
 * - useProjectValidation: Input validation and folder existence checks
 * - useProjectFolders: Folder structure creation
 * - useProjectBreadcrumbs: Breadcrumbs generation and storage
 * - useFileOperations: File moving with progress tracking
 * - usePremiereIntegration: Premiere template and post-completion actions
 *
 * Complexity: Low (< 10) - orchestration only, no business logic
 * Lines: ~110
 */

import { FootageFile } from './useCameraAutoRemap'
import { useFileOperations } from './useFileOperations'
import { usePremiereIntegration } from './usePremiereIntegration'
import { useProjectBreadcrumbs } from './useProjectBreadcrumbs'
import { useProjectFolders } from './useProjectFolders'
import { useProjectValidation } from './useProjectValidation'

interface CreateProjectParams {
  title: string
  files: FootageFile[]
  selectedFolder: string
  numCameras: number
  username: string
  setProgress?: (value: number) => void
  setCompleted?: (value: boolean) => void
  setMessage: (value: string) => void
  setLoading: (value: boolean) => void
}

export function useCreateProject() {
  // Initialize all sub-hooks
  const validation = useProjectValidation()
  const folders = useProjectFolders()
  const breadcrumbs = useProjectBreadcrumbs()
  const fileOps = useFileOperations()
  const premiere = usePremiereIntegration()

  const createProject = async (params: CreateProjectParams) => {
    const {
      title,
      files,
      selectedFolder,
      numCameras,
      username,
      setProgress,
      setCompleted,
      setMessage,
      setLoading
    } = params

    // Step 1: Validate all inputs
    const validationResult = await validation.validateAll({
      title,
      selectedFolder,
      files
    })

    if (!validationResult.isValid) {
      if (validationResult.error) {
        alert(validationResult.error)
      }
      return
    }

    const { trimmedTitle, projectFolder } = validationResult
    if (!trimmedTitle || !projectFolder) return

    // Step 2: Create folder structure
    const folderResult = await folders.createFolderStructure(projectFolder, numCameras)

    if (!folderResult.success) {
      alert('Error creating project: ' + folderResult.error)
      return
    }

    // Step 3: Create and save breadcrumbs
    const breadcrumbsResult = await breadcrumbs.createAndSaveBreadcrumbs({
      projectFolder,
      title: trimmedTitle,
      numCameras,
      files,
      parentFolder: selectedFolder,
      username
    })

    if (!breadcrumbsResult.success) {
      alert('Error creating breadcrumbs: ' + breadcrumbsResult.error)
      return
    }

    // Step 4: Move files with progress tracking
    const moveResult = await fileOps.moveFilesWithProgress({
      files,
      projectFolder,
      setProgress,
      setCompleted,
      onComplete: async () => {
        // Step 5: Handle post-completion (Premiere template + dialog)
        await premiere.handlePostCompletion({
          projectFolder,
          projectTitle: trimmedTitle,
          setLoading,
          setMessage
        })
      }
    })

    if (!moveResult.success) {
      alert('Error creating project: ' + moveResult.error)
      // Cleanup listener if it was created
      if (moveResult.unlisten) {
        moveResult.unlisten()
      }
      return
    }
  }

  return { createProject }
}
