/**
 * ProcessingStep Component
 * Step 3: Script Processing with Progress
 */

import { AlertCircle, Database, Sparkles } from 'lucide-react'
import React from 'react'

interface ProcessingStepProps {
  progress: number
  ragStatus: string
  processingError: Error | null
  onCancel: () => void
  onRetry: () => void
}

export const ProcessingStep: React.FC<ProcessingStepProps> = ({
  progress,
  ragStatus,
  processingError,
  onCancel,
  onRetry
}) => {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="border-border rounded-lg border p-8 text-center">
        <Sparkles className="text-foreground mx-auto mb-4 h-16 w-16 animate-pulse" />
        <h3 className="text-foreground mb-2 text-lg font-medium">
          Formatting your script...
        </h3>
        <p className="text-muted-foreground mb-4 text-sm">
          Using AI to optimize for autocue readability
        </p>

        {/* RAG Status */}
        {ragStatus && (
          <div className="bg-info/10 border-info/20 mb-4 rounded-lg border p-3">
            <div className="text-info flex items-center justify-center gap-2 text-sm">
              <Database className="h-4 w-4" />
              <span>{ragStatus}</span>
            </div>
          </div>
        )}

        {/* Progress Bar */}
        <div className="bg-secondary mb-2 h-2 w-full rounded-full">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-300"
            style={{ width: `${Math.round(progress)}%` }}
          />
        </div>
        <p className="text-muted-foreground text-xs">{Math.round(progress)}% complete</p>

        <button
          onClick={onCancel}
          className="text-destructive border-destructive/30 hover:bg-destructive/10 mt-4 rounded border px-4 py-2 text-sm"
        >
          Cancel Processing
        </button>
      </div>

      {/* Error Display */}
      {processingError && (
        <div className="bg-destructive/10 border-destructive/20 rounded-lg border p-4">
          <div className="mb-3 flex items-start gap-2">
            <AlertCircle className="text-destructive h-5 w-5 flex-shrink-0" />
            <div>
              <p className="text-destructive text-sm font-medium">Processing Error</p>
              <p className="text-destructive/90 mt-1 text-sm">
                {processingError.message}
              </p>
            </div>
          </div>
          <button
            onClick={onRetry}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full rounded px-4 py-2 text-sm"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  )
}
