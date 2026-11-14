/**
 * Project Detail Panel Component
 *
 * Right panel of the master-detail layout. Shows the selected project's
 * breadcrumbs in real tabs (Overview / Files / Videos / Trello), with a
 * breadcrumbs status callout that lazily generates a change preview and a
 * linked-resources hub that demotes the legacy Trello card field.
 */

import {
  TrelloCardsManager,
  useTrelloCardsManager,
  useTrelloSelfAssignment
} from '@features/Trello'
import { Button } from '@shared/ui/button'
import { Input } from '@shared/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/ui/tabs'
import { cn, formatBreadcrumbDateSimple, formatFileSize } from '@shared/utils'
import {
  AlertTriangle,
  Calendar,
  Camera,
  ChevronRight,
  Copy,
  CreditCard,
  ExternalLink,
  File,
  FileAudio,
  FileVideo,
  FolderOpen,
  Info,
  Loader2,
  RefreshCw,
  Search,
  User,
  UserCheck,
  UserPlus,
  Video
} from 'lucide-react'
import React, { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { openInShell } from '../api'
import { useVerifiedPaths } from '../hooks/useVerifiedPaths'
import { breadcrumbsStatus, STATUS_PRESENTATION } from '../internal/projectStatus'
import type {
  BreadcrumbsFile,
  BreadcrumbsPreview,
  FileInfo,
  ProjectFolder,
  TrelloCard,
  VideoLink
} from '../types'
import { buildProjectChangeRows } from '../utils/changeRows'
import { ChangeDiffList } from './ChangeDiffList'
import { VideoLinksManager } from './VideoLinksManager'

interface ProjectDetailPanelProps {
  selectedProject: string | null
  project: ProjectFolder | null
  breadcrumbs: BreadcrumbsFile | null
  isLoadingBreadcrumbs: boolean
  breadcrumbsError: string | null
  preview: BreadcrumbsPreview | null
  isGeneratingPreview: boolean
  onGeneratePreview: () => void | Promise<void>
  onRepairProject?: (projectPath: string) => void
  /** Review and apply the pending breadcrumbs update for this one project. */
  onUpdateProject?: (projectPath: string) => void
  trelloApiKey?: string
  trelloApiToken?: string
}

export const ProjectDetailPanel: React.FC<ProjectDetailPanelProps> = ({
  selectedProject,
  project,
  breadcrumbs,
  isLoadingBreadcrumbs,
  breadcrumbsError,
  preview,
  isGeneratingPreview,
  onGeneratePreview,
  onRepairProject,
  onUpdateProject,
  trelloApiKey,
  trelloApiToken
}) => {
  if (!selectedProject) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center">
        <div className="text-center">
          <FolderOpen className="mx-auto mb-3 h-12 w-12 opacity-50" />
          <p className="text-sm">Select a project to view details</p>
        </div>
      </div>
    )
  }

  if (isLoadingBreadcrumbs) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground flex items-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading breadcrumbs...</span>
        </div>
      </div>
    )
  }

  return (
    <ProjectDetailContent
      projectPath={selectedProject}
      project={project}
      breadcrumbs={breadcrumbs}
      breadcrumbsError={breadcrumbsError}
      preview={preview}
      isGeneratingPreview={isGeneratingPreview}
      onGeneratePreview={onGeneratePreview}
      onRepairProject={onRepairProject}
      onUpdateProject={onUpdateProject}
      trelloApiKey={trelloApiKey}
      trelloApiToken={trelloApiToken}
    />
  )
}

interface ProjectDetailContentProps {
  projectPath: string
  project: ProjectFolder | null
  breadcrumbs: BreadcrumbsFile | null
  breadcrumbsError: string | null
  preview: BreadcrumbsPreview | null
  isGeneratingPreview: boolean
  onGeneratePreview: () => void | Promise<void>
  onRepairProject?: (projectPath: string) => void
  /** Review and apply the pending breadcrumbs update for this one project. */
  onUpdateProject?: (projectPath: string) => void
  trelloApiKey?: string
  trelloApiToken?: string
}

