/**
 * ReviewStep Component
 * Step 4: Review and Edit Formatted Script
 */

import { Database, Download, Save } from 'lucide-react'
import React from 'react'

import { DiffEditor } from '../DiffEditor'

interface ReviewStepProps {
  originalText: string
  modifiedText: string
  examplesCount: number
  isGenerating: boolean
  generateError: Error | null
  onModifiedChange: (value: string) => void
  onDownload: () => void
  onOpenSaveDialog: () => void
}

export const ReviewStep: React.FC<ReviewStepProps> = ({
  originalText,
  modifiedText,
  examplesCount,
  isGenerating,
  generateError,
  onModifiedChange,
  onDownload,
  onOpenSaveDialog
}) => {
  return (
    <div className="w-full space-y-6">
      {/* Header with actions */}
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div className="flex items-center gap-3">
          <h3 className="text-foreground text-lg font-medium">Review and Edit</h3>
          {examplesCount > 0 && (
            <div className="bg-info/10 border-info/20 text-info flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs">
              <Database className="h-3 w-3" />
              <span className="hidden sm:inline">
                Enhanced with {examplesCount} example{examplesCount > 1 ? 's' : ''}
              </span>
              <span className="sm:hidden">{examplesCount} ex.</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenSaveDialog}
            className="bg-primary text-primary-foreground hover:bg-primary/90 flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 whitespace-nowrap disabled:opacity-50 lg:flex-initial"
            title="Save this script as an example for future RAG-enhanced formatting"
          >
            <Save className="h-4 w-4" />
            <span className="hidden md:inline">Save as Example</span>
          </button>
          <button
            onClick={onDownload}
            disabled={isGenerating}
            className="bg-success text-success-foreground hover:bg-success/90 flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 whitespace-nowrap disabled:opacity-50 lg:flex-initial"
          >
            <Download className="h-4 w-4" />
            <span className="hidden md:inline">
              {isGenerating ? 'Downloading...' : 'Download Formatted Script'}
            </span>
            <span className="md:hidden">Download</span>
          </button>
        </div>
      </div>

      {/* Diff Editor */}
      <DiffEditor
        original={originalText}
        modified={modifiedText}
        onModifiedChange={onModifiedChange}
      />

      {/* Error Display */}
      {generateError && (
        <div className="bg-destructive/10 border-destructive/20 rounded-lg border p-4">
          <p className="text-destructive text-sm">{generateError.message}</p>
        </div>
      )}
    </div>
  )
}
