/**
 * Project Detail Panel Component
 *
 * Right panel of the master-detail layout. Shows the selected project's
 * breadcrumbs in real tabs (Overview / Files / Videos / Trello), with a
 * breadcrumbs status callout that lazily generates a change preview and a
 * linked-resources hub that demotes the legacy Trello card field.
 */

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
  HardDrive,
  RefreshCw,
  Search,
  User,
  Video
} from 'lucide-react'
import { toast } from 'sonner'
import React, { useEffect, useMemo, useState } from 'react'

import { openInShell } from '../api'
import { formatFileSize } from '../internal/fieldUtils'
import { buildProjectChangeRows } from '../utils/changeRows'
import { Button } from '@shared/ui/button'
import { Input } from '@shared/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/ui/tabs'
import type {
  BreadcrumbsFile,
  BreadcrumbsPreview,
  FileInfo,
  ProjectFolder,
  TrelloCard,
  VideoLink
} from '../types'

import { TrelloCardsManager, useTrelloCardsManager } from '@features/Trello'
import { cn, formatBreadcrumbDateSimple } from '@shared/utils'
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
  trelloApiKey,
  trelloApiToken
}) => {
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
              <TabsTrigger value="videos">
                Videos
                <CountPill count={breadcrumbs.videoLinks?.length ?? 0} />
              </TabsTrigger>
              <TabsTrigger value="trello">
                Trello
                <CountPill count={breadcrumbs.trelloCards?.length ?? 0} />
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <TabsContent value="overview" className="mt-0 space-y-5">
              <BreadcrumbsCallout
                project={project}
                preview={preview}
                isGeneratingPreview={isGeneratingPreview}
                onGeneratePreview={onGeneratePreview}
              />
              <OverviewStats breadcrumbs={breadcrumbs} />
              <LinkedResources
                projectPath={projectPath}
                breadcrumbs={breadcrumbs}
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

  const handleCopyPath = async () => {
    try {
      await navigator.clipboard.writeText(projectPath)
      toast.success('Project path copied')
    } catch {
      toast.error('Failed to copy path')
    }
  }

  return (
    <div className="border-border space-y-2 border-b p-4">
      <h3 className="text-foreground leading-snug font-semibold [overflow-wrap:anywhere]">
        {title}
      </h3>
      <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <span className="min-w-0 [overflow-wrap:anywhere]">{parentPath}</span>
        <button
          type="button"
          onClick={handleCopyPath}
          title="Copy project path"
          className="hover:text-foreground hover:bg-accent flex-shrink-0 rounded p-0.5 transition-colors"
        >
          <Copy className="h-3 w-3" />
        </button>
      </div>
      {project && (
        <div className="flex flex-wrap gap-1.5">
          <HeaderPill tone={project.isValid ? 'success' : 'destructive'}>
            {project.isValid ? 'Valid structure' : 'Invalid structure'}
          </HeaderPill>
          <BreadcrumbsStatusPill project={project} />
          {cameraCount !== undefined && (
            <HeaderPill tone="muted">
              {cameraCount} camera{cameraCount !== 1 ? 's' : ''}
            </HeaderPill>
          )}
        </div>
      )}
    </div>
  )
}

const BreadcrumbsStatusPill: React.FC<{ project: ProjectFolder }> = ({ project }) => {
  if (project.invalidBreadcrumbs) {
    return <HeaderPill tone="destructive">Breadcrumbs unparseable</HeaderPill>
  }
  if (!project.hasBreadcrumbs) {
    return <HeaderPill tone="muted">No breadcrumbs</HeaderPill>
  }
  return (
    <HeaderPill tone={project.staleBreadcrumbs ? 'warning' : 'success'}>
      {project.staleBreadcrumbs ? 'Breadcrumbs stale' : 'Breadcrumbs current'}
    </HeaderPill>
  )
}

