/**
 * ExampleToggleList Component
 * Displays a list of script examples with toggle controls
 */

import { CheckCircle2, Circle } from 'lucide-react'
import React from 'react'

import type { ExampleWithMetadata } from '@/types/exampleEmbeddings'

interface ExampleToggleListProps {
  examples: ExampleWithMetadata[]
  enabledIds: Set<string>
  onToggle: (id: string) => void
  isLoading?: boolean
}

export function ExampleToggleList({
  examples,
  enabledIds,
  onToggle,
  isLoading = false
}: ExampleToggleListProps) {
  if (isLoading) {
    return (
      <div className="text-muted-foreground p-4 text-center text-sm">
        Loading examples...
      </div>
    )
  }

  if (examples.length === 0) {
    return (
      <div className="text-muted-foreground p-4 text-center text-sm">
        No examples available
      </div>
    )
  }

  const enabledCount = examples.filter((ex) => enabledIds.has(ex.id)).length
  const totalCount = examples.length

  return (
    <div className="space-y-2">
      {/* Header with count */}
      <div className="flex items-center justify-between border-b px-2 pb-2">
        <span className="text-foreground text-xs font-medium">
          {enabledCount} of {totalCount} enabled
        </span>
        <div className="flex gap-2">
          <button
            onClick={() =>
              examples.forEach((ex) => !enabledIds.has(ex.id) && onToggle(ex.id))
            }
            className="text-info hover:text-info/90 text-xs"
            disabled={enabledCount === totalCount}
          >
            Enable All
          </button>
          <button
            onClick={() =>
              examples.forEach((ex) => enabledIds.has(ex.id) && onToggle(ex.id))
            }
            className="text-muted-foreground hover:text-foreground text-xs"
            disabled={enabledCount === 0}
          >
            Disable All
          </button>
        </div>
      </div>

      {/* Example list */}
      <div className="max-h-64 space-y-1 overflow-y-auto">
        {examples.map((example) => {
          const isEnabled = enabledIds.has(example.id)
          return (
            <button
              key={example.id}
              onClick={() => onToggle(example.id)}
              className={`hover:bg-muted flex w-full items-start gap-3 rounded-md p-2 text-left transition-colors ${
                isEnabled ? 'bg-info/10' : 'bg-card'
              }`}
            >
              {isEnabled ? (
                <CheckCircle2 className="text-info mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <Circle className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p
                    className={`text-sm font-medium ${
                      isEnabled ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    {example.title}
                  </p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                      isEnabled
                        ? 'bg-info/20 text-info'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {example.source === 'bundled' ? 'Bundled' : 'Custom'}
                  </span>
                </div>
                <p className="text-muted-foreground mt-0.5 text-xs">{example.category}</p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
