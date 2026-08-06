/**
 * Baker Page Component
 *
 * Main page for Baker folder scanning and breadcrumbs management functionality.
 * Full-height master-detail layout: a compact scan toolbar on top, the project
 * list and detail panel filling the remaining viewport, and a floating batch
 * action bar that appears while projects are selected.
 */

import { AlertTriangle, CheckCircle, FolderSearch, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import React, { useCallback, useMemo, useState } from 'react'

import { BakerPreferences } from './components/BakerPreferences'
import { BatchActions } from './components/BatchActions'
import { BatchUpdateConfirmationDialog } from './components/BatchUpdateConfirmationDialog'
import { FolderSelector } from './components/FolderSelector'
import { PreviewProgress } from './components/PreviewProgress'
import { ProjectDetailPanel } from './components/ProjectDetailPanel'
import { ProjectListPanel } from './components/ProjectListPanel'
import { RepairBreadcrumbsDialog } from './components/RepairBreadcrumbsDialog'
import { ScanResults } from './components/ScanResults'
import { StorageView } from './components/StorageView'
import { useBakerPreferences } from './hooks/useBakerPreferences'
import { useBakerScan } from './hooks/useBakerScan'
import { useBreadcrumbsManager } from './hooks/useBreadcrumbsManager'
import { useBreadcrumbsPreview } from './hooks/useBreadcrumbsPreview'
import { useLiveBreadcrumbsReader } from './hooks/useLiveBreadcrumbsReader'
import { useRepairBreadcrumbs } from './hooks/useRepairBreadcrumbs'
import { Button } from '@shared/ui/button'
import ErrorBoundary from '@shared/ui/layout/ErrorBoundary'

import { useBakerTrelloIntegration, useTrelloBoard } from '@features/Trello'
import { useBreadcrumb } from '@shared/hooks'
import { logger } from '@shared/utils'

const BakerPageContent: React.FC = () => {
  // Set breadcrumbs for navigation
  useBreadcrumb([{ label: 'Ingest footage', href: '/ingest/build' }, { label: 'Baker' }])

  // Local state - simplified to essential page-level state
  const [selectedFolder, setSelectedFolder] = useState<string>('')
  const [selectedProjects, setSelectedProjects] = useState<string[]>([])
  const [showPreferences, setShowPreferences] = useState(false)
  const [selectedProject, setSelectedProject] = useState<string | null>(null)
  const [showBatchConfirmation, setShowBatchConfirmation] = useState(false)
  const [viewMode, setViewMode] = useState<'projects' | 'storage'>('projects')
  const [repairTarget, setRepairTarget] = useState<string | null>(null)

  // Custom hooks - all business logic moved to hooks
  const {
    scanResult,
    isScanning,
    error,
    scanStartTime,
    startScan,
    cancelScan,
    clearResults,
    refreshProject
  } = useBakerScan()
  const {
    updateBreadcrumbs,
    isUpdating,
    lastUpdateResult,
    clearResults: clearUpdateResults
  } = useBreadcrumbsManager()
  const { preferences, updatePreferences, resetToDefaults } = useBakerPreferences()
  const { repairBreadcrumbs, isRepairing } = useRepairBreadcrumbs()
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

  const selectedProjectData = useMemo(
    () => scanResult?.projects.find((p) => p.path === selectedProject) ?? null,
    [scanResult, selectedProject]
  )

  const invalidBreadcrumbsPaths = useMemo(
    () =>
      scanResult?.projects.filter((p) => p.invalidBreadcrumbs).map((p) => p.path) ?? [],
    [scanResult]
  )

  // Event handlers - simplified to essential page-level coordination
  const handleStartScan = useCallback(async () => {
    if (!selectedFolder.trim()) {
      toast.warning('Please select a folder to scan')
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
      toast.warning('Please select projects to update')
      return
    }

    // Generate previews for selected projects before showing confirmation dialog.
    // Previews already generated from the detail panel are reused by the hook cache.
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
        toast.error(errorMessage)
      }
    } catch (error) {
      toast.error(`Failed to update breadcrumbs: ${error}`)
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

  const handleRepairRequest = useCallback((projectPath: string) => {
    setRepairTarget(projectPath)
  }, [])

  const handleConfirmRepair = useCallback(async () => {
    if (!repairTarget) return

    try {
      await repairBreadcrumbs(repairTarget)
      toast.success('Breadcrumbs repaired — backup saved as breadcrumbs.json.bak')
      await refreshProject(repairTarget)
      if (selectedProject === repairTarget) {
        await readLiveBreadcrumbs(repairTarget)
      }
    } catch (repairError) {
      logger.error('Failed to repair breadcrumbs:', repairError)
      toast.error(`Failed to repair breadcrumbs: ${repairError}`)
    } finally {
      setRepairTarget(null)
    }
  }, [
    repairTarget,
    repairBreadcrumbs,
    refreshProject,
    selectedProject,
    readLiveBreadcrumbs
  ])

  const handleGeneratePreview = useCallback(async () => {
    if (selectedProject && selectedProjectData) {
      await generatePreview(selectedProject, selectedProjectData)
    }
  }, [selectedProject, selectedProjectData, generatePreview])

  // Clicking a project in the storage map jumps to it in the projects view
  const handleStorageProjectClick = useCallback(
    (projectPath: string) => {
      setViewMode('projects')
      void handleProjectClick(projectPath)
    },
    [handleProjectClick]
  )

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Header */}
      <div className="border-border bg-card/50 flex-shrink-0 border-b px-6 py-3">
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

      {/* Scan toolbar: folder selection + inline scan stats */}
      <div className="border-border bg-card/30 flex-shrink-0 space-y-2 border-b px-6 py-2.5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <FolderSelector
            selectedFolder={selectedFolder}
            onFolderChange={setSelectedFolder}
            onStartScan={handleStartScan}
            onCancelScan={cancelScan}
            onClearResults={handleClearResults}
            isScanning={isScanning}
            hasResults={!!scanResult}
          />
          <ScanResults
            scanResult={scanResult}
            isScanning={isScanning}
            scanStartTime={scanStartTime}
          />
        </div>

        {/* Inline Error Display */}
        {error && (
          <div className="border-destructive/20 bg-destructive/5 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <AlertTriangle className="text-destructive mr-2 h-4 w-4" />
                <span className="text-destructive text-sm">{error}</span>
              </div>
              <Button variant="outline" size="sm" onClick={handleStartScan}>
                Retry Scan
              </Button>
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

        {/* Update Results */}
        {lastUpdateResult && (
          <div className="border-success/20 bg-success/10 rounded-lg border p-3">
            <div className="flex items-center">
              <CheckCircle className="text-success mr-2 h-4 w-4 flex-shrink-0" />
              <span className="text-success text-sm">
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

      {/* Workspace: project list + detail panel fill the remaining height */}
      {scanResult?.projects ? (
        <>
          <div className="border-border bg-card/20 flex flex-shrink-0 gap-1 border-b px-6 py-1.5">
            {(
              [
                { key: 'projects', label: 'Projects' },
                { key: 'storage', label: 'Storage' }
              ] as const
            ).map((mode) => (
              <button
                key={mode.key}
                type="button"
                onClick={() => setViewMode(mode.key)}
                className={
                  viewMode === mode.key
                    ? 'bg-primary/10 text-primary rounded-md px-3 py-1 text-xs font-semibold'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground rounded-md px-3 py-1 text-xs font-medium transition-colors'
                }
              >
                {mode.label}
              </button>
            ))}
          </div>

          {viewMode === 'storage' ? (
            <div className="min-h-0 flex-1">
              <StorageView
                projects={scanResult.projects}
                onProjectClick={handleStorageProjectClick}
              />
            </div>
          ) : (
            <div className="relative flex min-h-0 flex-1">
              <div className="border-border w-80 flex-shrink-0 border-r">
                <ProjectListPanel
                  projects={scanResult.projects}
                  selectedProjects={selectedProjects}
                  selectedProject={selectedProject}
                  onProjectSelection={handleProjectSelection}
                  onProjectClick={handleProjectClick}
                  onRepairProject={handleRepairRequest}
                />
              </div>

              <div className="min-w-0 flex-1">
                <ProjectDetailPanel
                  selectedProject={selectedProject}
                  project={selectedProjectData}
                  breadcrumbs={breadcrumbs}
                  isLoadingBreadcrumbs={isLoadingBreadcrumbs}
                  breadcrumbsError={breadcrumbsError}
                  preview={selectedProject ? getPreview(selectedProject) : null}
                  isGeneratingPreview={isGenerating}
                  onGeneratePreview={handleGeneratePreview}
                  onRepairProject={handleRepairRequest}
                  trelloApiKey={apiKey}
                  trelloApiToken={token}
                />
              </div>

              <BatchActions
                selectedProjects={selectedProjects}
                totalProjects={scanResult.projects.length}
                isUpdating={isUpdating}
                onSelectAll={handleSelectAll}
                onClearSelection={handleClearSelection}
                onApplyChanges={handleApplyChanges}
              />
            </div>
          )}
        </>
      ) : (
        <div className="text-muted-foreground flex flex-1 items-center justify-center">
          <div className="text-center">
            <FolderSearch className="mx-auto mb-3 h-12 w-12 opacity-50" />
            <p className="text-sm">
              {isScanning
                ? 'Scanning for projects…'
                : 'Select a folder and start a scan to find projects'}
            </p>
          </div>
        </div>
      )}

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
        invalidBreadcrumbsPaths={invalidBreadcrumbsPaths}
      />

      {/* Repair Breadcrumbs Confirmation Dialog */}
      <RepairBreadcrumbsDialog
        open={repairTarget !== null}
        projectName={
          scanResult?.projects.find((p) => p.path === repairTarget)?.name ?? null
        }
        isRepairing={isRepairing}
        onOpenChange={(open) => {
          if (!open) setRepairTarget(null)
        }}
        onConfirm={handleConfirmRepair}
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
