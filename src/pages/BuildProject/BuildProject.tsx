import { useTrelloApiKeys } from '@hooks/useApiKeys'
import { invoke } from '@tauri-apps/api/core'
import { createNamespacedLogger } from '@utils/logger'
import { useEffect, useMemo, useRef } from 'react'
import { toast } from 'sonner'

import { useBuildProject } from '@/features/build-project/hooks'
import { useBreadcrumb, useCameraAutoRemap, useProjectState, useUsername } from '@/hooks'
import { logger } from '@/utils/logger'

import { AddFootageStep } from './AddFootageStep'
import { CreateProjectStep } from './CreateProjectStep'
import ProgressBar from './ProgressBar'
import { ProjectConfigurationStep } from './ProjectConfigurationStep'
import { SuccessSection } from './SuccessSection'

const componentLogger = createNamespacedLogger('BuildProject')

// The BuildProject component is used for uploading footage from camera cards
// Footage can be marked with the relevant camera in order to place in the correct folder.

const BuildProject: React.FC = () => {
  // Project state and business logic
  const {
    title,
    numCameras,
    files,
    selectedFolder,
    titleSanitized,
    setNumCameras,
    setSelectedFolder,
    setFiles,
    handleTitleChange,
    handleSelectFiles,
    updateFileCamera,
    handleDeleteFile,
    clearAllFields
  } = useProjectState()

  // New modular state machine
  const {
    context,
    progress,
    startBuild,
    reset,
    isBuilding,
    isComplete,
    hasError,
    isIdle
  } = useBuildProject()

  // Derive showSuccess from machine state
  const showSuccess = isComplete

  // Track if dialog has been shown for current success
  const dialogShown = useRef(false)

  // Page label - shadcn breadcrumb component (memoized to prevent infinite re-renders)
  const breadcrumbItems = useMemo(
    () => [
      { label: 'Ingest footage', href: '/ingest/build' },
      { label: 'Build a project' }
    ],
    []
  )
  useBreadcrumb(breadcrumbItems)

  const username = useUsername()
  const { apiKey, apiToken } = useTrelloApiKeys()

  // Auto-remap camera assignments when numCameras changes
  useCameraAutoRemap(files, numCameras, setFiles)

  // Show confirmation dialog when build completes successfully
  useEffect(() => {
    if (!isComplete || dialogShown.current || !context.projectFolder) return

    dialogShown.current = true

    const showDialog = async () => {
      try {
        await invoke('show_confirmation_dialog', {
          message: 'Do you want to open the project folder now?',
          title: 'Transfer complete!',
          destination: context.projectFolder
        })

        if (import.meta.env.DEV) {
          logger.log('Dialog completed')
        }
      } catch (error) {
        logger.error('Error showing dialog:', error)
        // Dialog errors are non-critical, just log them
      }
    }

    showDialog()
  }, [isComplete, context.projectFolder])

  // Reset dialog flag when machine returns to idle state
  useEffect(() => {
    if (isIdle) {
      dialogShown.current = false
    }
  }, [isIdle])

  const handleCreateProject = () => {
    if (import.meta.env.DEV) {
      componentLogger.log('Create Project clicked!')
      componentLogger.log('Parameters:', {
        title,
        files: files.length,
        selectedFolder,
        numCameras
      })
    }

    // Execute the project creation workflow using new modular architecture
    startBuild({
      projectName: title,
      destinationPath: selectedFolder,
      files: files.map((f) => ({
        file: { path: f.file.path, name: f.file.name },
        camera: f.camera
      })),
      numCameras,
      username: username.data || 'Unknown User'
    })
  }

  // Clears all fields and resets machine
  const clearFields = () => {
    clearAllFields()
    reset()
  }

  // Show error toasts
  useEffect(() => {
    if (hasError && context.error) {
      toast.error(context.error, {
        duration: 5000,
        description: 'Please try again or contact support if the issue persists.'
      })
    }
  }, [hasError, context.error])

  return (
    <div className="h-full w-full overflow-x-hidden overflow-y-auto">
      {/* Project Configuration & File Explorer */}
      <div className="w-full max-w-full pb-4">
        {/* Header */}
        <div className="border-border bg-card/50 border-b px-6 py-4">
          <h1 className="text-foreground text-2xl font-bold">Build a Project</h1>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Configure project settings, select footage files, and create organized folder
            structures
          </p>
        </div>

        <div className="max-w-full space-y-4 px-6 py-4">
          {/* Step 1: Project Configuration */}
          <ProjectConfigurationStep
            showSuccess={showSuccess}
            title={title}
            onTitleChange={handleTitleChange}
            numCameras={numCameras}
            onNumCamerasChange={setNumCameras}
            titleSanitized={titleSanitized}
            selectedFolder={selectedFolder}
            onSelectFolder={setSelectedFolder}
          />

          {/* Step 2: Add Files */}
          <AddFootageStep
            showSuccess={showSuccess}
            files={files}
            numCameras={numCameras}
            onSelectFiles={handleSelectFiles}
            onUpdateCamera={updateFileCamera}
            onDeleteFile={handleDeleteFile}
            onClearAll={clearFields}
          />

          {/* Step 3: Create Project */}
          <CreateProjectStep
            showSuccess={showSuccess}
            title={title}
            selectedFolder={selectedFolder}
            onCreateProject={handleCreateProject}
            isLoading={isBuilding}
          />
        </div>

        {/* Progress Bar */}
        <div className="mt-4 px-6">
          <ProgressBar progress={progress.percentage} completed={isComplete} />
        </div>

        {/* Success Message & Post-completion Actions */}
        <SuccessSection
          showSuccess={showSuccess}
          selectedFolder={context.projectFolder || selectedFolder}
          title={title}
          trelloApiKey={apiKey}
          trelloApiToken={apiToken}
          onStartNew={clearFields}
        />
      </div>
    </div>
  )
}

export default BuildProject
