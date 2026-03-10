/**
 * AI Models Settings Section
 *
 * Ollama URL configuration and connection testing.
 */
import { Button } from '@shared/ui/button'
import { useAppStore } from '@shared/store'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import ApiKeyInput from '@shared/ui/ApiKeyInput'
import { queryKeys } from '@shared/lib/query-keys'
import { createQueryError } from '@shared/lib/query-utils'
import { CheckCircle, Loader2, XCircle } from 'lucide-react'
import React, { useState } from 'react'

import { useAIProvider } from '../hooks/useAIProvider'
import { saveSettingsApiKeys } from '../api'
import type { ApiKeys } from '../api'
import type { ConnectionStatus } from '../types'

interface AIModelsSectionProps {
  apiKeys: ApiKeys
}

const AIModelsSection: React.FC<AIModelsSectionProps> = ({ apiKeys }) => {
  const queryClient = useQueryClient()
  const ollamaUrl = useAppStore((state) => state.ollamaUrl)
  const setOllamaUrl = useAppStore((state) => state.setOllamaUrl)
  const { validateProvider } = useAIProvider()
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    status: 'idle'
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

  const handleOllamaUrlChange = (newUrl: string) => {
    setOllamaUrl(newUrl)
    setConnectionStatus({ status: 'idle' })
  }

  const handleSaveOllamaUrl = async () => {
    await saveMutation.mutateAsync({ ollamaUrl })
  }

  const handleTestConnection = async () => {
    const testUrl = ollamaUrl || 'http://localhost:11434'
    setConnectionStatus({ status: 'testing' })

    const result = await validateProvider('ollama', {
      serviceUrl: testUrl,
      connectionStatus: 'not-configured',
      timeout: 5000
    })

    if (result.success) {
      const modelsFound = result.modelsFound ?? 0
      setConnectionStatus({
        status: 'success',
        message: `Connected successfully! Found ${modelsFound} model${modelsFound !== 1 ? 's' : ''}.`,
        modelsFound,
        latencyMs: result.latencyMs
      })
    } else {
      setConnectionStatus({
        status: 'error',
        message:
          result.errorMessage || 'Connection failed. Please check if Ollama is running.'
      })
    }
  }

  return (
    <section
      id="ai-models"
      className="border-border space-y-4 rounded-lg border p-6 scroll-mt-16"
    >
      <div className="border-b pb-2">
        <h3 className="text-foreground text-lg font-semibold">AI Models</h3>
        <p className="text-muted-foreground text-sm">
          Configure AI provider settings for script formatting
        </p>
      </div>
      <div>
        <label htmlFor="ollama-url-input" className="mb-2 block text-sm font-medium">
          Ollama URL
          <span className="text-muted-foreground ml-2 text-xs">
            (Default: http://localhost:11434)
          </span>
        </label>
        <div className="space-y-2">
          <ApiKeyInput
            id="ollama-url-input"
            apiKey={ollamaUrl || 'http://localhost:11434'}
            setApiKey={handleOllamaUrlChange}
            onSave={handleSaveOllamaUrl}
          />
          <div className="flex items-center gap-2">
            <Button
              onClick={handleTestConnection}
              disabled={connectionStatus.status === 'testing'}
              className="flex items-center gap-2 rounded border px-3 py-1"
            >
              {connectionStatus.status === 'testing' && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {connectionStatus.status === 'testing' ? 'Testing...' : 'Test Connection'}
            </Button>

            {connectionStatus.status === 'success' && (
              <div className="text-success flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4" />
                <span>{connectionStatus.message}</span>
                {connectionStatus.latencyMs && (
                  <span className="text-muted-foreground">
                    ({connectionStatus.latencyMs}ms)
                  </span>
                )}
              </div>
            )}

            {connectionStatus.status === 'error' && (
              <div className="text-destructive flex items-center gap-2 text-sm">
                <XCircle className="h-4 w-4" />
                <span>{connectionStatus.message}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

export default AIModelsSection