const HEADER_PILL_TONES = {
  success: 'bg-success/20 text-success',
  warning: 'bg-warning/20 text-warning',
  destructive: 'bg-destructive/20 text-destructive',
  muted: 'bg-muted text-muted-foreground'
} as const

const HeaderPill: React.FC<{
  tone: keyof typeof HEADER_PILL_TONES
  children: React.ReactNode
}> = ({ tone, children }) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
      HEADER_PILL_TONES[tone]
    )}
  >
    <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-current" />
    {children}
  </span>
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
}

function calloutHeadline(project: ProjectFolder): string {
  if (project.invalidBreadcrumbs) return 'Breadcrumbs file is unparseable'
  if (!project.hasBreadcrumbs) return 'No breadcrumbs file'
  return 'Breadcrumbs are out of date'
}

function calloutSubline(project: ProjectFolder, pendingCount: number | null): string {
  if (pendingCount !== null) {
    return `${pendingCount} pending change${pendingCount !== 1 ? 's' : ''} will be written on apply`
  }
  if (project.invalidBreadcrumbs) {
    return 'It will be rebuilt on the next apply (a backup will be saved)'
  }
  if (!project.hasBreadcrumbs) {
    return 'Applying changes will create one for this project'
  }
  return 'Folder contents have changed since the last bake'
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

const BreadcrumbsCallout: React.FC<BreadcrumbsCalloutProps> = ({
  project,
  preview,
  isGeneratingPreview,
  onGeneratePreview
}) => {
  if (!project) return null

  const needsAttention =
    project.invalidBreadcrumbs || !project.hasBreadcrumbs || project.staleBreadcrumbs
  if (!needsAttention) return null

  const isDestructive = project.invalidBreadcrumbs
  const changes = preview ? buildProjectChangeRows(preview) : null

  const headline = calloutHeadline(project)
  const subline = calloutSubline(project, changes ? changes.rows.length : null)
  const note = calloutNote(project, changes?.isNewBreadcrumbs ?? false)

  return (
    <div className="space-y-2">
      <div
        className={cn(
          'flex items-center gap-3 rounded-lg border p-3',
          isDestructive
            ? 'border-destructive/20 bg-destructive/5'
            : 'border-warning/20 bg-warning/5'
        )}
      >
        <AlertTriangle
          className={cn(
            'h-4 w-4 flex-shrink-0',
            isDestructive ? 'text-destructive' : 'text-warning'
          )}
        />
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'text-sm font-semibold',
              isDestructive ? 'text-destructive' : 'text-warning'
            )}
          >
            {headline}
          </p>
          <p className="text-muted-foreground text-xs">{subline}</p>
        </div>
        {!preview && (
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
              <>
                <Search className="h-3.5 w-3.5" />
                Preview changes
              </>
            )}
          </Button>
        )}
      </div>

      {changes && (
        <div className="border-border rounded-lg border py-1.5">
          <ChangeDiffList
            rows={changes.rows}
            maintenanceFields={changes.maintenanceFields}
            note={note}
          />
        </div>
      )}
    </div>
  )
}

