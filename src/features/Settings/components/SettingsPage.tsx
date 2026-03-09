/**
 * Settings Page Component
 *
 * Layout-only parent with header and 5 per-domain section components.
 * Follows BuildProject/Baker UI patterns with ErrorBoundary wrapper.
 */
import ErrorBoundary from '@shared/ui/layout/ErrorBoundary'
import { Button } from '@shared/ui/button'
import { CACHE } from '@shared/constants/timing'
import { useBreadcrumb } from '@shared/hooks'
import { queryKeys } from '@shared/lib/query-keys'
import {
  createQueryError,
  createQueryOptions,
  shouldRetry
} from '@shared/lib/query-utils'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import React from 'react'

import { loadSettingsApiKeys } from '../api'
import { useSettingsScroll } from '../hooks/useSettingsScroll'
import AIModelsSection from './AIModelsSection'
import AppearanceSection from './AppearanceSection'
import BackgroundsSection from './BackgroundsSection'
import SproutVideoSection from './SproutVideoSection'
import TrelloSection from './TrelloSection'

const SettingsPageContent: React.FC = () => {
  useSettingsScroll()

  useBreadcrumb([
    { label: 'Settings', href: '/settings/general' },
    { label: 'General' }
  ])

  const { data: apiKeys = {} } = useQuery({
    ...createQueryOptions(
      queryKeys.settings.apiKeys(),
      async () => {
        try {
          return await loadSettingsApiKeys()
        } catch (error) {
          throw createQueryError(
            `Failed to load API keys: ${error}`,
            'SETTINGS_LOAD'
          )
        }
      },
      'DYNAMIC',
      {
        staleTime: CACHE.STANDARD,
        gcTime: CACHE.GC_MEDIUM,
        retry: (failureCount: number, error: Error) =>
          shouldRetry(error, failureCount, 'settings')
      }
    )
  })

  return (
    <div className="h-full w-full overflow-x-hidden overflow-y-auto">
      <div className="w-full max-w-full pb-4">
        {/* Header */}
        <div className="border-border bg-card/50 border-b px-6 py-4">
          <h1 className="text-foreground text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Configure application settings, API integrations, and preferences
          </p>
        </div>

        <div className="max-w-full space-y-8 px-6 py-4">
          <AIModelsSection apiKeys={apiKeys} />
          <AppearanceSection />
          <BackgroundsSection apiKeys={apiKeys} />
          <SproutVideoSection apiKeys={apiKeys} />
          <TrelloSection apiKeys={apiKeys} />
        </div>
      </div>
    </div>
  )
}

const Settings: React.FC = () => {
  return (
    <ErrorBoundary
      fallback={(error, retry) => (
        <div className="flex min-h-[400px] flex-col items-center justify-center p-8 text-center">
          <div className="max-w-md">
            <AlertTriangle className="text-destructive mx-auto mb-4 h-12 w-12" />
            <h2 className="text-foreground mb-4 text-2xl font-semibold">
              Settings Error
            </h2>
            <div className="text-muted-foreground mb-6">
              <p>
                An error occurred while loading the Settings page. This could be
                due to:
              </p>
              <ul className="mt-2 space-y-1 text-left">
                <li>- Storage access issues</li>
                <li>- Invalid configuration data</li>
                <li>- Network connectivity problems</li>
              </ul>
              {error && process.env.NODE_ENV === 'development' && (
                <details className="bg-muted/50 border-border mt-4 rounded-md border p-4 text-left text-sm">
                  <summary className="text-foreground cursor-pointer font-medium">
                    Technical Details
                  </summary>
                  <div className="mt-2">
                    <p>
                      <strong>Error:</strong> {error.message}
                    </p>
                  </div>
                </details>
              )}
            </div>
            <div className="flex justify-center gap-2">
              <Button onClick={retry} className="flex-1">
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
              <Button
                onClick={() => (window.location.href = '/ingest/build')}
                variant="outline"
                className="flex-1"
              >
                Back to Build
              </Button>
            </div>
          </div>
        </div>
      )}
    >
      <SettingsPageContent />
    </ErrorBoundary>
  )
}

export default Settings
