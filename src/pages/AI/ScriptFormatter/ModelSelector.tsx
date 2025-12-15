/**
 * ModelSelector Component
 * Feature: 006-i-wish-to (T045)
 * Purpose: Select AI model with capabilities display
 */

import { Brain, Loader2, Wrench, Zap } from 'lucide-react'
import React from 'react'

import type { AIModel } from '@/types/scriptFormatter'

interface ModelSelectorProps {
  models: AIModel[]
  selectedModel: string | null
  onSelect: (modelId: string) => void
  isLoading?: boolean
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  models,
  selectedModel,
  onSelect,
  isLoading = false
}) => {
  if (isLoading) {
    return (
      <div className="border-border flex items-center justify-center rounded-lg border p-8">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        <span className="text-muted-foreground ml-2 text-sm">Loading models...</span>
      </div>
    )
  }

  if (models.length === 0) {
    return (
      <div className="bg-warning/10 border-warning/20 rounded-lg border p-4">
        <p className="text-warning text-sm">
          No models available. Please check your provider connection.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <label className="text-foreground block text-sm font-medium">Select Model</label>

      <div className="space-y-2">
        {models.map((model) => (
          <div
            key={model.id}
            className={`cursor-pointer rounded-lg border p-4 transition-all ${
              selectedModel === model.id
                ? 'border-foreground bg-secondary'
                : 'border-border hover:border-foreground/50'
            }`}
            onClick={() => onSelect(model.id)}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <Brain className="text-muted-foreground mt-0.5 h-5 w-5" />
                <div>
                  <p className="text-foreground font-medium">{model.displayName}</p>
                  {model.size && (
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      Size: {model.size}
                    </p>
                  )}

                  {/* Show model capabilities */}
                  <div className="mt-2 flex items-center gap-3">
                    {model.capabilities.supportsToolCalling && (
                      <div className="text-success flex items-center gap-1">
                        <Wrench className="h-3 w-3" />
                        <span className="text-xs">Tool Calling</span>
                      </div>
                    )}
                    {model.capabilities.supportsStreaming && (
                      <div className="text-foreground flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        <span className="text-xs">Streaming</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Availability indicator */}
              {model.availabilityStatus === 'online' && (
                <span className="bg-success/10 text-success rounded px-2 py-1 text-xs">
                  Available
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {selectedModel && (
        <p className="text-muted-foreground text-xs">
          Selected: {models.find((m) => m.id === selectedModel)?.displayName}
        </p>
      )}
    </div>
  )
}
