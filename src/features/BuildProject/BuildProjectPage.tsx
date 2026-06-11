import { useTrelloApiKeys } from '@shared/hooks'
import { createNamespacedLogger } from '@shared/utils'
import { useEffect, useMemo, useRef } from 'react'
import { toast } from 'sonner'

import { useBreadcrumb, useUsername } from '@shared/hooks'

import { useBuildProject } from '@features/build-project'
import { Button } from '@shared/ui/button'

import { useCameraAutoRemap } from './hooks/useCameraAutoRemap'
import { useProjectState } from './hooks/useProjectState'
// `showConfirmationDialog` is the only piece of the legacy api.ts the page still
// needs (post-success "open project folder?" Finder prompt). It will move into
// `@features/build-project` itself in Phase 5, along with the legacy module's
// deletion.
import { showConfirmationDialog } from './api'

import { AddFootageStep } from './components/AddFootageStep'
import { CreateProjectStep } from './components/CreateProjectStep'
import ProgressBar from './components/ProgressBar'
import { ProjectConfigurationStep } from './components/ProjectConfigurationStep'
import { SuccessSection } from './components/SuccessSection'

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

  // Drive the BuildProject workflow via the throttled, cancellable hook from
  // @features/build-project. The new machine owns the entire pipeline including
  // Premiere template creation — there's no longer a separate
  // `usePostProjectCompletion` step to wire up at the page level.
  const { context, progress, startBuild, cancel, reset, isComplete, isBuilding } =
    useBuildProject()
  const { error, projectFolder } = context

  // Alias kept stable so child component prop contracts don't shift between
  // the legacy machine (isShowingSuccess) and the new one (isComplete).
  const showSuccess = isComplete

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

    // Map page-local state names to the new hook's input contract
    // (title → projectName, selectedFolder → destinationPath).
    startBuild({
      projectName: title,
      destinationPath: selectedFolder,
      files,
      numCameras,
      username: username.data || 'Unknown User'
    })
  }

  // Clear all fields and reset machine
  const clearFields = () => {
    clearAllFields()
    reset()
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

  // After the workflow reaches `success`, prompt to open the project folder in
  // Finder. The ref gates the dialog to fire exactly once per success cycle —
  // it resets when the user starts a new project (isComplete returns to false).
  const completionDialogShownRef = useRef(false)
  useEffect(() => {
    if (!isComplete) {
      completionDialogShownRef.current = false
      return
    }
    if (projectFolder && !completionDialogShownRef.current) {
      completionDialogShownRef.current = true
      showConfirmationDialog(
        'Do you want to open the project folder now?',
        'Transfer complete!',
        projectFolder
      ).catch((err) => logger.error('Completion dialog error:', err))
    }
  }, [isComplete, projectFolder])

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

          {/* Cancel button — only visible during an in-flight build.
              The new transfer path supports clean cancellation via the
              fileTransferActor's AbortSignal, so we surface it to the user. */}
          {isBuilding && (
            <div className="flex justify-end">
              <Button onClick={cancel} variant="destructive" size="sm">
                Cancel
              </Button>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="mt-4 px-6">
          <ProgressBar progress={progress.percentage} completed={isComplete} />
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
