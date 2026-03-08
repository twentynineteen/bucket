import { useTrelloApiKeys } from '@shared/hooks'
import { useBuildProjectMachine } from '@hooks/useBuildProjectMachine'
import { useCreateProjectWithMachine } from '@hooks/useCreateProjectWithMachine'
import { usePostProjectCompletion } from '@hooks/usePostProjectCompletion'
import { createNamespacedLogger } from '@shared/utils/logger'
import { useEffect, useMemo } from 'react'
import { toast } from 'sonner'

import { useBreadcrumb, useUsername } from '@shared/hooks'
import { useCameraAutoRemap, useProjectState } from '@/hooks'

import { AddFootageStep } from './AddFootageStep'
import { CreateProjectStep } from './CreateProjectStep'
import ProgressBar from './ProgressBar'
import { ProjectConfigurationStep } from './ProjectConfigurationStep'
import { SuccessSection } from './SuccessSection'

const logger = createNamespacedLogger('BuildProject')

// Upload footage from camera cards and assign each file to the correct camera folder

const BuildProject: React.FC = () => {
  // Manage project state and business logic
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

  // Track workflow state via state machine
  const machine = useBuildProjectMachine()
  const {
    state,
    send,
    isShowingSuccess,
    isCreatingTemplate,
    isIdle,
    isLoading,
    copyProgress,
    error,
    projectFolder
  } = machine

  // Derive success visibility from state machine
  const showSuccess = isShowingSuccess

  // Set breadcrumb navigation (memoized to prevent infinite re-renders)
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

  // Run post-completion tasks (Premiere template + dialog)
  usePostProjectCompletion({
    isCreatingTemplate,
    isShowingSuccess,
    projectFolder,
    projectTitle: title,
    send,
    isIdle
  })

  const { createProject } = useCreateProjectWithMachine()

  const handleCreateProject = () => {
    if (import.meta.env.DEV) {
      logger.log('Create Project clicked!')
      logger.log('Parameters:', {
        title,
        files: files.length,
        selectedFolder,
        numCameras
      })
    }

    // Execute project creation workflow (sends events to the machine as it progresses)
    createProject({
      title,
      files,
      selectedFolder,
      numCameras,
      username: username.data || 'Unknown User',
      send
    })
  }

  // Clear all fields and reset machine
  const clearFields = () => {
    clearAllFields()
    send({ type: 'RESET' })
  }

  // Display error toasts when errors occur
  useEffect(() => {
    if (error) {
      toast.error(error, {
        duration: 5000,
        description: 'Please try again or contact support if the issue persists.'
      })
    }
  }, [error])

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
            isLoading={isLoading}
          />
        </div>

        {/* Progress Bar */}
        <div className="mt-4 px-6">
          <ProgressBar
            progress={copyProgress}
            completed={state.matches('showingSuccess') || state.matches('completed')}
          />
        </div>

        {/* Success Message & Post-completion Actions */}
        <SuccessSection
          showSuccess={showSuccess}
          selectedFolder={projectFolder || selectedFolder}
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
