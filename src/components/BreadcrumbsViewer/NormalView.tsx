/**
 * NormalView - Standard breadcrumbs display (non-preview mode)
 * Extracted from BreadcrumbsViewerEnhanced.tsx (DEBT-002)
 */

import { open } from '@tauri-apps/plugin-shell'
import { formatBreadcrumbDateSimple } from '@utils/breadcrumbsComparison'
import {
  Calendar,
  Camera,
  ExternalLink,
  File,
  FolderOpen,
  HardDrive,
  User
} from 'lucide-react'
import React from 'react'

import type { BreadcrumbsFile } from '@/types/baker'

import { TrelloCardsManager } from '../Baker/TrelloCardsManager'
import { VideoLinksManager } from '../Baker/VideoLinksManager'
import { Button } from '../ui/button'
import { formatFileSize } from './fieldUtils'

interface NormalViewProps {
  breadcrumbs: BreadcrumbsFile
  projectPath: string
  trelloApiKey?: string
  trelloApiToken?: string
}

export const NormalView: React.FC<NormalViewProps> = ({
  breadcrumbs,
  projectPath,
  trelloApiKey,
  trelloApiToken
}) => {
  const formatDate = formatBreadcrumbDateSimple

  return (
    <div className="space-y-4">
      {/* Project Info */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-muted-foreground flex items-center text-xs font-medium">
            Project Title
          </label>
          <p className="text-foreground">{breadcrumbs.projectTitle}</p>
        </div>
        <div>
          <label className="text-muted-foreground flex items-center text-xs font-medium">
            <Camera className="mr-1 h-3 w-3" />
            Cameras
          </label>
          <p className="text-foreground">{breadcrumbs.numberOfCameras}</p>
        </div>
      </div>

      {/* Creation Info */}
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

      {/* Folder Size */}
      <div>
        <label className="text-muted-foreground flex items-center text-xs font-medium">
          <HardDrive className="mr-1 h-3 w-3" />
          Folder Size
        </label>
        <p className="text-foreground">
          {breadcrumbs.folderSizeBytes
            ? formatFileSize(breadcrumbs.folderSizeBytes)
            : 'Unknown value - update breadcrumb file'}
        </p>
      </div>

      {/* Trello Card URL */}
      {breadcrumbs.trelloCardUrl && <TrelloCardLink url={breadcrumbs.trelloCardUrl} />}

      {/* Modification Info */}
      {(breadcrumbs.lastModified || breadcrumbs.scannedBy) && (
        <ModificationInfo
          lastModified={breadcrumbs.lastModified}
          scannedBy={breadcrumbs.scannedBy}
          formatDate={formatDate}
        />
      )}

      {/* Parent Folder */}
      <div>
        <label className="text-muted-foreground flex items-center text-xs font-medium">
          <FolderOpen className="mr-1 h-3 w-3" />
          Parent Folder
        </label>
        <p className="text-foreground truncate text-xs">{breadcrumbs.parentFolder}</p>
      </div>

      {/* Files List */}
      <FilesList files={breadcrumbs.files} />

      {/* Video Links Section - Feature 004 */}
      <div className="border-border mt-4 border-t pt-4">
        <VideoLinksManager projectPath={projectPath} />
      </div>

      {/* Trello Cards Section - Feature 004 */}
      <div className="border-border mt-4 border-t pt-4">
        <TrelloCardsManager
          projectPath={projectPath}
          trelloApiKey={trelloApiKey}
          trelloApiToken={trelloApiToken}
        />
      </div>
    </div>
  )
}

// Sub-components

interface TrelloCardLinkProps {
  url: string
}

const TrelloCardLink: React.FC<TrelloCardLinkProps> = ({ url }) => (
  <div>
    <label className="text-muted-foreground flex items-center text-xs font-medium">
      <ExternalLink className="mr-1 h-3 w-3" />
      Trello Card
    </label>
    <div className="flex items-center space-x-2">
      <p className="text-foreground flex-1 truncate text-xs">{url}</p>
      <Button
        variant="outline"
        size="sm"
        onClick={async () => {
          await open(url)
        }}
        className="h-6 px-2 py-1 text-xs"
      >
        <ExternalLink className="mr-1 h-3 w-3" />
        Open
      </Button>
    </div>
  </div>
)

interface ModificationInfoProps {
  lastModified?: string
  scannedBy?: string
  formatDate: (date: string) => string
}

const ModificationInfo: React.FC<ModificationInfoProps> = ({
  lastModified,
  scannedBy,
  formatDate
}) => (
  <div className="grid grid-cols-2 gap-4">
    {lastModified && (
      <div>
        <label className="text-muted-foreground text-xs font-medium">Last Modified</label>
        <p className="text-foreground">{formatDate(lastModified)}</p>
      </div>
    )}
    {scannedBy && (
      <div>
        <label className="text-muted-foreground text-xs font-medium">Scanned By</label>
        <p className="text-foreground">{scannedBy}</p>
      </div>
    )}
  </div>
)

interface FilesListProps {
  files?: Array<{ name: string; path: string; camera: number }>
}

const FilesList: React.FC<FilesListProps> = ({ files }) => {
  if (!files || files.length === 0) {
    return (
      <div className="text-muted-foreground py-4 text-center">
        <File className="mx-auto mb-2 h-8 w-8 opacity-50" />
        <p className="text-xs">No files recorded in breadcrumbs</p>
      </div>
    )
  }

  return (
    <div>
      <label className="text-muted-foreground mb-2 text-xs font-medium">
        Files ({files.length})
      </label>
      <div className="max-h-32 space-y-1 overflow-y-auto">
        {files.map((file, index) => (
          <div
            key={index}
            className="bg-background border-border flex items-center justify-between rounded border p-2"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{file.name}</p>
              <p className="text-muted-foreground truncate text-xs">{file.path}</p>
            </div>
            <div className="text-muted-foreground flex items-center text-xs">
              <Camera className="mr-1 h-3 w-3" />
              {file.camera}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
