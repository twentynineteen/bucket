/**
 * Baker Preferences Component
 *
 * Settings dialog for configuring Baker scan and update behavior.
 */

import { Button } from '@components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@components/ui/dialog'
import { Settings } from 'lucide-react'
import React from 'react'

import type { ScanPreferences } from '@/types/baker'

interface BakerPreferencesProps {
  preferences: ScanPreferences
  onUpdatePreferences: (newPrefs: Partial<ScanPreferences>) => void
  onResetToDefaults: () => void
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export const BakerPreferences: React.FC<BakerPreferencesProps> = ({
  preferences,
  onUpdatePreferences,
  onResetToDefaults,
  isOpen,
  onOpenChange
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Settings className="h-3.5 w-3.5" />
          Settings
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Baker Preferences</DialogTitle>
          <DialogDescription>Configure scanning and update behavior</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <label className="flex items-center justify-between">
            <span>Create missing breadcrumbs</span>
            <input
              type="checkbox"
              checked={preferences.createMissing}
              onChange={(e) => onUpdatePreferences({ createMissing: e.target.checked })}
            />
          </label>
          <label className="flex items-center justify-between">
            <span>Backup original files</span>
            <input
              type="checkbox"
              checked={preferences.backupOriginals}
              onChange={(e) => onUpdatePreferences({ backupOriginals: e.target.checked })}
            />
          </label>
          <label className="flex items-center justify-between">
            <span>Include hidden folders</span>
            <input
              type="checkbox"
              checked={preferences.includeHidden}
              onChange={(e) => onUpdatePreferences({ includeHidden: e.target.checked })}
            />
          </label>
          <div>
            <label>Max scanning depth: {preferences.maxDepth}</label>
            <input
              type="range"
              min="1"
              max="20"
              value={preferences.maxDepth}
              onChange={(e) =>
                onUpdatePreferences({ maxDepth: parseInt(e.target.value) })
              }
              className="w-full"
            />
          </div>
          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={onResetToDefaults}>
              Reset to Defaults
            </Button>
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
