/**
 * Baker Page Component
 *
 * Main page for Baker folder scanning and breadcrumbs management functionality.
 * Refactored to separate concerns into focused components and hooks.
 */

import { BakerPreferences } from '@components/Baker/BakerPreferences'
import { BatchActions } from '@components/Baker/BatchActions'
import { FolderSelector } from '@components/Baker/FolderSelector'
import { PreviewProgress } from '@components/Baker/PreviewProgress'
import { ProjectDetailPanel } from '@components/Baker/ProjectDetailPanel'
import { ProjectListPanel } from '@components/Baker/ProjectListPanel'
import { ScanResults } from '@components/Baker/ScanResults'
import { BatchUpdateConfirmationDialog } from '@components/BatchUpdateConfirmationDialog'
import ErrorBoundary from '@components/ErrorBoundary'
import { Button } from '@components/ui/button'
import { useBakerPreferences } from '@hooks/useBakerPreferences'
import { useBakerScan } from '@hooks/useBakerScan'
import { useBakerTrelloIntegration } from '@hooks/useBakerTrelloIntegration'
import { useBreadcrumb } from '@hooks/useBreadcrumb'
import { useBreadcrumbsManager } from '@hooks/useBreadcrumbsManager'
import { useBreadcrumbsPreview } from '@hooks/useBreadcrumbsPreview'
import { useLiveBreadcrumbsReader } from '@hooks/useLiveBreadcrumbsReader'
import { AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react'
import React, { useCallback, useState } from 'react'

import { useTrelloBoard } from '@/hooks'
import { logger } from '@/utils/logger'

const BakerPageContent: React.FC = () => {
  // Set breadcrumbs for navigation
  useBreadcrumb([{ label: 'Ingest footage', href: '/ingest/build' }, { label: 'Baker' }])

  // Local state - simplified to essential page-level state
  const [selectedFolder, setSelectedFolder] = useState<string>('')
  const [selectedProjects, setSelectedProjects] = useState<string[]>([])
  const [showPreferences, setShowPreferences] = useState(false)
  const [selectedProject, setSelectedProject] = useState<string | null>(null)
  const [previewProject, setPreviewProject] = useState<string | null>(null)
  const [showBatchConfirmation, setShowBatchConfirmation] = useState(false)

  // Custom hooks - all business logic moved to hooks
  const { scanResult, isScanning, error, startScan, cancelScan, clearResults } =
    useBakerScan()
  const {
    updateBreadcrumbs,
    isUpdating,
    lastUpdateResult,
    clearResults: clearUpdateResults
  } = useBreadcrumbsManager()
  const { preferences, updatePreferences, resetToDefaults } = useBakerPreferences()
  const {
    breadcrumbs,
    isLoading: isLoadingBreadcrumbs,
    error: breadcrumbsError,
    readLiveBreadcrumbs,
    clearBreadcrumbs
  } = useLiveBreadcrumbsReader()
  const {
    generatePreview,
    generateBatchPreviews,
    clearPreviews,
    getPreview,
    previews,
    isGenerating
  } = useBreadcrumbsPreview()

  // Trello integration - now properly separated
  const boardId = '55a504d70bed2bd21008dc5a'
  const { apiKey, token } = useTrelloBoard(boardId)
  const { updateTrelloCards } = useBakerTrelloIntegration({ apiKey, token })

  // Event handlers - simplified to essential page-level coordination
  const handleStartScan = useCallback(async () => {
    if (!selectedFolder.trim()) {
      alert('Please select a folder to scan')
      return
    }

    try {
      await startScan(selectedFolder, {
        maxDepth: preferences.maxDepth,
        includeHidden: preferences.includeHidden,
        createMissing: preferences.createMissing,
        backupOriginals: preferences.backupOriginals
      })
    } catch (error) {
      logger.error('Failed to start scan:', error)
    }
  }, [selectedFolder, preferences, startScan])

  const handleClearResults = useCallback(() => {
    clearResults()
    clearUpdateResults()
    setSelectedProjects([])
    setSelectedProject(null)
    setPreviewProject(null)
    clearBreadcrumbs()
    clearPreviews()
  }, [clearResults, clearUpdateResults, clearBreadcrumbs, clearPreviews])

  const handleProjectSelection = useCallback(
    (projectPath: string, isSelected: boolean) => {
      setSelectedProjects((prev) => {
        if (isSelected) {
          return [...prev, projectPath]
        } else {
          return prev.filter((path) => path !== projectPath)
        }
      })
    },
    []
  )

  const handleSelectAll = useCallback(() => {
    if (scanResult?.projects) {
      setSelectedProjects(scanResult.projects.map((p) => p.path))
    }
  }, [scanResult])

  const handleClearSelection = useCallback(() => {
    setSelectedProjects([])
  }, [])

  const handleApplyChanges = useCallback(async () => {
    if (selectedProjects.length === 0) {
      alert('Please select projects to update')
      return
    }

    // Generate previews for selected projects before showing confirmation dialog
    if (scanResult?.projects) {
      const selectedProjectData = scanResult.projects.filter((p) =>
        selectedProjects.includes(p.path)
      )
      await generateBatchPreviews(selectedProjectData)
    }

    setShowBatchConfirmation(true)
  }, [selectedProjects, scanResult, generateBatchPreviews])

  const handleConfirmBatchUpdate = useCallback(async () => {
    try {
      // Update local breadcrumbs files first
      await updateBreadcrumbs(selectedProjects, {
        createMissing: preferences.createMissing,
        backupOriginals: preferences.backupOriginals
      })

      // Update Trello cards using extracted hook
      const trelloErrors = await updateTrelloCards(selectedProjects)

      // Clear selection and previews after update
      setSelectedProjects([])
      clearPreviews()
      setShowBatchConfirmation(false)

      // Show Trello errors if any occurred
      if (trelloErrors.length > 0) {
        const errorMessage =
          `Breadcrumbs updated successfully, but ${trelloErrors.length} Trello card update(s) failed:\n\n` +
          trelloErrors.map(({ project, error }) => `• ${project}: ${error}`).join('\n')
        alert(errorMessage)
      }
    } catch (error) {
      alert(`Failed to update breadcrumbs: ${error}`)
      setShowBatchConfirmation(false)
    }
  }, [selectedProjects, preferences, updateBreadcrumbs, updateTrelloCards, clearPreviews])

  const handleProjectClick = useCallback(
    async (projectPath: string) => {
      // Always select the project and load its breadcrumbs
      setSelectedProject(projectPath)
      await readLiveBreadcrumbs(projectPath)
    },
    [readLiveBreadcrumbs]
  )

  const handleTogglePreview = useCallback(
    async (projectPath: string) => {
      if (previewProject === projectPath) {
        setPreviewProject(null)
      } else {
        setPreviewProject(projectPath)
        const project = scanResult?.projects.find((p) => p.path === projectPath)
        if (project && !getPreview(projectPath)) {
          await generatePreview(projectPath, project)
        }
      }
    },
    [previewProject, scanResult, getPreview, generatePreview]
  )

  return (
    <div className="h-full w-full overflow-x-hidden overflow-y-auto">
      <div className="w-full max-w-full pb-4">
        {/* Header */}
        <div className="border-border bg-card/50 border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-foreground text-2xl font-bold">Baker</h1>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Scan directories for BuildProject folders and manage breadcrumbs files
              </p>
            </div>
            <BakerPreferences
              preferences={preferences}
              onUpdatePreferences={updatePreferences}
              onResetToDefaults={resetToDefaults}
              isOpen={showPreferences}
              onOpenChange={setShowPreferences}
            />
          </div>
        </div>

        <div className="max-w-full space-y-4 px-6 py-4">
          {/* Folder Selection */}
          <FolderSelector
            selectedFolder={selectedFolder}
            onFolderChange={setSelectedFolder}
            onStartScan={handleStartScan}
            onCancelScan={cancelScan}
            onClearResults={handleClearResults}
            isScanning={isScanning}
            hasResults={!!scanResult}
          />

          {/* Error Display */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <div className="flex items-center">
                <AlertTriangle className="mr-2 h-4 w-4 text-red-600" />
                <span className="text-red-800">{error}</span>
              </div>
            </div>
          )}

          {/* Scan Results */}
          <ScanResults scanResult={scanResult} isScanning={isScanning} />

          {/* Project Results - Master-Detail Layout */}
          {scanResult?.projects && (
            <div className="bg-card border-border overflow-hidden rounded-xl border shadow-sm">
              <div className="border-border flex items-center gap-2 border-b p-4">
                <div className="bg-primary/10 text-primary flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold">
                  3
                </div>
                <h2 className="text-foreground text-sm font-semibold">
                  Found Projects ({scanResult.projects.length})
                </h2>
              </div>
              <div className="flex h-[600px]">
                {/* Left Panel - Project List */}
                <div className="border-border w-2/5 border-r">
                  <ProjectListPanel
                    projects={scanResult.projects}
                    selectedProjects={selectedProjects}
                    selectedProject={selectedProject}
                    onProjectSelection={handleProjectSelection}
                    onProjectClick={handleProjectClick}
                  />
                </div>

                {/* Right Panel - Project Details */}
                <div className="flex-1">
                  <ProjectDetailPanel
                    selectedProject={selectedProject}
                    breadcrumbs={breadcrumbs}
                    isLoadingBreadcrumbs={isLoadingBreadcrumbs}
                    breadcrumbsError={breadcrumbsError}
                    previewMode={previewProject === selectedProject}
                    preview={selectedProject ? getPreview(selectedProject) : null}
                    onTogglePreview={() =>
                      selectedProject && handleTogglePreview(selectedProject)
                    }
                    trelloApiKey={apiKey}
                    trelloApiToken={token}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Preview Progress Indicator */}
          {scanResult?.projects && (
            <PreviewProgress
              current={previews.size}
              total={selectedProjects.length}
              isGenerating={isGenerating}
            />
          )}

          {/* Batch Actions */}
          <BatchActions
            selectedProjects={selectedProjects}
            totalProjects={scanResult?.projects.length || 0}
            isUpdating={isUpdating}
            onSelectAll={handleSelectAll}
            onClearSelection={handleClearSelection}
            onApplyChanges={handleApplyChanges}
          />

          {/* Update Results */}
          {lastUpdateResult && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <div className="flex items-center">
                <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                <span className="text-green-800">
                  Update complete: {lastUpdateResult.successful.length} successful,{' '}
                  {lastUpdateResult.failed.length} failed
                  {lastUpdateResult.created.length > 0 &&
                    ` • ${lastUpdateResult.created.length} created`}
                  {lastUpdateResult.updated.length > 0 &&
                    ` • ${lastUpdateResult.updated.length} updated`}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Batch Update Confirmation Dialog */}
      <BatchUpdateConfirmationDialog
        isOpen={showBatchConfirmation}
        onClose={() => setShowBatchConfirmation(false)}
        onConfirm={handleConfirmBatchUpdate}
        selectedProjects={selectedProjects}
        previews={selectedProjects
          .map((path) => getPreview(path))
          .filter((preview): preview is NonNullable<typeof preview> => preview !== null)}
        isLoading={isUpdating}
      />
    </div>
  )
}

const BakerPage: React.FC = () => {
  return (
    <ErrorBoundary
      fallback={(error, retry) => (
        <div className="flex min-h-[400px] flex-col items-center justify-center p-8 text-center">
          <div className="max-w-md">
            <AlertTriangle className="text-destructive mx-auto mb-4 h-12 w-12" />
            <h2 className="text-foreground mb-4 text-2xl font-semibold">Baker Error</h2>
            <div className="text-muted-foreground mb-6">
              <p>An error occurred while loading the Baker page. This could be due to:</p>
              <ul className="mt-2 space-y-1 text-left">
                <li>• File system access issues</li>
                <li>• Invalid scan configuration</li>
                <li>• Memory or performance constraints</li>
              </ul>
              {error && process.env.NODE_ENV === 'development' && (
                <details className="bg-muted/50 border-border mt-4 rounded-md border p-4 text-left text-sm">
                  <summary className="text-foreground cursor-pointer font-medium">
                    Technical Details
                  </summary>
                  <div className="text-muted-foreground mt-2">
                    <p>
                      <strong className="text-foreground">Error:</strong> {error.message}
                    </p>
                  </div>
                </details>
              )}
            </div>
            <div className="flex justify-center gap-2">
              <Button onClick={retry} className="flex-1">
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
              <Button
                onClick={() => (window.location.href = '/ingest/build')}
                variant="outline"
                className="flex-1"
              >
                Back to Build
              </Button>
            </div>
          </div>
        </div>
      )}
    >
      <BakerPageContent />
    </ErrorBoundary>
  )
}

export default BakerPage
