/**
 * DownloadCompleteStep Component
 * Step 5: Download Complete Success State
 */

import { Download } from 'lucide-react'
import React from 'react'

interface DownloadCompleteStepProps {
  onFormatAnother: () => void
}

export const DownloadCompleteStep: React.FC<DownloadCompleteStepProps> = ({
  onFormatAnother
}) => {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="bg-success/10 border-success/20 rounded-lg border p-8 text-center">
        <Download className="text-success mx-auto mb-4 h-16 w-16" />
        <h3 className="text-foreground mb-2 text-lg font-medium">Download Complete!</h3>
        <p className="text-muted-foreground mb-4 text-sm">
          Your formatted script has been saved successfully.
        </p>
        <button
          onClick={onFormatAnother}
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-6 py-2"
        >
          Format Another Script
        </button>
      </div>
    </div>
  )
}
