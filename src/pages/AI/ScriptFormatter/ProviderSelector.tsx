/**
 * ProviderSelector Component
 * Feature: 006-i-wish-to (T044)
 * Purpose: Select and validate AI provider
 */

import { CheckCircle, Loader2, XCircle, Zap } from 'lucide-react'
import React from 'react'

import type { AIProvider, ProviderConfiguration } from '@/types/scriptFormatter'

interface ProviderSelectorProps {
  providers: AIProvider[]
  activeProvider: AIProvider | null
  onSelect: (providerId: string) => void
  onValidate: (providerId: string, config: ProviderConfiguration) => void
  isValidating?: boolean
}

export const ProviderSelector: React.FC<ProviderSelectorProps> = ({
  providers,
  activeProvider,
  onSelect,
  onValidate,
  isValidating = false
}) => {
  const handleProviderSelect = (providerId: string) => {
    onSelect(providerId)
    // Auto-validate after selection
    const provider = providers.find((p) => p.id === providerId)
    if (provider) {
      onValidate(providerId, provider.configuration)
    }
  }

  return (
    <div className="space-y-4">
      <label className="text-foreground block text-sm font-medium">AI Provider</label>

      <div className="space-y-2">
        {providers.map((provider) => (
          <div
            key={provider.id}
            className={`cursor-pointer rounded-lg border p-4 transition-all ${
              activeProvider?.id === provider.id
                ? 'border-foreground bg-secondary'
                : 'border-border hover:border-foreground/50'
            }`}
            onClick={() => handleProviderSelect(provider.id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Zap className="text-muted-foreground h-5 w-5" />
                <div>
                  <p className="text-foreground font-medium">{provider.displayName}</p>
                  <p className="text-muted-foreground text-xs">
                    {provider.configuration.serviceUrl}
                  </p>
                </div>
              </div>

              {/* Connection status indicator */}
              <div className="flex items-center gap-2">
                {isValidating && activeProvider?.id === provider.id ? (
                  <div className="text-foreground flex items-center gap-1">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-xs">Validating...</span>
                  </div>
                ) : (
                  <>
                    {provider.status === 'configured' && (
                      <div className="text-success flex items-center gap-1">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-xs">Connected</span>
                      </div>
                    )}
                    {provider.status === 'error' && (
                      <div className="text-destructive flex items-center gap-1">
                        <XCircle className="h-4 w-4" />
                        <span className="text-xs">Error</span>
                      </div>
                    )}
                    {provider.status === 'not-configured' && (
                      <span className="text-muted-foreground text-xs">
                        Not configured
                      </span>
                    )}

                    {/* Show latency if available */}
                    {provider.configuration.lastValidationResult?.latencyMs && (
                      <span className="text-muted-foreground text-xs">
                        ({provider.configuration.lastValidationResult.latencyMs}ms)
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Show validation error message */}
      {activeProvider?.configuration.lastValidationResult?.errorMessage && (
        <div className="bg-destructive/10 border-destructive/20 rounded-lg border p-3">
          <p className="text-destructive text-sm">
            {activeProvider.configuration.lastValidationResult.errorMessage}
          </p>
        </div>
      )}
    </div>
  )
}