const ProjectDetailContent: React.FC<ProjectDetailContentProps> = ({
  projectPath,
  project,
  breadcrumbs,
  breadcrumbsError,
  preview,
  isGeneratingPreview,
  onGeneratePreview,
  onRepairProject,
  onUpdateProject,
  trelloApiKey,
  trelloApiToken
}) => {
  // Breadcrumbs shown for a missing or unparseable file are rebuilt from the
  // folder, so anything only the file could know (author, dates, links) is
  // not stated as fact.
  const reconstructed = project
    ? project.invalidBreadcrumbs || !project.hasBreadcrumbs
    : false

  return (
    <div className="flex h-full flex-col">
      <DetailHeader
        projectPath={projectPath}
        project={project}
        breadcrumbs={breadcrumbs}
      />

      {breadcrumbs ? (
        <Tabs defaultValue="overview" className="flex min-h-0 flex-1 flex-col">
          <div className="border-border flex-shrink-0 border-b px-4 py-2">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="files">
                Files
                <CountPill count={breadcrumbs.files?.length ?? 0} />
              </TabsTrigger>
              <LinksTab
                value="videos"
                label="Videos"
                count={breadcrumbs.videoLinks?.length}
                unknown={reconstructed}
              />
              <LinksTab
                value="trello"
                label="Trello"
                count={breadcrumbs.trelloCards?.length}
                unknown={reconstructed}
              />
            </TabsList>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <TabsContent value="overview" className="mt-0 space-y-5">
              <BreadcrumbsCallout
                project={project}
                preview={preview}
                isGeneratingPreview={isGeneratingPreview}
                onGeneratePreview={onGeneratePreview}
                onRepairProject={onRepairProject}
                onUpdateProject={onUpdateProject}
              />
              <OverviewStats breadcrumbs={breadcrumbs} reconstructed={reconstructed} />
              <FootageSummary files={breadcrumbs.files} />
              <LinkedResources
                projectPath={projectPath}
                breadcrumbs={breadcrumbs}
                unavailableReason={linksUnavailableReason(project)}
                trelloApiKey={trelloApiKey}
                trelloApiToken={trelloApiToken}
              />
            </TabsContent>

            <TabsContent value="files" className="mt-0">
              <FilesTab files={breadcrumbs.files} />
            </TabsContent>

            <TabsContent value="videos" className="mt-0">
              <VideoLinksManager projectPath={projectPath} />
            </TabsContent>

            <TabsContent value="trello" className="mt-0">
              <TrelloCardsManager
                projectPath={projectPath}
                trelloApiKey={trelloApiKey}
                trelloApiToken={trelloApiToken}
              />
            </TabsContent>
          </div>
        </Tabs>
      ) : (
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <BreadcrumbsCallout
            project={project}
            preview={preview}
            isGeneratingPreview={isGeneratingPreview}
            onGeneratePreview={onGeneratePreview}
            onRepairProject={onRepairProject}
            onUpdateProject={onUpdateProject}
          />
          {breadcrumbsError ? (
            <div className="text-destructive flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span>{breadcrumbsError}</span>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No breadcrumbs data found</p>
          )}
        </div>
      )}
    </div>
  )
}

// Sub-components

/**
 * Copies a project path to the clipboard and toasts the verification state.
 *
 * Copying is never blocked. A path that does not resolve here is still
 * the thing the user wants to send to whoever has the drive. What changes
 * is the claim made about it: three states, so an unverified path is
 * never confirmed as though it had been checked.
 */
async function copyPathWithToast(
  projectPath: string,
  projectPresent: boolean | undefined
): Promise<void> {
  try {
    await navigator.clipboard.writeText(projectPath)
    if (projectPresent === true) {
      toast.success('Project path copied')
    } else if (projectPresent === false) {
      toast.warning('Project path copied, but it was not found on this machine')
    } else {
      toast.info('Project path copied. Bucket has not checked whether it still exists.')
    }
  } catch {
    toast.error('Failed to copy path')
  }
}

function cameraCountLabel(count: number): string {
  if (count === 0) return 'No cameras'
  return `${count} camera${count !== 1 ? 's' : ''}`
}

const DetailHeaderPills: React.FC<{
  project: ProjectFolder
  parentPresent: boolean | undefined
  cameraCount: number | undefined
  sizeBytes: number | undefined
}> = ({ project, parentPresent, cameraCount, sizeBytes }) => (
  <div className="flex flex-wrap items-center gap-1.5">
    {/* One status chip. Folder structure is only worth a chip when it is wrong. */}
    <BreadcrumbsStatusPill project={project} />
    {!project.isValid && <HeaderPill tone="destructive">Invalid structure</HeaderPill>}
    {/*
      Only ever rendered on a definite `false`. While the probe is in
      flight `parentPresent` is undefined and nothing is claimed, so the
      panel does not flash a wrong cause mid-check (#166 B5.6).
    */}
    {parentPresent === false && (
      <HeaderPill tone="warning">Location not found</HeaderPill>
    )}
    {/* The two facts every state has, on the status line: cameras and size */}
    <span className="text-muted-foreground text-xs tabular-nums">
      {[
        cameraCount !== undefined ? cameraCountLabel(cameraCount) : null,
        sizeBytes ? formatFileSize(sizeBytes) : null
      ]
        .filter(Boolean)
        .join(' · ')}
    </span>
  </div>
)