const OverviewStats: React.FC<{ breadcrumbs: BreadcrumbsFile }> = ({ breadcrumbs }) => {
  const formatDate = formatBreadcrumbDateSimple

  const stats: Array<{ icon: React.ReactNode; label: string; value: string }> = [
    {
      icon: <Camera className="h-3 w-3" />,
      label: 'Cameras',
      value: String(breadcrumbs.numberOfCameras)
    },
    {
      icon: <HardDrive className="h-3 w-3" />,
      label: 'Folder Size',
      value: breadcrumbs.folderSizeBytes
        ? formatFileSize(breadcrumbs.folderSizeBytes)
        : 'Unknown'
    },
    {
      icon: <User className="h-3 w-3" />,
      label: 'Created By',
      value: breadcrumbs.createdBy
    },
    {
      icon: <Calendar className="h-3 w-3" />,
      label: 'Created',
      value: formatDate(breadcrumbs.creationDateTime)
    }
  ]

  if (breadcrumbs.lastModified) {
    stats.push({
      icon: <Calendar className="h-3 w-3" />,
      label: 'Last Modified',
      value: formatDate(breadcrumbs.lastModified)
    })
  }
  if (breadcrumbs.scannedBy) {
    stats.push({
      icon: <Search className="h-3 w-3" />,
      label: 'Scanned By',
      value: breadcrumbs.scannedBy
    })
  }

  return (
    <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
      {stats.map((stat) => (
        <div key={stat.label} className="bg-muted/40 border-border rounded-lg border p-3">
          <div className="text-muted-foreground mb-1 flex items-center gap-1.5 text-xs font-medium">
            {stat.icon}
            {stat.label}
          </div>
          <p className="text-foreground text-sm font-medium [overflow-wrap:anywhere]">
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  )
}

interface LinkedResourcesProps {
  projectPath: string
  breadcrumbs: BreadcrumbsFile
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
  trelloApiKey,
  trelloApiToken
}) => {
  const manager = useTrelloCardsManager({ projectPath, trelloApiKey, trelloApiToken })
  const [pendingMigration, setPendingMigration] = useState(false)

  const legacyUrl = breadcrumbs.trelloCardUrl
  const legacyCardId = legacyUrl ? extractCardId(legacyUrl) : null
  const linkedCards: TrelloCard[] = manager.trelloCards ?? []
  const videoLinks: VideoLink[] = breadcrumbs.videoLinks ?? []

  // Hide the legacy row once a linked card with the same id exists (migrated)
  const legacyMigrated =
    legacyCardId !== null && linkedCards.some((card) => card.cardId === legacyCardId)
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
          No linked resources yet — add videos or link Trello cards from their tabs.
        </p>
      ) : (
        <div className="space-y-2">
          {linkedCards.map((card) => (
            <ResourceRow
              key={card.cardId}
              icon={<CreditCard className="h-4 w-4" />}
              iconClass="bg-primary/10 text-primary"
              title={card.title}
              subtitle={`Trello${card.boardName ? ` · ${card.boardName}` : ''}`}
              onOpen={() => openInShell(card.url)}
            />
          ))}

          {videoLinks.map((video) => (
            <ResourceRow
              key={video.url}
              icon={<Video className="h-4 w-4" />}
              iconClass="bg-muted text-muted-foreground"
              title={video.title}
              subtitle={`Sprout Video${
                video.uploadDate
                  ? ` · uploaded ${formatBreadcrumbDateSimple(video.uploadDate)}`
                  : ''
              }`}
              onOpen={() => openInShell(video.url)}
            />
          ))}

          {showLegacy && legacyUrl && (
            <div className="border-warning/30 flex items-center gap-3 rounded-lg border border-dashed p-3">
              <div className="bg-warning/15 text-warning flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg">
                <CreditCard className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                  Legacy Trello card
                  <span className="bg-warning/20 text-warning rounded-full px-2 py-0.5 text-xs font-medium">
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
}

const ResourceRow: React.FC<ResourceRowProps> = ({
  icon,
  iconClass,
  title,
  subtitle,
  onOpen
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
      <p className="text-foreground text-sm font-medium [overflow-wrap:anywhere]">
        {title}
      </p>
      <p className="text-muted-foreground text-xs">{subtitle}</p>
    </div>
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

  const cameraGroups = useMemo(() => {
    const filtered = (files ?? []).filter(
      (file) =>
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
    setCollapsedCameras((prev) => {
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
          onChange={(e) => setQuery(e.target.value)}
          className="h-8 max-w-64 text-xs"
        />
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
                {cameraFiles.map((file, index) => (
                  <div
                    key={`${file.path}-${index}`}
                    className="bg-background border-border hover:bg-accent/50 flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors"
                  >
                    {fileIcon(file.name)}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium [overflow-wrap:anywhere]">
                        {file.name}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">
                        {file.path}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
