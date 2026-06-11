/**
 * Folder Selector Component
 *
 * Compact single-row toolbar for folder selection and scan control, so the
 * workspace below keeps the vertical space after a scan completes.
 */

import { FolderOpen, Play, RefreshCw, Square } from 'lucide-react'
import React, { useCallback } from 'react'

import { openFolderDialog } from '../api'
import { Button } from '@shared/ui/button'
import { Input } from '@shared/ui/input'
import { logger } from '@shared/utils'

interface FolderSelectorProps {
  selectedFolder: string
  onFolderChange: (folder: string) => void
  onStartScan: () => void
  onCancelScan: () => void
  onClearResults: () => void
  isScanning: boolean
  hasResults: boolean
  disabled?: boolean
}

export const FolderSelector: React.FC<FolderSelectorProps> = ({
  selectedFolder,
  onFolderChange,
  onStartScan,
  onCancelScan,
  onClearResults,
  isScanning,
  hasResults,
  disabled = false
}) => {
  const handleSelectFolder = useCallback(async () => {
    try {
      const selected = await openFolderDialog('Select folder to scan for projects')

      if (selected) {
        onFolderChange(selected)
      }
    } catch (error) {
      logger.error('Failed to select folder:', error)
    }
  }, [onFolderChange])

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <Input
        placeholder="No folder selected"
        value={selectedFolder}
        readOnly
        title={selectedFolder || undefined}
        className="h-8 min-w-0 flex-1 text-xs"
      />
      <Button
        onClick={handleSelectFolder}
        variant="outline"
        size="sm"
        disabled={disabled || isScanning}
        className="gap-1.5"
      >
        <FolderOpen className="h-3.5 w-3.5" />
        Browse
      </Button>
      <Button
        onClick={onStartScan}
        disabled={!selectedFolder || isScanning || disabled}
        size="sm"
        className="gap-1.5 shadow-sm hover:shadow"
      >
        {isScanning ? (
          <>
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            Scanning...
          </>
        ) : (
          <>
            <Play className="h-3.5 w-3.5" />
            {hasResults ? 'Rescan' : 'Start Scan'}
          </>
        )}
      </Button>

      {isScanning && (
        <Button
          onClick={onCancelScan}
          variant="outline"
          size="sm"
          className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 gap-1.5"
        >
          <Square className="h-3.5 w-3.5" />
          Cancel
        </Button>
      )}

      {hasResults && (
        <Button onClick={onClearResults} variant="outline" size="sm" className="gap-1.5">
          Clear
        </Button>
      )}
    </div>
  )
}