interface DetailHeaderProps {
  projectPath: string
  project: ProjectFolder | null
  breadcrumbs: BreadcrumbsFile | null
}

const DetailHeader: React.FC<DetailHeaderProps> = ({
  projectPath,
  project,
  breadcrumbs
}) => {
  const title = breadcrumbs?.projectTitle ?? project?.name ?? projectPath
  const parentPath =
    breadcrumbs?.parentFolder ?? projectPath.split('/').slice(0, -1).join('/')
  const cameraCount = breadcrumbs?.numberOfCameras ?? project?.cameraCount

  // Two paths, one batched probe (issue #168). They are genuinely different
  // strings: the header displays `parentPath`, which prefers the location
  // recorded in breadcrumbs and so may have been authored on another machine,
  // while the button copies `projectPath`, the live path from the scan. Both
  // need resolving, and the toast must speak for the one actually copied.
  const probed = useMemo(() => [projectPath, parentPath], [projectPath, parentPath])
  const { isPresent } = useVerifiedPaths(probed)

  const parentPresent = isPresent(parentPath)
  const projectPresent = isPresent(projectPath)

  return (
    <div className="border-border space-y-2 border-b p-4">
      <h3 className="text-foreground leading-snug font-semibold [overflow-wrap:anywhere]">
        {title}
      </h3>
      <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <span
          className={cn(
            'min-w-0 [overflow-wrap:anywhere]',
            parentPresent === false && 'line-through'
          )}
          title={
            parentPresent === false
              ? `Not found on this machine: ${parentPath}`
              : undefined
          }
        >
          {parentPath}
        </span>
        <button
          type="button"
          onClick={() => copyPathWithToast(projectPath, projectPresent)}
          title="Copy project path"
          className="hover:text-foreground hover:bg-accent flex-shrink-0 rounded p-0.5 transition-colors"
        >
          <Copy className="h-3 w-3" />
        </button>
      </div>
      {project && (
        <DetailHeaderPills
          project={project}
          parentPresent={parentPresent}
          cameraCount={cameraCount}
          // The size the scan measured, as shown in the list row and storage
          // map, falling back to the one recorded in the breadcrumbs.
          sizeBytes={project.folderSizeBytes ?? breadcrumbs?.folderSizeBytes}
        />
      )}
    </div>
  )
}

const BreadcrumbsStatusPill: React.FC<{ project: ProjectFolder }> = ({ project }) => {
  // Same four words as the list rows, filter chips and storage legend.
  const status = breadcrumbsStatus(project)
  return (
    <HeaderPill
      tone={STATUS_PILL_TONE[status]}
      marker={STATUS_PRESENTATION[status].marker}
    >
      {STATUS_PRESENTATION[status].label}
    </HeaderPill>
  )
}

const STATUS_PILL_TONE = {
  current: 'success',
  stale: 'warning',
  missing: 'info',
  unparseable: 'destructive'
} as const

const HEADER_PILL_TONES = {
  success: 'bg-success/20 text-success',
  warning: 'bg-warning/20 text-warning-text',
  info: 'bg-info/15 text-info-text',
  destructive: 'bg-destructive/20 text-destructive',
  muted: 'bg-muted text-muted-foreground'
} as const

const HeaderPill: React.FC<{
  tone: keyof typeof HEADER_PILL_TONES
  /** Marker classes; defaults to a solid dot in the pill's text colour. */
  marker?: string
  children: React.ReactNode
}> = ({ tone, marker = 'bg-current', children }) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
      HEADER_PILL_TONES[tone]
    )}
  >
    <span className={cn('h-2 w-2 flex-shrink-0 rounded-full', marker)} />
    {children}
  </span>
)

/** Banner colours per state, matching the status chip above it. */
const CALLOUT_TONE = {
  current: { box: 'border-border bg-muted/30', text: 'text-foreground' },
  stale: { box: 'border-warning/30 bg-warning/5', text: 'text-warning-text' },
  missing: { box: 'border-info/30 bg-info/5', text: 'text-info-text' },
  unparseable: { box: 'border-destructive/20 bg-destructive/5', text: 'text-destructive' }
} as const

/**
 * Tab for links kept in the breadcrumbs file (videos, Trello cards).
 *
 * When the file could not be read the links are unknown, so the tab is dimmed
 * and shows no count: "0" would claim there are none.
 */
