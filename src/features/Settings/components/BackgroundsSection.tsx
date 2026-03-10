/**
 * Backgrounds Settings Section
 *
 * Default folder picker and save.
 */
import { Button } from '@shared/ui/button'
import { useAppStore } from '@shared/store'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@shared/lib/query-keys'
import { createQueryError } from '@shared/lib/query-utils'
import { logger } from '@shared/utils'
import React from 'react'

import { openFolderPicker, saveSettingsApiKeys } from '../api'
import type { ApiKeys } from '../api'

interface BackgroundsSectionProps {
  apiKeys: ApiKeys
}

const BackgroundsSection: React.FC<BackgroundsSectionProps> = ({ apiKeys }) => {
  const queryClient = useQueryClient()
  const defaultBackgroundFolder = useAppStore((state) => state.defaultBackgroundFolder)
  const setDefaultBackgroundFolder = useAppStore(
    (state) => state.setDefaultBackgroundFolder
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
          <Button onClick={handleSave} className="rounded border px-3 py-1">
            Save
          </Button>
        </div>
        {defaultBackgroundFolder && (
          <p className="text-muted-foreground mt-1 text-sm">{defaultBackgroundFolder}</p>
        )}
      </div>
    </section>
  )
}

export default BackgroundsSection
