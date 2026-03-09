/**
 * SproutVideo Settings Section
 *
 * SproutVideo API key input and save.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@shared/lib/query-keys'
import { createQueryError } from '@shared/lib/query-utils'
import { logger } from '@shared/utils/logger'
import ApiKeyInput from '@shared/ui/ApiKeyInput'
import React, { useEffect, useState } from 'react'

import { saveSettingsApiKeys } from '../api'
import type { ApiKeys } from '../api'

interface SproutVideoSectionProps {
  apiKeys: ApiKeys
}

const SproutVideoSection: React.FC<SproutVideoSectionProps> = ({
  apiKeys
}) => {
  const queryClient = useQueryClient()
  const [localKey, setLocalKey] = useState(apiKeys.sproutVideo || '')

  // Sync local state when apiKeys prop changes
  useEffect(() => {
    if (apiKeys.sproutVideo !== undefined) {
      setLocalKey(apiKeys.sproutVideo || '')
    }
  }, [apiKeys.sproutVideo])

  const saveMutation = useMutation({
    mutationFn: async (newKeys: Partial<ApiKeys>) => {
      try {
        await saveSettingsApiKeys({ ...apiKeys, ...newKeys })
        return { ...apiKeys, ...newKeys }
      } catch (error) {
        throw createQueryError(
          `Failed to save API keys: ${error}`,
          'SETTINGS_SAVE'
        )
      }
    },
    onSuccess: (updatedKeys) => {
      queryClient.setQueryData(queryKeys.settings.apiKeys(), updatedKeys)
    }
  })

  const handleSave = async () => {
    try {
      await saveMutation.mutateAsync({ sproutVideo: localKey })
    } catch (error) {
      logger.error('Failed to save SproutVideo API key:', error)
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
    </section>
  )
}

export default SproutVideoSection