const LinksTab: React.FC<{
  value: string
  label: string
  count: number | undefined
  unknown: boolean
}> = ({ value, label, count, unknown }) => (
  <TabsTrigger
    value={value}
    className={cn(unknown && 'text-muted-foreground/70')}
    title={unknown ? 'Needs a readable breadcrumbs file' : undefined}
  >
    {label}
    {!unknown && <CountPill count={count ?? 0} />}
  </TabsTrigger>
)

const CountPill: React.FC<{ count: number }> = ({ count }) => (
  <span className="bg-muted-foreground/15 ml-1.5 rounded-full px-1.5 py-px text-[10px] font-semibold">
    {count}
  </span>
)

interface BreadcrumbsCalloutProps {
  project: ProjectFolder | null
  preview: BreadcrumbsPreview | null
  isGeneratingPreview: boolean
  onGeneratePreview: () => void | Promise<void>
  onRepairProject?: (projectPath: string) => void
  /** Review and apply the pending breadcrumbs update for this one project. */
  onUpdateProject?: (projectPath: string) => void
}

function calloutHeadline(project: ProjectFolder): string {
  if (project.invalidBreadcrumbs) return 'Breadcrumbs file is unparseable'
  if (!project.hasBreadcrumbs) return 'Breadcrumbs file is missing'
  return 'Breadcrumbs are stale'
}

function calloutSubline(project: ProjectFolder, pendingCount: number | null): string {
  if (pendingCount !== null) {
    // Counts the changes listed below. The fields stamped on every write are
    // shown under them with their own label and are not part of the count.
    return `${pendingCount} change${pendingCount !== 1 ? 's' : ''} will be written when you update`
  }
  if (project.invalidBreadcrumbs) {
    return 'Repair rebuilds it and keeps a backup'
  }
  if (!project.hasBreadcrumbs) {
    return 'This folder has no breadcrumbs.json yet'
  }
  return 'Folder contents changed since the last update'
}

function calloutNote(
  project: ProjectFolder,
  isNewBreadcrumbs: boolean
): string | undefined {
  if (project.invalidBreadcrumbs) {
    return 'Existing breadcrumbs file is unparseable — it will be rebuilt (a backup will be saved).'
  }
  if (isNewBreadcrumbs) {
    return 'No breadcrumbs file — a new one will be created.'
  }
  return undefined
}

const CalloutActions: React.FC<{
  project: ProjectFolder
  preview: BreadcrumbsPreview | null
  isGeneratingPreview: boolean
  onGeneratePreview: () => void | Promise<void>
  onRepairProject?: (projectPath: string) => void
  /** Review and apply the pending breadcrumbs update for this one project. */
  onUpdateProject?: (projectPath: string) => void
  /** Whether the previewed changes are listed, and the switch for it. */
  showChanges: boolean
  onToggleChanges: () => void
}> = ({
  project,
  preview,
  isGeneratingPreview,
  onGeneratePreview,
  onRepairProject,
  onUpdateProject,
  showChanges,
  onToggleChanges
}) => (
  // One group, so in a narrow panel the buttons drop below the text together
  // and stay side by side.
  <div className="flex flex-wrap items-center gap-2">
    {/* Preview is the secondary action; each state has exactly one primary:
        repair an unparseable file, otherwise review and write the update. */}
    {preview ? (
      // Once the changes are listed the same button folds them away again.
      <Button
        variant="outline"
        size="sm"
        onClick={onToggleChanges}
        aria-expanded={showChanges}
        className="flex-shrink-0"
      >
        {showChanges ? 'Hide changes' : 'Show changes'}
      </Button>
    ) : (
      <Button
        variant="outline"
        size="sm"
        onClick={onGeneratePreview}
        disabled={isGeneratingPreview}
        className="flex-shrink-0 gap-1.5"
      >
        {isGeneratingPreview ? (
          <>
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            Checking…
          </>
        ) : (
          'Preview changes'
        )}
      </Button>
    )}
    {project.invalidBreadcrumbs && onRepairProject && (
      <Button
        size="sm"
        // The same primary button as the other states: repair rebuilds the
        // file and keeps a backup, so it is not styled as a destructive act.
        onClick={() => onRepairProject(project.path)}
        className="flex-shrink-0 gap-1.5"
      >
        Repair breadcrumbs
      </Button>
    )}
    {!project.invalidBreadcrumbs && onUpdateProject && (
      <Button
        size="sm"
        onClick={() => onUpdateProject(project.path)}
        className="flex-shrink-0 gap-1.5"
      >
        {project.hasBreadcrumbs ? 'Update this project' : 'Create breadcrumbs'}
      </Button>
    )}
  </div>
)

