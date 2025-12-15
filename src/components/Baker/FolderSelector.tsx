/**
 * Folder Selector Component
 *
 * Handles folder selection and scan initiation for Baker.
 */

import { Button } from '@components/ui/button'
import { Input } from '@components/ui/input'
import { open } from '@tauri-apps/plugin-dialog'
import { FolderOpen, Play, RefreshCw, Square } from 'lucide-react'
import React, { useCallback } from 'react'

import { logger } from '@/utils/logger'

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
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select folder to scan for projects'
      })

      if (selected && typeof selected === 'string') {
        onFolderChange(selected)
      }
    } catch (error) {
      logger.error('Failed to select folder:', error)
    }
  }, [onFolderChange])

  return (
    <div className="bg-card border-border rounded-xl border p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <div className="bg-primary/10 text-primary flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold">
          1
        </div>
        <div className="flex-1">
          <h2 className="text-foreground text-sm font-semibold">Select Folder to Scan</h2>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Choose a root directory to scan for BuildProject-compatible folders
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="No folder selected"
            value={selectedFolder}
            readOnly
            className="flex-1"
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
        </div>

        <div className="flex gap-2">
          <Button
            onClick={onStartScan}
            disabled={!selectedFolder || isScanning || disabled}
            size="sm"
            className="flex-1 gap-1.5 shadow-sm hover:shadow"
          >
            {isScanning ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" />
                Start Scan
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
            <Button
              onClick={onClearResults}
              variant="outline"
              size="sm"
              className="gap-1.5"
            >
              Clear Results
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
