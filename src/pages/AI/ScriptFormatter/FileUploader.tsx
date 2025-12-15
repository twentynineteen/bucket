/**
 * FileUploader Component
 * Feature: 006-i-wish-to (T043)
 * Purpose: Upload .docx files with validation
 */

import { open } from '@tauri-apps/plugin-dialog'
import { readFile } from '@tauri-apps/plugin-fs'
import { AlertCircle, FileText, Upload } from 'lucide-react'
import React, { useState } from 'react'

import { logger } from '@/utils/logger'

interface FileUploaderProps {
  onFileSelect: (file: File) => void
  isLoading?: boolean
  error?: Error | null
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  onFileSelect,
  isLoading = false,
  error = null
}) => {
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null)

  const handleUploadClick = async () => {
    try {
      // Trigger Tauri file dialog
      const selected = await open({
        filters: [
          {
            name: 'Word Documents',
            extensions: ['docx']
          }
        ],
        multiple: false
      })

      if (!selected || typeof selected !== 'string') {
        return
      }

      // Validate .docx extension
      if (!selected.toLowerCase().endsWith('.docx')) {
        throw new Error('File must be a .docx document')
      }

      // Read file using Tauri FS plugin
      const bytes = await readFile(selected)
      const filename = selected.split('/').pop() || 'document.docx'

      // Check file size (1GB limit)
      if (bytes.length > 1024 * 1024 * 1024) {
        throw new Error('File size exceeds 1GB limit')
      }

      // Create File object
      const file = new File([bytes], filename, {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      })

      setSelectedFileName(filename)
      onFileSelect(file)
    } catch (err) {
      logger.error('File upload error:', err)
      // Error is handled by parent component
    }
  }

  return (
    <div className="space-y-4">
      <div className="border-border hover:border-border/60 rounded-lg border-2 border-dashed p-8 text-center transition-colors">
        <button
          onClick={handleUploadClick}
          disabled={isLoading}
          className="flex w-full flex-col items-center gap-4 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <div className="border-primary h-12 w-12 animate-spin rounded-full border-b-2" />
              <p className="text-muted-foreground text-sm">Processing file...</p>
            </>
          ) : (
            <>
              {selectedFileName ? (
                <>
                  <FileText className="text-success h-12 w-12" />
                  <div>
                    <p className="text-foreground text-sm font-medium">
                      {selectedFileName}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Click to select a different file
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <Upload className="text-muted-foreground h-12 w-12" />
                  <div>
                    <p className="text-foreground text-sm font-medium">
                      Click to upload .docx script
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Maximum file size: 1GB
                    </p>
                  </div>
                </>
              )}
            </>
          )}
        </button>
      </div>

      {/* Display validation errors */}
      {error && (
        <div className="bg-destructive/10 border-destructive/20 flex items-start gap-2 rounded-lg border p-4">
          <AlertCircle className="text-destructive mt-0.5 h-5 w-5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-destructive text-sm font-medium">Upload Error</p>
            <p className="text-destructive/90 mt-1 text-sm">{error.message}</p>
          </div>
        </div>
      )}
    </div>
  )
}
