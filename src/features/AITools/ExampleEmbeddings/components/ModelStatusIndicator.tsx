/**
 * ModelStatusIndicator Component
 *
 * Displays the status of the Ollama embedding model.
 */

import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react'

interface ModelStatusIndicatorProps {
  isCheckingModel: boolean
  isModelReady: boolean
  modelName: string
  modelError: Error | null
}

export function ModelStatusIndicator({
  isCheckingModel,
  isModelReady,
  modelName,
  modelError
}: ModelStatusIndicatorProps) {
  const getStatusStyles = () => {
    if (isCheckingModel) return 'border-info/20 bg-info/10'
    if (isModelReady) return 'border-success/20 bg-success/10'
    return 'border-destructive/20 bg-destructive/10'
  }

  return (
    <div className={`rounded-md border p-3 ${getStatusStyles()}`}>
      <div className="flex items-center gap-2">
        {isCheckingModel ? (
          <>
            <Loader2 className="text-info h-4 w-4 animate-spin" />
            <span className="text-info text-sm">Checking embedding model...</span>
          </>
        ) : isModelReady ? (
          <>
            <CheckCircle className="text-success h-4 w-4" />
            <span className="text-success text-sm">
              Embedding model ready: <code className="font-mono">{modelName}</code>
            </span>
          </>
        ) : (
          <>
            <AlertCircle className="text-destructive h-4 w-4" />
            <div className="flex-1">
              <p className="text-destructive text-sm font-medium">
                Embedding model not available
              </p>
              {modelError && (
                <p className="text-destructive/90 mt-1 text-xs">{modelError.message}</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
