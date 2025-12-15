/**
 * Project Detail Panel Component
 *
 * Right panel showing detailed breadcrumbs information with tabs.
 * Part of master-detail layout pattern.
 */

import { open } from '@tauri-apps/plugin-shell'
import { formatBreadcrumbDateSimple } from '@utils/breadcrumbsComparison'
import {
  AlertTriangle,
  Calendar,
  Camera,
  CreditCard,
  ExternalLink,
  File,
  FolderOpen,
  HardDrive,
  RefreshCw,
  User,
  Video
} from 'lucide-react'
import React, { useRef } from 'react'

import { formatFileSize } from '@/components/BreadcrumbsViewer/fieldUtils'
import { Button } from '@/components/ui/button'
import type { BreadcrumbsFile, BreadcrumbsPreview } from '@/types/baker'

import { TrelloCardsManager } from './TrelloCardsManager'
import { VideoLinksManager } from './VideoLinksManager'

interface ProjectDetailPanelProps {
  selectedProject: string | null
  breadcrumbs: BreadcrumbsFile | null
  isLoadingBreadcrumbs: boolean
  breadcrumbsError: string | null
  previewMode: boolean
  preview: BreadcrumbsPreview | null
  onTogglePreview: () => void
  trelloApiKey?: string
  trelloApiToken?: string
}

export const ProjectDetailPanel: React.FC<ProjectDetailPanelProps> = ({
  selectedProject,
  breadcrumbs,
  isLoadingBreadcrumbs,
  breadcrumbsError,
  trelloApiKey,
  trelloApiToken
}) => {
  // Refs must be at the top level (before any conditional returns)
  const overviewRef = useRef<HTMLDivElement>(null)
  const filesRef = useRef<HTMLDivElement>(null)
  const videosRef = useRef<HTMLDivElement>(null)
  const trelloRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const scrollToSection = (ref: React.RefObject<HTMLDivElement>) => {
    if (ref.current && scrollContainerRef.current) {
      const container = scrollContainerRef.current
      const element = ref.current
      const offsetTop = element.offsetTop - container.offsetTop - 16 // 16px padding

      container.scrollTo({
        top: offsetTop,
        behavior: 'smooth'
      })
    }
  }

  // Early returns after hooks
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

  if (breadcrumbsError) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-destructive flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm">{breadcrumbsError}</span>
        </div>
      </div>
    )
  }

  if (!breadcrumbs) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center">
        <p className="text-sm">No breadcrumbs data found</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-border border-b p-4">
        <h3 className="text-foreground truncate font-semibold">
          {breadcrumbs.projectTitle}
        </h3>
        <p className="text-muted-foreground mt-0.5 truncate text-xs">
          {breadcrumbs.parentFolder}
        </p>
      </div>

      {/* Navigation Menu */}
      <div className="border-border border-b px-4 py-2">
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => scrollToSection(overviewRef)}
            className="h-8 text-xs"
          >
            <Camera className="mr-1.5 h-3 w-3" />
            Overview
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => scrollToSection(filesRef)}
            className="h-8 text-xs"
          >
            <File className="mr-1.5 h-3 w-3" />
            Files ({breadcrumbs.files?.length || 0})
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => scrollToSection(videosRef)}
            className="h-8 text-xs"
          >
            <Video className="mr-1.5 h-3 w-3" />
            Videos
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => scrollToSection(trelloRef)}
            className="h-8 text-xs"
          >
            <CreditCard className="mr-1.5 h-3 w-3" />
            Trello
          </Button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div ref={scrollContainerRef} className="flex-1 space-y-6 overflow-y-auto p-4">
        {/* Overview Section */}
        <div ref={overviewRef}>
          <h4 className="text-foreground mb-3 flex items-center text-sm font-semibold">
            <Camera className="mr-2 h-4 w-4" />
            Overview
          </h4>
          <ProjectOverview breadcrumbs={breadcrumbs} />
        </div>

        {/* Files Section */}
        <div ref={filesRef} className="pt-2">
          <h4 className="text-foreground mb-3 flex items-center text-sm font-semibold">
            <File className="mr-2 h-4 w-4" />
            Files ({breadcrumbs.files?.length || 0})
          </h4>
          <FilesList files={breadcrumbs.files} />
        </div>

        {/* Video Links Section */}
        <div ref={videosRef} className="pt-2">
          <VideoLinksManager projectPath={selectedProject} />
        </div>

        {/* Trello Cards Section */}
        <div ref={trelloRef} className="pt-2">
          <TrelloCardsManager
            projectPath={selectedProject}
            trelloApiKey={trelloApiKey}
            trelloApiToken={trelloApiToken}
          />
        </div>
      </div>
    </div>
  )
}

