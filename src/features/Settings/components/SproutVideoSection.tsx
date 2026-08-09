/**
 * SproutVideo Settings Section
 *
 * SproutVideo API key input and save.
 */
import { toast } from 'sonner'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys, createQueryError } from '@shared/lib'
import { logger } from '@shared/utils'
import ApiKeyInput from '@shared/ui/ApiKeyInput'
import React, { useState } from 'react'

import { SproutFolderPicker } from '@features/Upload'
import type { SelectedSproutFolder } from '@features/Upload'

import { saveSettingsApiKeys } from '../api'
import type { ApiKeys } from '../api'

interface SproutVideoSectionProps {
  apiKeys: ApiKeys
}

const SproutVideoSection: React.FC<SproutVideoSectionProps> = ({ apiKeys }) => {
  const queryClient = useQueryClient()
  const [localKey, setLocalKey] = useState(apiKeys.sproutVideo || '')
  const [prevPropValue, setPrevPropValue] = useState(apiKeys.sproutVideo)

  // Sync local state when prop changes (React-recommended pattern)
  if (apiKeys.sproutVideo !== prevPropValue) {
    setPrevPropValue(apiKeys.sproutVideo)
    setLocalKey(apiKeys.sproutVideo || '')
  }

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

  // Durable default upload folder (issue #155 Phase 5). Stored in
  // api_keys.json alongside trelloBoardId -- appStore has no persistence, so
  // it is the wrong home for anything that must survive a restart.
  const defaultFolder: SelectedSproutFolder | null = apiKeys.sproutDefaultFolderId
    ? {
        id: apiKeys.sproutDefaultFolderId,
        name: apiKeys.sproutDefaultFolderName ?? 'Default folder',
        path: apiKeys.sproutDefaultFolderName ?? 'Default folder'
      }
    : null

  const handleDefaultFolderChange = async (folder: SelectedSproutFolder | null) => {
    try {
      await saveMutation.mutateAsync({
        sproutDefaultFolderId: folder?.id,
        sproutDefaultFolderName: folder?.path
      })
      toast.success(
        folder
          ? `New uploads will default to ${folder.path}`
          : 'New uploads will default to the account root'
      )
    } catch (error) {
      logger.error('Failed to save default Sprout folder:', error)
      toast.error('Could not save your default folder. Please try again.')
    }
  }

  const handleSave = async () => {
    try {
      await saveMutation.mutateAsync({ sproutVideo: localKey })
    } catch (error) {
      logger.error('Failed to save SproutVideo API key:', error)
      // A failed write must be visible: saveApiKeys rethrows now, but a
      // silent catch would still show the user a false success (#155 P5-b).
      toast.error('Could not save your Sprout Video API key. Please try again.')
    }
  }

  return (
    <section
      id="sproutvideo"
      className="border-border space-y-4 rounded-lg border p-6 scroll-mt-16"
    >
      <div className="border-b pb-2">
        <h3 className="text-foreground text-lg font-semibold">SproutVideo</h3>
        <p className="text-muted-foreground text-sm">
          Configure SproutVideo API for video hosting
        </p>
      </div>
      <div>
        <label
          htmlFor="sprout-video-api-key-input"
          className="mb-2 block text-sm font-medium"
        >
          SproutVideo API Key
        </label>
        <ApiKeyInput
          id="sprout-video-api-key-input"
          apiKey={localKey}
          setApiKey={setLocalKey}
          onSave={handleSave}
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">Default upload folder</label>
        <SproutFolderPicker
          apiKey={apiKeys.sproutVideo || null}
          value={defaultFolder}
          onChange={handleDefaultFolderChange}
          disabled={saveMutation.isPending}
        />
        <p className="text-muted-foreground mt-2 text-sm">
          Where new uploads are filed on Sprout Video. The folder you last uploaded to
          takes precedence for the rest of the session.
        </p>
      </div>
    </section>
  )
}

export default SproutVideoSection
