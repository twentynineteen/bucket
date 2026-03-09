/**
 * Trello Settings Section
 *
 * Trello API key, token, authorization, and board selector.
 */
import { Button } from '@shared/ui/button'
import { TrelloBoardSelector } from '@features/Trello'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@shared/lib/query-keys'
import { createQueryError } from '@shared/lib/query-utils'
import { logger } from '@shared/utils/logger'
import ApiKeyInput from '@shared/ui/ApiKeyInput'
import React, { useState } from 'react'

import { openExternalUrl, saveSettingsApiKeys } from '../api'
import type { ApiKeys } from '../api'

interface TrelloSectionProps {
  apiKeys: ApiKeys
}

const TrelloSection: React.FC<TrelloSectionProps> = ({ apiKeys }) => {
  const queryClient = useQueryClient()
  const [localTrelloKey, setLocalTrelloKey] = useState(apiKeys.trello || '')
  const [localTrelloToken, setLocalTrelloToken] = useState(apiKeys.trelloToken || '')
  const [localBoardId, setLocalBoardId] = useState(apiKeys.trelloBoardId || '')
  const [prevApiKeys, setPrevApiKeys] = useState(apiKeys)

  // Sync local state when prop changes (React-recommended pattern)
  if (apiKeys !== prevApiKeys) {
    setPrevApiKeys(apiKeys)
    if (apiKeys && Object.keys(apiKeys).length > 0) {
      setLocalTrelloKey(apiKeys.trello || '')
      setLocalTrelloToken(apiKeys.trelloToken || '')
      setLocalBoardId(apiKeys.trelloBoardId || '')
    }
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

  const handleAuthorize = async () => {
    if (!localTrelloKey) {
      return
    }
    const authUrl = `https://trello.com/1/authorize?expiration=never&name=MyApp&scope=read,write&response_type=token&key=${localTrelloKey}`
    try {
      await openExternalUrl(authUrl)
    } catch (err) {
      logger.error('Failed to open Trello authorization URL:', err)
    }
  }

  const handleSaveTrelloKey = async () => {
    try {
      await saveMutation.mutateAsync({ trello: localTrelloKey })
    } catch (error) {
      logger.error('Failed to save Trello API key:', error)
    }
  }

  const handleSaveTrelloToken = async () => {
    try {
      await saveMutation.mutateAsync({ trelloToken: localTrelloToken })
    } catch (error) {
      logger.error('Failed to save Trello API token:', error)
    }
  }

  return (
    <section
      id="trello"
      className="border-border space-y-4 rounded-lg border p-6 scroll-mt-16"
    >
      <div className="border-b pb-2">
        <h3 className="text-foreground text-lg font-semibold">Trello</h3>
        <p className="text-muted-foreground text-sm">
          Configure Trello API integration for project management
        </p>
      </div>
      <div>
        <label htmlFor="trello-api-key-input" className="mb-2 block text-sm font-medium">
          Trello API Key
        </label>
        <ApiKeyInput
          id="trello-api-key-input"
          apiKey={localTrelloKey}
          setApiKey={setLocalTrelloKey}
          onSave={handleSaveTrelloKey}
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium">Trello Auth</label>
        <Button onClick={handleAuthorize}>Authorize with Trello</Button>
      </div>
      <div>
        <label
          htmlFor="trello-api-token-input"
          className="mb-2 block text-sm font-medium"
        >
          Trello API Token
        </label>
        <ApiKeyInput
          id="trello-api-token-input"
          apiKey={localTrelloToken}
          setApiKey={setLocalTrelloToken}
          onSave={handleSaveTrelloToken}
        />
      </div>
      <TrelloBoardSelector
        value={localBoardId}
        onValueChange={async (boardId: string) => {
          setLocalBoardId(boardId)
          try {
            await saveMutation.mutateAsync({ trelloBoardId: boardId })
          } catch (error) {
            logger.error('Failed to save board ID:', error)
          }
        }}
        label="Trello Board"
        placeholder="Select a board"
      />
    </section>
  )
}

export default TrelloSection
