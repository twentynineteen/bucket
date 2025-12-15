/**
 * VideoLinkCard - Displays a single video link with thumbnail and actions
 * Feature: 004-embed-multiple-video
 */

import { openUrl } from '@tauri-apps/plugin-opener'
import { ChevronDown, ChevronUp, ExternalLink, Trash2, Video } from 'lucide-react'
import React from 'react'

import { Button } from '@/components/ui/button'
import type { VideoLink } from '@/types/baker'
import { logger } from '@/utils/logger'

interface VideoLinkCardProps {
  videoLink: VideoLink
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  canMoveUp: boolean
  canMoveDown: boolean
}

function VideoLinkCardComponent({
  videoLink,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown
}: VideoLinkCardProps) {
  const formatDate = (isoDate?: string) => {
    if (!isoDate) return null
    const date = new Date(isoDate)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const openInBrowser = async () => {
    try {
      await openUrl(videoLink.url)
    } catch (error) {
      logger.error('Failed to open video URL:', error)
    }
  }

  return (
    <div className="border-border bg-card group flex flex-col overflow-hidden rounded-lg border shadow-sm transition-shadow hover:shadow-md">
      {/* Thumbnail */}
      <div className="bg-muted relative aspect-video w-full">
        {videoLink.thumbnailUrl ? (
          <img
            src={videoLink.thumbnailUrl}
            alt={videoLink.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Video className="text-muted-foreground h-12 w-12" />
          </div>
        )}

        {/* Action buttons overlay */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            variant="secondary"
            size="icon"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            className="bg-background h-7 w-7"
            title="Move up"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            className="bg-background h-7 w-7"
            title="Move down"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            onClick={onRemove}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 h-7 w-7"
            title="Remove video"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 space-y-2 p-3">
        <h3
          className="text-foreground line-clamp-2 text-sm font-medium"
          title={videoLink.title}
        >
          {videoLink.title}
        </h3>

        {videoLink.sproutVideoId && (
          <p className="text-muted-foreground text-xs">ID: {videoLink.sproutVideoId}</p>
        )}

        <div className="text-muted-foreground space-y-1 text-xs">
          {videoLink.uploadDate && <p>Uploaded: {formatDate(videoLink.uploadDate)}</p>}
          {videoLink.sourceRenderFile && (
            <p className="truncate" title={videoLink.sourceRenderFile}>
              Source: {videoLink.sourceRenderFile}
            </p>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={openInBrowser}
          className="mt-2 h-8 w-full text-xs"
        >
          <ExternalLink className="mr-1.5 h-3 w-3" />
          Open in Sprout Video
        </Button>
      </div>
    </div>
  )
}

// Wrap with React.memo for performance optimization (Phase 1.3)
// Prevents unnecessary re-renders when props haven't changed
export const VideoLinkCard = React.memo(VideoLinkCardComponent)
