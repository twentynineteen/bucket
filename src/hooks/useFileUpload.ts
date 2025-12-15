import { appStore } from '@store/useAppStore'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { open } from '@tauri-apps/plugin-dialog'
import { SproutUploadResponse } from '@utils/types'
import { useState } from 'react'

import { logger } from '@/utils/logger'

interface UseFileUploadReturn {
  selectedFile: string | null
  uploading: boolean
  response: SproutUploadResponse | null
  selectFile: () => Promise<void>
  uploadFile: (apiKey: string | null) => Promise<void>
  resetUploadState: () => void
}

export const useFileUpload = (): UseFileUploadReturn => {
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [response, setResponse] = useState<SproutUploadResponse | null>(null)
  const [selectedFolder] = useState<string | null>(null)

  const selectFile = async () => {
    const file = await open({
      multiple: false,
      filters: [{ name: 'Videos', extensions: ['mp4', 'mov', 'avi'] }]
    })
    if (typeof file === 'string') {
      setSelectedFile(file)
    }
  }

  const resetUploadState = () => {
    setUploading(false)
    setResponse(null)
  }

  const uploadFile = async (apiKey: string | null) => {
    // Validate file selection and API key
    if (!selectedFile) {
      alert('Please select a video file.')
      return
    }
    if (!apiKey) {
      alert('API key is missing. Please set it in the settings.')
      return
    }

    // Reset state for new upload
    setUploading(true)
    setResponse(null)

    try {
      // Create a promise with timeout that will wait for either upload_complete or upload_error event
      const finalResponse = await new Promise<SproutUploadResponse>((resolve, reject) => {
        let completeUnlisten: Promise<() => void> | null = null
        let errorUnlisten: Promise<() => void> | null = null
        let timeoutId: NodeJS.Timeout | null = null

        const cleanup = async () => {
          if (timeoutId) clearTimeout(timeoutId)
          if (completeUnlisten) {
            try {
              const unsub = await completeUnlisten
              unsub()
            } catch (e) {
              logger.warn('Failed to unsubscribe from upload_complete:', e)
            }
          }
          if (errorUnlisten) {
            try {
              const unsub = await errorUnlisten
              unsub()
            } catch (e) {
              logger.warn('Failed to unsubscribe from upload_error:', e)
            }
          }
        }

        // Set up 45-minute timeout for large file uploads
        timeoutId = setTimeout(
          async () => {
            await cleanup()
            reject(
              'Upload timed out after 45 minutes. Please try again or check your network connection.'
            )
          },
          45 * 60 * 1000
        ) // 45 minutes

        // Listen for the upload_complete event and resolve with its payload
        completeUnlisten = listen('upload_complete', async (event) => {
          await cleanup()
          resolve(event.payload as SproutUploadResponse)
        })

        // Listen for the upload_error event and reject with its payload
        errorUnlisten = listen('upload_error', async (event) => {
          await cleanup()
          reject(event.payload)
        })

        // Invoke the Rust backend command to start the upload
        invoke('upload_video', {
          filePath: selectedFile,
          apiKey: apiKey,
          folderId: selectedFolder
        }).catch(async (error) => {
          await cleanup()
          reject(error)
        })
      })

      // Update the state with the final response from the backend upload
      setResponse(finalResponse)
      appStore.getState().setLatestSproutUpload(finalResponse)
      // Upload completed successfully
    } catch (error) {
      // Log and display any error encountered during the upload process
      logger.error('Upload error:', error)

      // Provide more specific error messages based on error type
      let errorMessage = 'Upload failed: '
      if (typeof error === 'string') {
        if (error.includes('timed out')) {
          errorMessage +=
            'The upload timed out. This can happen with very large files or slow network connections. Please try again.'
        } else if (error.includes('network') || error.includes('connection')) {
          errorMessage +=
            'Network connection error. Please check your internet connection and try again.'
        } else {
          errorMessage += error
        }
      } else {
        errorMessage += String(error)
      }

      alert(errorMessage)
    } finally {
      // Regardless of success or failure, mark the upload as finished
      setUploading(false)
    }
  }

  return {
    selectedFile,
    uploading,
    response,
    selectFile,
    uploadFile,
    resetUploadState
  }
}