// Sub-components

interface ProjectOverviewProps {
  breadcrumbs: BreadcrumbsFile
}

const ProjectOverview: React.FC<ProjectOverviewProps> = ({ breadcrumbs }) => {
  const formatDate = formatBreadcrumbDateSimple

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-muted-foreground flex items-center text-xs font-medium">
            <Camera className="mr-1 h-3 w-3" />
            Cameras
          </label>
          <p className="text-foreground">{breadcrumbs.numberOfCameras}</p>
        </div>
        <div>
          <label className="text-muted-foreground flex items-center text-xs font-medium">
            <HardDrive className="mr-1 h-3 w-3" />
            Folder Size
          </label>
          <p className="text-foreground">
            {breadcrumbs.folderSizeBytes
              ? formatFileSize(breadcrumbs.folderSizeBytes)
              : 'Unknown'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-muted-foreground flex items-center text-xs font-medium">
            <User className="mr-1 h-3 w-3" />
            Created By
          </label>
          <p className="text-foreground">{breadcrumbs.createdBy}</p>
        </div>
        <div>
          <label className="text-muted-foreground flex items-center text-xs font-medium">
            <Calendar className="mr-1 h-3 w-3" />
            Created
          </label>
          <p className="text-foreground">{formatDate(breadcrumbs.creationDateTime)}</p>
        </div>
      </div>

      {(breadcrumbs.lastModified || breadcrumbs.scannedBy) && (
        <div className="grid grid-cols-2 gap-4">
          {breadcrumbs.lastModified && (
            <div>
              <label className="text-muted-foreground text-xs font-medium">
                Last Modified
              </label>
              <p className="text-foreground">{formatDate(breadcrumbs.lastModified)}</p>
            </div>
          )}
          {breadcrumbs.scannedBy && (
            <div>
              <label className="text-muted-foreground text-xs font-medium">
                Scanned By
              </label>
              <p className="text-foreground">{breadcrumbs.scannedBy}</p>
            </div>
          )}
        </div>
      )}

      {breadcrumbs.trelloCardUrl && (
        <div>
          <label className="text-muted-foreground mb-2 flex items-center text-xs font-medium">
            <ExternalLink className="mr-1 h-3 w-3" />
            Legacy Trello Card
          </label>
          <div className="flex items-center gap-2">
            <p className="text-foreground flex-1 truncate text-xs">
              {breadcrumbs.trelloCardUrl}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await open(breadcrumbs.trelloCardUrl!)
              }}
              className="h-6 flex-shrink-0 px-2 py-1 text-xs"
            >
              <ExternalLink className="mr-1 h-3 w-3" />
              Open
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

interface FilesListProps {
  files?: Array<{ name: string; path: string; camera: number }>
}

const FilesList: React.FC<FilesListProps> = ({ files }) => {
  if (!files || files.length === 0) {
    return (
      <div className="text-muted-foreground py-8 text-center">
        <File className="mx-auto mb-3 h-12 w-12 opacity-50" />
        <p className="text-sm">No files recorded in breadcrumbs</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {files.map((file, index) => (
        <div
          key={index}
          className="bg-background border-border hover:bg-accent/50 flex items-center justify-between rounded-lg border p-3 transition-colors"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-muted-foreground truncate text-xs">{file.path}</p>
          </div>
          <div className="text-muted-foreground ml-3 flex items-center gap-1.5 text-xs">
            <Camera className="h-3.5 w-3.5" />
            <span className="font-medium">{file.camera}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
