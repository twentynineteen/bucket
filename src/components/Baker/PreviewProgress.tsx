/**
 * PreviewProgress Component
 *
 * Displays real-time progress for batch preview generation operations.
 * Shows the number of previews generated out of total projects.
 */

import { Progress } from '@components/ui/progress'
import { RefreshCw } from 'lucide-react'
import React from 'react'

interface PreviewProgressProps {
  /** Number of previews generated so far */
  current: number
  /** Total number of previews to generate */
  total: number
  /** Whether preview generation is in progress */
  isGenerating: boolean
}

export const PreviewProgress: React.FC<PreviewProgressProps> = ({
  current,
  total,
  isGenerating
}) => {
  if (!isGenerating || total === 0) {
    return null
  }

  const percentage = Math.round((current / total) * 100)

  return (
    <div
      className="bg-primary/5 border-primary/20 animate-in fade-in slide-in-from-top-2 rounded-lg border p-4"
      data-testid="preview-progress"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RefreshCw
            className="text-primary h-4 w-4 animate-spin"
            data-testid="spinner-icon"
          />
          <span className="text-foreground text-sm font-medium">
            Generating Previews...
          </span>
        </div>
        <span className="text-muted-foreground text-sm">
          {current} / {total}
        </span>
      </div>
      <Progress value={percentage} className="h-2" data-testid="progress-bar" />
      <p className="text-muted-foreground mt-2 text-xs">
        Please wait while we analyze changes for selected projects
      </p>
    </div>
  )
}