const BreadcrumbsCallout: React.FC<BreadcrumbsCalloutProps> = ({
  project,
  preview,
  isGeneratingPreview,
  onGeneratePreview,
  onRepairProject,
  onUpdateProject
}) => {
  // The previewed changes open listed; "Hide changes" folds them away.
  const [showChanges, setShowChanges] = useState(true)

  if (!project) return null

  const needsAttention =
    project.invalidBreadcrumbs || !project.hasBreadcrumbs || project.staleBreadcrumbs
  if (!needsAttention) return null

  const tone = CALLOUT_TONE[breadcrumbsStatus(project)]
  const changes = preview ? buildProjectChangeRows(preview) : null

  const headline = calloutHeadline(project)
  const subline = calloutSubline(project, changes ? changes.rows.length : null)
  // A missing file is something to create, not something that went wrong.
  const CalloutIcon = project.hasBreadcrumbs ? AlertTriangle : Info
  const note = calloutNote(project, changes?.isNewBreadcrumbs ?? false)

  return (
    <div className="@container space-y-2">
      <div
        className={cn(
          'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border p-3',
          tone.box
        )}
      >
        <CalloutIcon className={cn('h-4 w-4 flex-shrink-0', tone.text)} />
        <div className="min-w-48 flex-1">
          <p className={cn('text-sm font-semibold', tone.text)}>{headline}</p>
          <p className="text-muted-foreground text-xs">{subline}</p>
        </div>
        <CalloutActions
          project={project}
          preview={preview}
          isGeneratingPreview={isGeneratingPreview}
          onGeneratePreview={onGeneratePreview}
          onRepairProject={onRepairProject}
          onUpdateProject={onUpdateProject}
          showChanges={showChanges}
          onToggleChanges={() => setShowChanges(shown => !shown)}
        />
      </div>

      {changes && showChanges && (
        <div className="border-border rounded-lg border py-1.5">
          <ChangeDiffList
            rows={changes.rows}
            maintenanceFields={changes.maintenanceFields}
            note={note}
            basePath={project.path}
          />
        </div>
      )}
    </div>
  )
}

const OVERVIEW_DATE_FORMAT = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short'
})

/** Date and time to the minute, in the machine's own locale. */
function formatOverviewDate(value: string): string {
  const date = new Date(value)
  // Missing and malformed values keep the shared formatter's wording.
  return isNaN(date.getTime())
    ? formatBreadcrumbDateSimple(value)
    : OVERVIEW_DATE_FORMAT.format(date)
}

/**
 * The project's recorded facts as a plain label/value list.
 *
 * `reconstructed` marks breadcrumbs rebuilt from the folder because the file on
 * disk could not be parsed. Those have no real author or creation date (the
 * reader fills in the current time), so neither is shown as though recorded.
 */
