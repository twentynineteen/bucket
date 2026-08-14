/**
 * Backgrounds Settings Section
 *
 * Default folder pickers and save, plus a warning when a saved folder cannot
 * be read on this machine (issue #166). One folder per posterframe template
 * (issue #189): Classic keeps the original key, Rebrand has its own.
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

/**
 * One template's folder: label, picker, path readout and dead-path warning.
 * Each field probes its own path under its own query key, so a dead Rebrand
 * folder warns beside the Rebrand field alone (#189 B2.3).
 */
const FolderField: React.FC<{
  label: string
  chooseLabel: string
  folder: string | null
  onChoose: () => void
}> = ({ label, chooseLabel, folder, onChoose }) => {
  // Checks the path on display rather than only the saved one, so what the
  // user is looking at is what gets verified. A query, not an effect, per the
  // repo's data-fetching convention.
  const { data: folderPresent } = useQuery({
    queryKey: queryKeys.settings.backgroundFolderPresent(folder),
    queryFn: async () => {
      if (!folder) return true
      return directoryExists(folder)
    },
    enabled: !!folder,
    retry: false
  })

  return (
    <div>
      <label className="mb-2 block text-sm font-medium">{label}</label>
      <Button onClick={onChoose} className="rounded border px-3 py-1">
        {chooseLabel}
      </Button>
      {folder && <p className="text-muted-foreground mt-1 text-sm">{folder}</p>}
      {folder && folderPresent === false && (
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
  )
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
  const rebrandBackgroundFolder = useAppStore((state) => state.rebrandBackgroundFolder)
  const setRebrandBackgroundFolder = useAppStore(
    (state) => state.setRebrandBackgroundFolder
  )

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

  const chooseFolder = async (setFolder: (path: string) => void) => {
    const folder = await openFolderPicker()
    if (folder) {
      setFolder(folder)
    }
  }

  const handleSave = async () => {
    try {
      await saveMutation.mutateAsync({
        // The store normalises "not configured" to `null` (#189); ApiKeys
        // records it as an absent key, which is what JSON.stringify writes for
        // `undefined` anyway (#210).
        defaultBackgroundFolder: defaultBackgroundFolder ?? undefined,
        rebrandBackgroundFolder: rebrandBackgroundFolder ?? undefined
      })
    } catch (error) {
      logger.error('Failed to save background folders:', error)
      // A failed write must be visible: saveApiKeys rethrows now, but a
      // silent catch would still show the user a false success (#155 P5-b).
      toast.error('Could not save your background folders. Please try again.')
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
          Set the default background folder for each posterframe template
        </p>
      </div>
      <FolderField
        label="Classic Background Folder"
        chooseLabel="Choose Classic Folder"
        folder={defaultBackgroundFolder}
        onChoose={() => chooseFolder(setDefaultBackgroundFolder)}
      />
      <FolderField
        label="Rebrand Background Folder"
        chooseLabel="Choose Rebrand Folder"
        folder={rebrandBackgroundFolder}
        onChoose={() => chooseFolder(setRebrandBackgroundFolder)}
      />
      <Button
        onClick={handleSave}
        disabled={settingsUnavailable}
        className="rounded border px-3 py-1"
      >
        Save
      </Button>
    </section>
  )
}

export default BackgroundsSection
