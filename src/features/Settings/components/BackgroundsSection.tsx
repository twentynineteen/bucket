/**
 * Backgrounds Settings Section
 *
 * Default folder picker and save, plus a warning when the saved folder cannot
 * be read on this machine (issue #166).
 */
import { toast } from 'sonner'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@shared/ui/button'
import { useAppStore } from '@shared/store'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys, createQueryError } from '@shared/lib'
import { logger } from '@shared/utils'
import React from 'react'

import { directoryExists, openFolderPicker, saveSettingsApiKeys } from '../api'
import type { ApiKeys } from '../api'

interface BackgroundsSectionProps {
  apiKeys: ApiKeys
  /**
   * The settings file could not be read, so `apiKeys` is the empty fallback.
   * Saving is blocked while this holds: every section writes
   * `{...apiKeys, ...newKeys}`, so one save would overwrite a file that is
   * merely unparseable and destroy the credentials still in it (#166 B8.4).
   */
  settingsUnavailable?: boolean
}

const BackgroundsSection: React.FC<BackgroundsSectionProps> = ({
  apiKeys,
  settingsUnavailable = false
}) => {
  const queryClient = useQueryClient()
  const defaultBackgroundFolder = useAppStore((state) => state.defaultBackgroundFolder)
  const setDefaultBackgroundFolder = useAppStore(
    (state) => state.setDefaultBackgroundFolder
  )

  // Checks the path on display rather than only the saved one, so what the user
  // is looking at is what gets verified. A query, not an effect, per the
  // repo's data-fetching convention.
  const { data: folderPresent } = useQuery({
    queryKey: queryKeys.settings.backgroundFolderPresent(defaultBackgroundFolder),
    queryFn: async () => {
      if (!defaultBackgroundFolder) return true
      return directoryExists(defaultBackgroundFolder)
    },
    enabled: !!defaultBackgroundFolder,
    retry: false
  })

  const saveMutation = useMutation({
    mutationFn: async (newKeys: Partial<ApiKeys>) => {
      try {
        await saveSettingsApiKeys({ ...apiKeys, ...newKeys })
        return { ...apiKeys, ...newKeys }
      } catch (error) {
        throw createQueryError(`Failed to save API keys: ${error}`, 'SETTINGS_SAVE')
      }
    },
    onSuccess: (updatedKeys) => {
      queryClient.setQueryData(queryKeys.settings.apiKeys(), updatedKeys)
    }
  })

  const handleSelectFolder = async () => {
    const folder = await openFolderPicker()
    if (folder) {
      setDefaultBackgroundFolder(folder)
    }
  }

  const handleSave = async () => {
    try {
      await saveMutation.mutateAsync({ defaultBackgroundFolder })
    } catch (error) {
      logger.error('Failed to save default background folder:', error)
      // A failed write must be visible: saveApiKeys rethrows now, but a
      // silent catch would still show the user a false success (#155 P5-b).
      toast.error('Could not save your background folder. Please try again.')
    }
  }

  return (
    <section
      id="backgrounds"
      className="border-border space-y-4 rounded-lg border p-6 scroll-mt-16"
    >
      <div className="border-b pb-2">
        <h3 className="text-foreground text-lg font-semibold">Backgrounds</h3>
        <p className="text-muted-foreground text-sm">
          Set default folder for background assets
        </p>
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium">
          Default Background Folder
        </label>
        <div className="flex items-center gap-2">
          <Button onClick={handleSelectFolder} className="rounded border px-3 py-1">
            Choose Folder
          </Button>
          <Button
            onClick={handleSave}
            disabled={settingsUnavailable}
            className="rounded border px-3 py-1"
          >
            Save
          </Button>
        </div>
        {defaultBackgroundFolder && (
          <p className="text-muted-foreground mt-1 text-sm">{defaultBackgroundFolder}</p>
        )}
        {defaultBackgroundFolder && folderPresent === false && (
          <p className="text-destructive mt-1 flex items-start gap-1.5 text-sm">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {/*
                Worded to be true whether the folder is absent or present but
                unreadable, matching the Posterframe page. Asserting absence
                here would repeat the misattribution this fix removes: a TCC
                denial on ~/Documents makes the probe fail, not the folder
                vanish (issue #166, review round).
              */}
              Bucket cannot read this folder. It may have moved, or be on a drive that is
              not connected.
            </span>
          </p>
        )}
      </div>
    </section>
  )
}

export default BackgroundsSection
