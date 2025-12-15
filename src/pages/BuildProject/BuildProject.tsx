import { useTrelloApiKeys } from '@hooks/useApiKeys'
import { useBuildProjectMachine } from '@hooks/useBuildProjectMachine'
import { useCreateProjectWithMachine } from '@hooks/useCreateProjectWithMachine'
import { usePostProjectCompletion } from '@hooks/usePostProjectCompletion'
import { createNamespacedLogger } from '@utils/logger'
import { useEffect, useMemo } from 'react'
import { toast } from 'sonner'

import { useBreadcrumb, useCameraAutoRemap, useProjectState, useUsername } from '@/hooks'

import { AddFootageStep } from './AddFootageStep'
import { CreateProjectStep } from './CreateProjectStep'
import ProgressBar from './ProgressBar'
import { ProjectConfigurationStep } from './ProjectConfigurationStep'
import { SuccessSection } from './SuccessSection'

const logger = createNamespacedLogger('BuildProject')

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

  // State machine
  const machine = useBuildProjectMachine()
  const {
    state,
    send,
    isShowingSuccess,
    isCreatingTemplate,
    isIdle,
    copyProgress,
    error,
    projectFolder
  } = machine

  // Use state machine's isShowingSuccess for displaying success section
  const showSuccess = isShowingSuccess

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

  // Handle post-completion tasks (premiere template + dialog)
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

    // Execute the project creation workflow
    // createProject will send events to the machine as it progresses
    createProject({
      title,
      files,
      selectedFolder,
      numCameras,
      username: username.data || 'Unknown User',
      send
    })
  }

  // Clears all fields and resets machine
  const clearFields = () => {
    clearAllFields()
    send({ type: 'RESET' })
  }

  // Show error toasts
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
