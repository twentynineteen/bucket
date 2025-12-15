/**
 * TrelloCardItem - Displays a single Trello card with title and actions
 * Feature: 004-embed-multiple-video
 */

import { openUrl } from '@tauri-apps/plugin-opener'
import { ExternalLink, RefreshCw, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { TrelloCard } from '@/types/baker'
import { logger } from '@/utils/logger'

interface TrelloCardItemProps {
  trelloCard: TrelloCard
  onRemove: () => void
  onRefresh?: () => void
}

export function TrelloCardItem({ trelloCard, onRemove, onRefresh }: TrelloCardItemProps) {
  const getRelativeTime = (isoDate?: string) => {
    if (!isoDate) return null

    const date = new Date(isoDate)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'today'
    if (diffDays === 1) return 'yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
    return `${Math.floor(diffDays / 365)} years ago`
  }

  const isStale = (isoDate?: string) => {
    if (!isoDate) return false
    const date = new Date(isoDate)
    const now = new Date()
    const diffDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    return diffDays > 7
  }

  const openInBrowser = async () => {
    try {
      await openUrl(trelloCard.url)
    } catch (error) {
      logger.error('Failed to open Trello URL:', error)
    }
  }

  const stale = isStale(trelloCard.lastFetched)

  return (
    <tr className="hover:bg-accent/50 transition-colors">
      {/* Title */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex-shrink-0">
            <div className="bg-info/10 flex h-8 w-8 items-center justify-center rounded">
              <svg viewBox="0 0 24 24" className="text-info h-4 w-4" fill="currentColor">
                <path d="M21 0H3C1.343 0 0 1.343 0 3v18c0 1.656 1.343 3 3 3h18c1.656 0 3-1.344 3-3V3c0-1.657-1.344-3-3-3zM10.44 18.18c0 .795-.645 1.44-1.44 1.44H4.56c-.795 0-1.44-.646-1.44-1.44V4.56c0-.795.645-1.44 1.44-1.44H9c.795 0 1.44.645 1.44 1.44v13.62zm10.44-6c0 .794-.645 1.44-1.44 1.44H15c-.795 0-1.44-.646-1.44-1.44V4.56c0-.795.645-1.44 1.44-1.44h4.44c.795 0 1.44.645 1.44 1.44v7.62z" />
              </svg>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-foreground truncate text-sm font-medium">
              {trelloCard.title}
            </p>
            <p className="text-muted-foreground text-xs">ID: {trelloCard.cardId}</p>
          </div>
        </div>
      </td>

      {/* Board */}
      <td className="px-4 py-3">
        <p className="text-foreground truncate text-sm">
          {trelloCard.boardName || (
            <span className="text-muted-foreground italic">Unknown</span>
          )}
        </p>
      </td>

      {/* Last Updated */}
      <td className="px-4 py-3">
        {trelloCard.lastFetched ? (
          <div>
            <p className={`text-sm ${stale ? 'text-warning' : 'text-foreground'}`}>
              {getRelativeTime(trelloCard.lastFetched)}
            </p>
            {stale && <p className="text-warning text-xs">Stale</p>}
          </div>
        ) : (
          <span className="text-muted-foreground text-sm italic">Never</span>
        )}
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={openInBrowser}
            className="h-7 text-xs"
          >
            <ExternalLink className="mr-1 h-3 w-3" />
            Open
          </Button>
          {onRefresh && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onRefresh}
              className={`h-7 w-7 ${stale ? 'text-warning hover:text-warning/90' : 'text-muted-foreground hover:text-foreground'}`}
              title={stale ? 'Refresh stale card details' : 'Refresh card details'}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            className="text-destructive hover:text-destructive/90 h-7 w-7"
            title="Remove card"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  )
}