const OverviewStats: React.FC<{
  breadcrumbs: BreadcrumbsFile
  reconstructed?: boolean
}> = ({ breadcrumbs, reconstructed = false }) => {
  const formatDate = formatOverviewDate

  // Who and when, in pairs: created / created by, last modified / scanned by.
  // Camera count and folder size are in the header, beside the status.
  const stats: Array<{ icon: React.ReactNode; label: string; value: string }> = []

  if (!reconstructed) {
    stats.push(
      {
        icon: <Calendar className="h-3 w-3" />,
        label: 'Created',
        value: formatDate(breadcrumbs.creationDateTime)
      },
      {
        icon: <User className="h-3 w-3" />,
        label: 'Created by',
        value: breadcrumbs.createdBy
      }
    )
  }

  if (breadcrumbs.lastModified) {
    stats.push({
      icon: <Calendar className="h-3 w-3" />,
      label: 'Last modified',
      value: formatDate(breadcrumbs.lastModified)
    })
  }
  if (breadcrumbs.scannedBy) {
    stats.push({
      icon: <Search className="h-3 w-3" />,
      label: 'Scanned by',
      value: breadcrumbs.scannedBy
    })
  }

  if (stats.length === 0) return null

  return (
    // Columns follow the panel's own width, not the window's: the four fields
    // sit in one row when there is room, otherwise as two pairs.
    <div className="@container">
      <dl className="grid grid-cols-2 gap-x-8 gap-y-3 @2xl:grid-cols-4">
        {stats.map(stat => (
          <div key={stat.label} className="min-w-0">
            <dt className="text-muted-foreground mb-0.5 flex items-center gap-1.5 text-xs">
              {stat.icon}
              {stat.label}
            </dt>
            <dd className="text-foreground text-sm font-medium [overflow-wrap:anywhere]">
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/**
 * Footage recorded in the breadcrumbs, counted per camera. The full file list
 * stays on the Files tab; this answers "is every camera there" at a glance.
 */
const FootageSummary: React.FC<{ files?: FileInfo[] }> = ({ files }) => {
  if (!files || files.length === 0) return null

  const perCamera = new Map<number, number>()
  for (const file of files) {
    perCamera.set(file.camera, (perCamera.get(file.camera) ?? 0) + 1)
  }
  const cameras = [...perCamera.entries()].sort((a, b) => a[0] - b[0])

  return (
    <section>
      <h4 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
        Footage
      </h4>
      <ul className="border-border divide-border divide-y rounded-lg border text-sm">
        {cameras.map(([camera, count]) => (
          <li key={camera} className="flex items-center justify-between px-3 py-1.5">
            <span>Camera {camera}</span>
            <span className="text-muted-foreground tabular-nums">
              {count} file{count !== 1 ? 's' : ''}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * A video title without the project's own name in front of it. Renders are
 * usually named "<project> - Final v3"; inside the project's panel only
 * "Final v3" tells the videos apart.
 */
function withoutProjectPrefix(title: string, projectTitle: string): string {
  if (!projectTitle || !title.startsWith(projectTitle)) return title
  const rest = title.slice(projectTitle.length).replace(/^[\s\-–:·]+/, '')
  return rest || title
}

/**
 * Why linked videos and cards cannot be shown, or undefined when they can.
 * Links live in breadcrumbs.json, so without a readable file "none" is not
 * something the panel knows.
 */
function linksUnavailableReason(project: ProjectFolder | null): string | undefined {
  if (!project) return undefined
  if (project.invalidBreadcrumbs) {
    return 'Links are stored in the breadcrumbs file. Repair it to see them.'
  }
  if (!project.hasBreadcrumbs) {
    return 'Links are stored in the breadcrumbs file. Create it to add videos or Trello cards.'
  }
  return undefined
}

interface LinkedResourcesProps {
  projectPath: string
  breadcrumbs: BreadcrumbsFile
  /** Shown in place of the empty state when links cannot be known. */
  unavailableReason?: string
  trelloApiKey?: string
  trelloApiToken?: string
}

const extractCardId = (url: string): string | null => {
  const match = url.match(/\/c\/([a-zA-Z0-9]+)/)
  return match ? match[1] : null
}

const LinkedResources: React.FC<LinkedResourcesProps> = ({
  projectPath,
  breadcrumbs,
  unavailableReason,
  trelloApiKey,
  trelloApiToken
}) => {
  const manager = useTrelloCardsManager({ projectPath, trelloApiKey, trelloApiToken })
  const [pendingMigration, setPendingMigration] = useState(false)

  const legacyUrl = breadcrumbs.trelloCardUrl
  const legacyCardId = legacyUrl ? extractCardId(legacyUrl) : null
  const linkedCards: TrelloCard[] = manager.trelloCards ?? []
  const videoLinks: VideoLink[] = breadcrumbs.videoLinks ?? []

  const cardIds = useMemo(
    () => (manager.trelloCards ?? []).map(card => card.cardId),
    [manager.trelloCards]
  )
  const assignment = useTrelloSelfAssignment({ cardIds, trelloApiKey, trelloApiToken })

  // Hide the legacy row once a linked card with the same id exists (migrated)
  const legacyMigrated =
    legacyCardId !== null && linkedCards.some(card => card.cardId === legacyCardId)
  const showLegacy = !!legacyUrl && !legacyMigrated

  const { setCardUrl, handleFetchAndAdd, cardUrl } = manager

  // Migration runs in two steps: stage the URL, then add once state settles so
  // handleFetchAndAdd reads the staged value instead of a stale closure.
  useEffect(() => {
    if (pendingMigration && legacyUrl && cardUrl === legacyUrl) {
      handleFetchAndAdd().then(() => {
        setPendingMigration(false)
        toast.success('Legacy Trello card added to linked cards')
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMigration, cardUrl, legacyUrl])

  const handleMigrate = () => {
    if (!legacyUrl) return
    setCardUrl(legacyUrl)
    setPendingMigration(true)
  }

  const isEmpty = linkedCards.length === 0 && videoLinks.length === 0 && !showLegacy

  return (
    <div>
      <h4 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
        Linked resources
      </h4>

      {isEmpty ? (
        <p className="text-muted-foreground text-sm">
          {unavailableReason ??
            'No linked resources yet. Add videos or link Trello cards from their tabs.'}
        </p>
      ) : (
        <div className="space-y-2">
          {linkedCards.map(card => (
            <ResourceRow
              key={card.cardId}
              icon={<CreditCard className="h-4 w-4" />}
              iconClass="bg-primary/10 text-primary"
              title={card.title}
              subtitle={`Trello${card.boardName ? ` · ${card.boardName}` : ''}`}
              onOpen={() => openInShell(card.url)}
              canAssign={assignment.canAssign}
              isAssigned={assignment.isAssigned(card.cardId)}
              isAssignmentLoading={assignment.isCardLoading(card.cardId)}
              isAssignmentToggling={assignment.isToggling(card.cardId)}
              onToggleAssign={() => assignment.toggleAssignment(card.cardId)}
            />
          ))}

          {videoLinks.map(video => (
            <ResourceRow
              key={video.url}
              icon={<Video className="h-4 w-4" />}
              iconClass="bg-muted text-muted-foreground"
              title={withoutProjectPrefix(video.title, breadcrumbs.projectTitle)}
              subtitle={`Sprout Video${
                video.uploadDate
                  ? ` · uploaded ${formatOverviewDate(video.uploadDate)}`
                  : ''
              }`}
              onOpen={() => openInShell(video.url)}
            />
          ))}

          {showLegacy && legacyUrl && (
            <div className="border-warning/30 flex items-center gap-3 rounded-lg border border-dashed p-3">
              <div className="bg-warning/15 text-warning-text flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg">
                <CreditCard className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                  Legacy Trello card
                  <span className="bg-warning/20 text-warning-text rounded-full px-2 py-0.5 text-xs font-medium">
                    Legacy
                  </span>
                </p>
                <p className="text-muted-foreground text-xs [overflow-wrap:anywhere]">
                  {legacyUrl} · deprecated — migrate to a linked card
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleMigrate}
                disabled={pendingMigration || manager.isFetchingCard}
                className="flex-shrink-0 gap-1.5"
              >
                {pendingMigration || manager.isFetchingCard ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Migrating…
                  </>
                ) : (
                  'Migrate'
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openInShell(legacyUrl)}
                className="flex-shrink-0 gap-1.5"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface ResourceRowProps {
  icon: React.ReactNode
  iconClass: string
  title: string
  subtitle: string
  onOpen: () => void
  /** Whether self-assignment is available for this resource (Trello cards only) */
  canAssign?: boolean
  /** Whether the current user is assigned to this card */
  isAssigned?: boolean
  /** Whether this card's membership is still loading */
  isAssignmentLoading?: boolean
  /** Whether an assignment toggle is in flight for this card */
  isAssignmentToggling?: boolean
  /** Toggle the current user's assignment to this card */
  onToggleAssign?: () => void
}

const ResourceRow: React.FC<ResourceRowProps> = ({
  icon,
  iconClass,
  title,
  subtitle,
  onOpen,
  canAssign,
  isAssigned,
  isAssignmentLoading,
  isAssignmentToggling,
  onToggleAssign
}) => (
  <div className="border-border hover:bg-accent/30 flex items-center gap-3 rounded-lg border p-3 transition-colors">
    <div
      className={cn(
        'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg',
        iconClass
      )}
    >
      {icon}
    </div>
    <div className="min-w-0 flex-1">
      {/* One line each; the full title is in the tooltip */}
      <p
        className="text-foreground truncate text-sm font-medium"
        title={typeof title === 'string' ? title : undefined}
      >
        {title}
      </p>
      <p className="text-muted-foreground truncate text-xs">{subtitle}</p>
    </div>
    {canAssign && onToggleAssign && (
      <Button
        variant={isAssigned ? 'secondary' : 'outline'}
        size="sm"
        onClick={onToggleAssign}
        disabled={isAssignmentToggling || isAssignmentLoading}
        className="flex-shrink-0 gap-1.5"
        title={
          isAssigned ? 'Unassign yourself from this card' : 'Assign yourself to this card'
        }
      >
        {isAssignmentToggling || isAssignmentLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : isAssigned ? (
          <UserCheck className="h-3.5 w-3.5" />
        ) : (
          <UserPlus className="h-3.5 w-3.5" />
        )}
        {isAssigned ? 'Assigned' : 'Assign me'}
      </Button>
    )}
    <Button
      variant="outline"
      size="sm"
      onClick={onOpen}
      className="flex-shrink-0 gap-1.5"
    >
      <ExternalLink className="h-3.5 w-3.5" />
      Open
    </Button>
  </div>
)

const VIDEO_EXTENSIONS = ['mp4', 'mov', 'mxf', 'avi', 'm4v']
const AUDIO_EXTENSIONS = ['wav', 'mp3', 'aif', 'aiff', 'm4a']

const fileIcon = (name: string) => {
  const extension = name.split('.').pop()?.toLowerCase() ?? ''
  if (VIDEO_EXTENSIONS.includes(extension)) {
    return <FileVideo className="text-muted-foreground h-4 w-4 flex-shrink-0" />
  }
  if (AUDIO_EXTENSIONS.includes(extension)) {
    return <FileAudio className="text-muted-foreground h-4 w-4 flex-shrink-0" />
  }
  return <File className="text-muted-foreground h-4 w-4 flex-shrink-0" />
}

const FilesTab: React.FC<{ files?: FileInfo[] }> = ({ files }) => {
  const [query, setQuery] = useState('')
  const [collapsedCameras, setCollapsedCameras] = useState<Set<number>>(new Set())

  // Every recorded path in one batched call (issue #168). One probe per rendered
  // row would be one IPC message per row - hundreds on a normal shoot. Probing
  // the whole set rather than the filtered set also means the summary count does
  // not change as the user types in the filter box.
  const allPaths = useMemo(() => (files ?? []).map(file => file.path), [files])
  const { isPresent, missingCount, probedCount } = useVerifiedPaths(allPaths)

  const cameraGroups = useMemo(() => {
    const filtered = (files ?? []).filter(
      file =>
        query.trim() === '' ||
        file.name.toLowerCase().includes(query.toLowerCase()) ||
        file.path.toLowerCase().includes(query.toLowerCase())
    )
    const groups = new Map<number, FileInfo[]>()
    for (const file of filtered) {
      const group = groups.get(file.camera) ?? []
      group.push(file)
      groups.set(file.camera, group)
    }
    return [...groups.entries()].sort(([a], [b]) => a - b)
  }, [files, query])

  if (!files || files.length === 0) {
    return (
      <div className="text-muted-foreground py-8 text-center">
        <File className="mx-auto mb-3 h-12 w-12 opacity-50" />
        <p className="text-sm">No files recorded in breadcrumbs</p>
      </div>
    )
  }

  const toggleCamera = (camera: number) => {
    setCollapsedCameras(prev => {
      const next = new Set(prev)
      if (next.has(camera)) {
        next.delete(camera)
      } else {
        next.add(camera)
      }
      return next
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input
          placeholder="Filter files…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="h-8 max-w-64 text-xs"
        />
        {/*
          The aggregate goes in the pill and the individual mark goes on the
          row. A pill per row would be noise at a few hundred files, and the
          honest headline is how many of the recorded paths this machine cannot
          find - not that any one of them is broken, since these paths are
          routinely authored elsewhere and may be perfectly valid there.
        */}
        {missingCount !== undefined && missingCount > 0 && (
          <HeaderPill tone="warning">
            {missingCount} of {probedCount} file{probedCount !== 1 ? 's' : ''} not found
            on this machine
          </HeaderPill>
        )}
        <span className="text-muted-foreground ml-auto text-xs whitespace-nowrap">
          {files.length} file{files.length !== 1 ? 's' : ''}
        </span>
      </div>

      {cameraGroups.length === 0 && (
        <p className="text-muted-foreground text-center text-sm">
          No files match the current filter
        </p>
      )}

      {cameraGroups.map(([camera, cameraFiles]) => {
        const isCollapsed = collapsedCameras.has(camera)
        return (
          <div key={camera}>
            <button
              type="button"
              onClick={() => toggleCamera(camera)}
              className="text-muted-foreground hover:text-foreground mb-1.5 flex items-center gap-1.5 text-xs font-semibold transition-colors"
            >
              <ChevronRight
                className={cn(
                  'h-3.5 w-3.5 transition-transform',
                  !isCollapsed && 'rotate-90'
                )}
              />
              <Camera className="h-3.5 w-3.5" />
              Camera {camera}
              <span className="font-normal">
                · {cameraFiles.length} file{cameraFiles.length !== 1 ? 's' : ''}
              </span>
            </button>

            {!isCollapsed && (
              <div className="space-y-1.5">
                {cameraFiles.map((file, index) => {
                  const notFound = isPresent(file.path) === false
                  return (
                    <div
                      key={`${file.path}-${index}`}
                      className="bg-background border-border hover:bg-accent/50 flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors"
                    >
                      {fileIcon(file.name)}
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            'text-sm font-medium [overflow-wrap:anywhere]',
                            notFound && 'line-through'
                          )}
                        >
                          {file.name}
                        </p>
                        <p
                          className={cn(
                            'text-muted-foreground truncate text-xs',
                            notFound && 'line-through'
                          )}
                          title={
                            notFound
                              ? `Not found on this machine: ${file.path}`
                              : file.path
                          }
                        >
                          {file.path}
                        </p>
                      </div>
                      {notFound && (
                        <AlertTriangle
                          role="img"
                          aria-label="Not found on this machine"
                          className="text-warning-text h-4 w-4 flex-shrink-0"
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
