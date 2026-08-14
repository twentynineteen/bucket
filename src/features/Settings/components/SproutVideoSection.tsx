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
import { AlertTriangle } from 'lucide-react'
import React, { useState } from 'react'

import {
  SproutFolderIndexPanel,
  SproutFolderPicker,
  useDefaultSproutFolder
} from '@features/Upload'
import type { SelectedSproutFolder } from '@features/Upload'

import { saveSettingsApiKeys } from '../api'
import type { ApiKeys } from '../api'

interface SproutVideoSectionProps {
  apiKeys: ApiKeys
  /**
   * The settings file could not be read, so `apiKeys` is the empty fallback.
   * Saving is blocked while this holds, or one save would overwrite a merely
   * unparseable file and destroy the credentials still in it (#166 B8.4).
   */
  settingsUnavailable?: boolean
}

const SproutVideoSection: React.FC<SproutVideoSectionProps> = ({
  apiKeys,
  settingsUnavailable = false
}) => {
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
  //
  // The id points into a Sprout account this app does not control, so it is
  // validated rather than trusted (#169). This panel used to rebuild
  // `{ id, name, path: name }` from storage, which showed a folder deleted or
  // renamed on Sprout as the configured destination -- and this is the screen
  // where someone would come to fix it. Validation is a disk read against the
  // saved index and costs no Sprout requests.
  const defaultFolder = useDefaultSproutFolder({
    apiKey: apiKeys.sproutVideo ?? null,
    storedId: apiKeys.sproutDefaultFolderId,
    storedName: apiKeys.sproutDefaultFolderName,
    settingsError: settingsUnavailable
  })

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
          saveDisabled={settingsUnavailable}
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
          value={defaultFolder.folder}
          onChange={handleDefaultFolderChange}
          disabled={saveMutation.isPending}
        />
        {/*
          A saved default the index cannot vouch for says so here, beside the
          control that fixes it (#169). Silent otherwise: the picker's own label
          always states the real destination.
        */}
        {defaultFolder.reason ? (
          <p className="text-destructive mt-2 flex items-start gap-1.5 text-sm">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{defaultFolder.reason}</span>
          </p>
        ) : (
          <p className="text-muted-foreground mt-2 text-sm">
            Where new uploads are filed on Sprout Video. The folder you last uploaded to
            takes precedence for the rest of the session.
          </p>
        )}
      </div>

      <div className="border-t pt-4">
        <label className="mb-2 block text-sm font-medium">Folder search index</label>
        <SproutFolderIndexPanel apiKey={apiKeys.sproutVideo || null} />
      </div>
    </section>
  )
}

export default SproutVideoSection
