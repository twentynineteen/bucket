/**
 * Baker Page Component
 *
 * Main page for Baker folder scanning and breadcrumbs management functionality.
 * Full-height master-detail layout: a compact scan toolbar on top, the project
 * list and detail panel filling the remaining viewport, and a floating batch
 * action bar that appears while projects are selected.
 */

import {
  useBakerTrelloIntegration,
  useTrelloBoard,
  useTrelloBoardId
} from '@features/Trello'
import { useBreadcrumb } from '@shared/hooks'
import { Button } from '@shared/ui/button'
import ErrorBoundary from '@shared/ui/layout/ErrorBoundary'
import { PageHeader } from '@shared/ui/layout/PageHeader'
import { logger } from '@shared/utils'
import { AlertTriangle, CheckCircle, FolderSearch, RefreshCw } from 'lucide-react'
import React, { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { BakerPreferences } from './components/BakerPreferences'
import { BatchActions } from './components/BatchActions'
import { BatchUpdateConfirmationDialog } from './components/BatchUpdateConfirmationDialog'
import { FolderSelector } from './components/FolderSelector'
import { PreviewProgress } from './components/PreviewProgress'
import { ProjectDetailPanel } from './components/ProjectDetailPanel'
import { ProjectListPanel, type ProjectStatusFilter } from './components/ProjectListPanel'
import { RepairBreadcrumbsDialog } from './components/RepairBreadcrumbsDialog'
import { ScanResults } from './components/ScanResults'
import { StorageView } from './components/StorageView'
import { useBakerPreferences } from './hooks/useBakerPreferences'
import { useBakerScan } from './hooks/useBakerScan'
import { useBreadcrumbsManager } from './hooks/useBreadcrumbsManager'
import { useBreadcrumbsPreview } from './hooks/useBreadcrumbsPreview'
import { useLiveBreadcrumbsReader } from './hooks/useLiveBreadcrumbsReader'
import { useRepairBreadcrumbs } from './hooks/useRepairBreadcrumbs'
import { breadcrumbsStatus } from './internal/projectStatus'
import type { BatchUpdateResult } from './types'

const ScanError: React.FC<{ error: string; onRetry: () => void }> = ({
  error,
  onRetry
}) => (
  <div className="border-destructive/20 bg-destructive/5 rounded-lg border p-3">
    <div className="flex items-center justify-between">
      <div className="flex items-center">
        <AlertTriangle className="text-destructive mr-2 h-4 w-4" />
        <span className="text-destructive text-sm">{error}</span>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Retry Scan
      </Button>
    </div>
  </div>
)

const UpdateResults: React.FC<{ result: BatchUpdateResult }> = ({ result }) => (
  <div className="border-success/20 bg-success/10 rounded-lg border p-3">
    <div className="flex items-center">
      <CheckCircle className="text-success mr-2 h-4 w-4 flex-shrink-0" />
      <span className="text-success text-sm">
        Update complete: {result.successful.length} successful, {result.failed.length}{' '}
        failed
        {result.created.length > 0 && ` • ${result.created.length} created`}
        {result.updated.length > 0 && ` • ${result.updated.length} updated`}
      </span>
    </div>
  </div>
)

type ViewMode = 'projects' | 'storage'

const VIEW_MODES: ReadonlyArray<{ key: ViewMode; label: string }> = [
  { key: 'projects', label: 'Projects' },
  { key: 'storage', label: 'Storage' }
]

/** Segmented control switching the workspace between the list and the storage map. */
const ViewSwitch: React.FC<{
  viewMode: ViewMode
  onChange: (mode: ViewMode) => void
}> = ({ viewMode, onChange }) => (
  <div className="bg-muted/60 flex flex-shrink-0 gap-0.5 rounded-lg p-0.5">
    {VIEW_MODES.map(mode => (
      <button
        key={mode.key}
        type="button"
        onClick={() => onChange(mode.key)}
        aria-pressed={viewMode === mode.key}
        className={
          viewMode === mode.key
            ? 'bg-background text-foreground rounded-md px-3 py-1 text-xs font-semibold shadow-sm'
            : 'text-muted-foreground hover:text-foreground rounded-md px-3 py-1 text-xs font-medium transition-colors'
        }
      >
        {mode.label}
      </button>
    ))}
  </div>
)

/** Shown in the workspace before a scan has produced any results. */
const NoScanYet: React.FC<{ isScanning: boolean }> = ({ isScanning }) => (
  <div className="text-muted-foreground flex flex-1 items-center justify-center">
    <div className="text-center">
      <FolderSearch className="mx-auto mb-3 h-12 w-12 opacity-50" />
      <p className="text-foreground text-sm font-medium">
        {isScanning
          ? 'Scanning for projects…'
          : 'Select a folder and start a scan to find projects'}
      </p>
      {!isScanning && (
        <p className="mx-auto mt-1 max-w-sm text-xs">
          Baker looks for BuildProject folders and checks that each one&apos;s breadcrumbs
          file still matches what is on disk.
        </p>
      )}
    </div>
  </div>
)

const BakerPageContent: React.FC = () => {
  // Set breadcrumbs for navigation
  useBreadcrumb([{ label: 'Ingest footage', href: '/ingest/build' }, { label: 'Baker' }])

  // Local state - simplified to essential page-level state
  const [selectedFolder, setSelectedFolder] = useState<string>('')
  const [selectedProjects, setSelectedProjects] = useState<string[]>([])
  const [showPreferences, setShowPreferences] = useState(false)
  const [selectedProject, setSelectedProject] = useState<string | null>(null)
  // Projects whose pending changes are open in the review dialog, or null
  const [reviewPaths, setReviewPaths] = useState<string[] | null>(null)
  // "Create breadcrumbs" on one project is an explicit request, so it creates
  // the file whatever the batch preference says.
  const [reviewCreatesMissing, setReviewCreatesMissing] = useState(false)
  const [statusFilter, setStatusFilter] = useState<ProjectStatusFilter>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('projects')
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
  const { boardId } = useTrelloBoardId()
  const { apiKey: apiKeyOrNull, token: tokenOrNull } = useTrelloBoard(boardId)
  // useTrelloBoard normalises absent credentials to `null`; everything below
  // models absence as an omitted optional prop. Convert once here rather than
  // at each of the four sites that consume them (#210).
  const apiKey = apiKeyOrNull ?? undefined
  const token = tokenOrNull ?? undefined
  const { updateTrelloCards } = useBakerTrelloIntegration({ apiKey, token })

  const selectedProjectData = useMemo(
    () => scanResult?.projects.find(p => p.path === selectedProject) ?? null,
    [scanResult, selectedProject]
  )

  // What a write would do to the ticked projects. Only the breadcrumbs state
  // counts here: a write does nothing about an invalid folder structure. With
  // "Create missing breadcrumbs" off, the backend leaves a project that has no
  // file alone, so those are counted apart.
  const selectionCounts = useMemo(() => {
    const counts = { needingUpdate: 0, toCreate: 0, creationOff: 0 }
    for (const project of scanResult?.projects ?? []) {
      if (!selectedProjects.includes(project.path)) continue
      const status = breadcrumbsStatus(project)
      if (status === 'current') continue
      if (status !== 'missing') {
        counts.needingUpdate += 1
      } else if (preferences.createMissing) {
        counts.needingUpdate += 1
        counts.toCreate += 1
      } else {
        counts.creationOff += 1
      }
    }
    return counts
  }, [scanResult, selectedProjects, preferences.createMissing])

  const reviewedPaths = useMemo(() => reviewPaths ?? [], [reviewPaths])

  const handleShowAttention = useCallback(() => {
    setViewMode('projects')
    setStatusFilter('attention')
  }, [])

  const invalidBreadcrumbsPaths = useMemo(
    () => scanResult?.projects.filter(p => p.invalidBreadcrumbs).map(p => p.path) ?? [],
    [scanResult]
  )

  // Event handlers - simplified to essential page-level coordination
  const handleStartScan = useCallback(async () => {
    if (!selectedFolder.trim()) {
      toast.warning('Please select a folder to scan')
      return
    }

    // A new scan may be of another folder: ticks, previews and the filter
    // belong to the results being replaced.
    setSelectedProjects([])
    clearPreviews()
    setStatusFilter('all')

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
  }, [selectedFolder, preferences, startScan, clearPreviews])

  const handleClearResults = useCallback(() => {
    clearResults()
    clearUpdateResults()
    setSelectedProjects([])
    setSelectedProject(null)
    clearBreadcrumbs()
    clearPreviews()
    setStatusFilter('all')
  }, [clearResults, clearUpdateResults, clearBreadcrumbs, clearPreviews])

  const handleProjectSelection = useCallback(
    (projectPath: string, isSelected: boolean) => {
      setSelectedProjects(prev => {
        if (isSelected) {
          return [...prev, projectPath]
        } else {
          return prev.filter(path => path !== projectPath)
        }
      })
    },
    []
  )

  // The list header's select-all: ticks or unticks the rows currently shown,
  // leaving any selection outside the active filter as it was.
  const handleSelectMany = useCallback((projectPaths: string[], isSelected: boolean) => {
    setSelectedProjects(prev => {
      const others = prev.filter(path => !projectPaths.includes(path))
      return isSelected ? [...others, ...projectPaths] : others
    })
  }, [])

  const handleClearSelection = useCallback(() => {
    setSelectedProjects([])
  }, [])

  // Opens the review dialog for a set of projects. Both routes to a write go
  // through it: the ticked batch, and "Update this project" in the detail
  // panel, which reviews one project without disturbing what is ticked.
  const openReview = useCallback(
    async (projectPaths: string[], createMissing: boolean) => {
      if (projectPaths.length === 0) {
        toast.warning('Please select projects to update')
        return
      }

      // Generate previews before showing the confirmation dialog. Previews
      // already generated from the detail panel are reused by the hook cache.
      if (scanResult?.projects) {
        await generateBatchPreviews(
          scanResult.projects.filter(p => projectPaths.includes(p.path))
        )
      }

      setReviewCreatesMissing(createMissing)
      setReviewPaths(projectPaths)
    },
    [scanResult, generateBatchPreviews]
  )

  const handleApplyChanges = useCallback(
    () => openReview(selectedProjects, preferences.createMissing),
    [openReview, selectedProjects, preferences.createMissing]
  )

  const handleUpdateProject = useCallback(
    (projectPath: string) => void openReview([projectPath], true),
    [openReview]
  )

  const handleConfirmBatchUpdate = useCallback(async () => {
    if (!reviewPaths) return

    try {
      // Update local breadcrumbs files first
      await updateBreadcrumbs(reviewPaths, {
        createMissing: reviewCreatesMissing,
        backupOriginals: preferences.backupOriginals
      })

      // Update Trello cards using extracted hook
      const trelloErrors = await updateTrelloCards(reviewPaths)

      // Untick what was just written, and drop the previews
      setSelectedProjects(prev => prev.filter(path => !reviewPaths.includes(path)))
      clearPreviews()
      setReviewPaths(null)

      // The scan result still holds the state from before the write.
      await Promise.all(reviewPaths.map(path => refreshProject(path)))
      if (selectedProject && reviewPaths.includes(selectedProject)) {
        await readLiveBreadcrumbs(selectedProject)
      }

      // Show Trello errors if any occurred
      if (trelloErrors.length > 0) {
        const errorMessage =
          `Breadcrumbs updated successfully, but ${trelloErrors.length} Trello card update(s) failed:\n\n` +
          trelloErrors.map(({ project, error }) => `• ${project}: ${error}`).join('\n')
        toast.error(errorMessage)
      }
    } catch (error) {
      toast.error(`Failed to update breadcrumbs: ${error}`)
      setReviewPaths(null)
    }
  }, [
    reviewPaths,
    reviewCreatesMissing,
    preferences.backupOriginals,
    updateBreadcrumbs,
    updateTrelloCards,
    clearPreviews,
    refreshProject,
    selectedProject,
    readLiveBreadcrumbs
  ])

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
      {/* One toolbar row: page title, scan folder and actions, preferences.
          The title and the toolbar used to be two stacked bands. */}
      <PageHeader title="Baker" className="py-2">
        <FolderSelector
          selectedFolder={selectedFolder}
          onFolderChange={setSelectedFolder}
          onStartScan={handleStartScan}
          onCancelScan={cancelScan}
          onClearResults={handleClearResults}
          isScanning={isScanning}
          hasResults={!!scanResult}
        />
        <BakerPreferences
          preferences={preferences}
          onUpdatePreferences={updatePreferences}
          onResetToDefaults={resetToDefaults}
          isOpen={showPreferences}
          onOpenChange={setShowPreferences}
        />
      </PageHeader>

      {/* Scan error, preview progress and the last update's result. The band
          takes no space while it has nothing to show. */}
      <div className="border-border flex-shrink-0 space-y-2 border-b px-6 py-2 empty:hidden">
        {/* Inline Error Display */}
        {error && <ScanError error={error} onRetry={handleStartScan} />}

        {/* Preview Progress Indicator */}
        {scanResult?.projects && (
          <PreviewProgress
            current={previews.size}
            total={selectedProjects.length}
            isGenerating={isGenerating}
          />
        )}

        {/* Update Results */}
        {lastUpdateResult && <UpdateResults result={lastUpdateResult} />}
      </div>

      {/* Workspace: project list + detail panel fill the remaining height */}
      {scanResult?.projects ? (
        <>
          <div className="border-border flex flex-shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b px-6 py-1.5">
            <ViewSwitch viewMode={viewMode} onChange={setViewMode} />
            {/* Live progress while a scan runs, the one-line summary after. */}
            <ScanResults
              scanResult={scanResult}
              isScanning={isScanning}
              scanStartTime={scanStartTime}
              onShowAttention={handleShowAttention}
            />
          </div>

          {viewMode === 'storage' ? (
            <div className="min-h-0 flex-1">
              <StorageView
                projects={scanResult.projects}
                onProjectClick={handleStorageProjectClick}
              />
            </div>
          ) : (
            <div className="flex min-h-0 flex-1">
              {/* List column: the rows, then the batch footer for ticked rows */}
              <div className="border-border w-[24rem] flex-shrink-0 border-r xl:w-[28rem]">
                <ProjectListPanel
                  projects={scanResult.projects}
                  selectedProjects={selectedProjects}
                  selectedProject={selectedProject}
                  rootPath={scanResult.rootPath}
                  statusFilter={statusFilter}
                  onStatusFilterChange={setStatusFilter}
                  onProjectSelection={handleProjectSelection}
                  onSelectMany={handleSelectMany}
                  onProjectClick={handleProjectClick}
                  onRepairProject={handleRepairRequest}
                  footer={hiddenByFilterCount => (
                    <BatchActions
                      selectedProjects={selectedProjects}
                      needingUpdateCount={selectionCounts.needingUpdate}
                      toCreateCount={selectionCounts.toCreate}
                      creationOffCount={selectionCounts.creationOff}
                      hiddenByFilterCount={hiddenByFilterCount}
                      isUpdating={isUpdating}
                      onClearSelection={handleClearSelection}
                      onApplyChanges={handleApplyChanges}
                    />
                  )}
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
                  onUpdateProject={handleUpdateProject}
                  trelloApiKey={apiKey}
                  trelloApiToken={token}
                />
              </div>
            </div>
          )}
        </>
      ) : (
        <NoScanYet isScanning={isScanning} />
      )}

      {/* Batch Update Confirmation Dialog */}
      <BatchUpdateConfirmationDialog
        isOpen={reviewPaths !== null}
        onClose={() => setReviewPaths(null)}
        onConfirm={handleConfirmBatchUpdate}
        selectedProjects={reviewedPaths}
        previews={reviewedPaths
          .map(path => getPreview(path))
          .filter((preview): preview is NonNullable<typeof preview> => preview !== null)}
        isLoading={isUpdating}
        invalidBreadcrumbsPaths={invalidBreadcrumbsPaths}
      />

      {/* Repair Breadcrumbs Confirmation Dialog */}
      <RepairBreadcrumbsDialog
        open={repairTarget !== null}
        projectName={
          scanResult?.projects.find(p => p.path === repairTarget)?.name ?? null
        }
        isRepairing={isRepairing}
        onOpenChange={open => {
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
