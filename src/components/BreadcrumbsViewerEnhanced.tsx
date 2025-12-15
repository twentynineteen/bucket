/**
 * Enhanced BreadcrumbsViewer Component with Change Preview
 *
 * Displays breadcrumbs.json files with side-by-side preview of changes
 * that Baker will make during updates.
 */

import { Eye, EyeOff, File } from 'lucide-react'
import React from 'react'

import type { BreadcrumbsViewerProps } from '@/types/baker'

import { NormalView } from './BreadcrumbsViewer/NormalView'
import { PreviewComparison } from './BreadcrumbsViewer/PreviewComparison'
import { Button } from './ui/button'

export const BreadcrumbsViewerEnhanced: React.FC<BreadcrumbsViewerProps> = ({
  breadcrumbs,
  projectPath,
  previewMode = false,
  preview,
  onTogglePreview,
  trelloApiKey,
  trelloApiToken
}) => {
  return (
    <div className="bg-muted/50 space-y-4 rounded-lg p-4 text-sm">
      <div className="border-border border-b pb-2">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-foreground flex items-center font-semibold">
              <File className="mr-2 h-4 w-4" />
              Breadcrumbs.json
              {previewMode && (
                <span className="bg-primary/20 text-primary ml-2 rounded px-2 py-1 text-xs">
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

      {previewMode && preview ? (
        <PreviewComparison preview={preview} />
      ) : (
        <NormalView
          breadcrumbs={breadcrumbs}
          projectPath={projectPath}
          trelloApiKey={trelloApiKey}
          trelloApiToken={trelloApiToken}
        />
      )}
    </div>
  )
}
