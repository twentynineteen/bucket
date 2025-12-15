/**
 * BreadcrumbsViewer Component
 *
 * Displays the contents of a breadcrumbs.json file in a readable format.
 */

import { formatBreadcrumbDateSimple } from '@utils/breadcrumbsComparison'
import {
  Calendar,
  Camera,
  Eye,
  EyeOff,
  File,
  FolderOpen,
  HardDrive,
  User
} from 'lucide-react'
import React from 'react'

import type { BreadcrumbsViewerProps } from '@/types/baker'

import { Button } from './ui/button'

export const BreadcrumbsViewer: React.FC<BreadcrumbsViewerProps> = ({
  breadcrumbs,
  projectPath,
  previewMode = false,
  onTogglePreview
}) => {
  // Use centralized date formatting utility
  const formatDate = formatBreadcrumbDateSimple

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="bg-muted space-y-4 rounded-lg p-4 text-sm">
      <div className="border-b pb-2">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-foreground flex items-center font-semibold">
              <File className="mr-2 h-4 w-4" />
              Breadcrumbs.json
              {previewMode && (
                <span className="bg-info/10 text-info ml-2 rounded px-2 py-1 text-xs">
                  Preview Mode
                </span>
              )}
            </h4>
            <p className="text-muted-foreground mt-1 text-xs">{projectPath}</p>
          </div>
          {onTogglePreview && (
            <Button
              variant="outline"
              size="sm"
              onClick={onTogglePreview}
              className="flex items-center"
            >
              {previewMode ? (
                <>
                  <EyeOff className="mr-1 h-4 w-4" />
                  Hide Preview
                </>
              ) : (
                <>
                  <Eye className="mr-1 h-4 w-4" />
                  Preview Changes
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Project Info */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-muted-foreground block text-xs font-medium">
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

      {/* Modification Info */}
      {(breadcrumbs.lastModified || breadcrumbs.scannedBy) && (
        <div className="grid grid-cols-2 gap-4">
          {breadcrumbs.lastModified && (
            <div>
              <label className="text-muted-foreground block text-xs font-medium">
                Last Modified
              </label>
              <p className="text-foreground">{formatDate(breadcrumbs.lastModified)}</p>
            </div>
          )}
          {breadcrumbs.scannedBy && (
            <div>
              <label className="text-muted-foreground block text-xs font-medium">
                Scanned By
              </label>
              <p className="text-foreground">{breadcrumbs.scannedBy}</p>
            </div>
          )}
        </div>
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
      {breadcrumbs.files && breadcrumbs.files.length > 0 && (
        <div>
          <label className="text-muted-foreground mb-2 block text-xs font-medium">
            Files ({breadcrumbs.files.length})
          </label>
          <div className="max-h-32 space-y-1 overflow-y-auto">
            {breadcrumbs.files.map((file, index) => (
              <div
                key={index}
                className="bg-background flex items-center justify-between rounded p-2"
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
      )}

      {(!breadcrumbs.files || breadcrumbs.files.length === 0) && (
        <div className="text-muted-foreground py-4 text-center">
          <File className="mx-auto mb-2 h-8 w-8 opacity-50" />
          <p className="text-xs">No files recorded in breadcrumbs</p>
        </div>
      )}
    </div>
  )
}
