import { appStore } from '@shared/store'
import { SproutUploadResponse } from '@shared/types'
import type { SelectedSproutFolder } from '../types'
import { useState } from 'react'
import { toast } from 'sonner'

import { logger } from '@shared/utils'

import {
  getVideoDuration,
  listenUploadComplete,
  listenUploadError,
  listenUploadProgress,
  openFileDialog,
  uploadVideo
} from '../api'

/**
 * How long the hook waits for *any* word from the backend -- a progress event or
 * a terminal event -- before concluding the backend itself has stopped talking.
 *
 * This is not stall detection. Stall detection lives in Rust
 * (`sprout_upload.rs::watch_for_stall`), which can see byte offsets and tear the
 * request down; the frontend can only observe the absence of events, which is a
 * weaker signal. What this timer covers is the one thing Rust cannot report: the
 * backend going silent altogether.
 *
 * Two full Rust stall windows (70s each) plus slack, so the watchdog always wins
 * the race and the user gets the specific message rather than this vague one. The
 * deadline is rearmed by every progress event, which is what stops it killing a
 * healthy upload of a very large file over a slow connection -- the flat
 * 45-minute deadline it replaces was armed once at invocation and never consulted
 * progress, so it was wrong in both directions. See issue #204.
 */
const BACKEND_SILENCE_TIMEOUT_MS = 150_000

interface UseFileUploadReturn {
  selectedFile: string | null
  uploading: boolean
  response: SproutUploadResponse | null
  localDuration: number | null
  /** Destination folder on Sprout. Null uploads to the account root. */
  selectedFolder: SelectedSproutFolder | null
  setSelectedFolder: (folder: SelectedSproutFolder | null) => void
  selectFile: () => Promise<string | null>
  /**
   * Starts the upload. `folder` overrides `selectedFolder` when given -- callers
   * that resolve the destination themselves (default / recently-used) pass it
   * explicitly rather than setting state first, which would upload against the
   * pre-update value.
   */
  uploadFile: (
    apiKey: string | null,
    title?: string,
    folder?: SelectedSproutFolder | null
  ) => Promise<void>
  resetUploadState: () => void
}

export const useFileUpload = (): UseFileUploadReturn => {
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [response, setResponse] = useState<SproutUploadResponse | null>(null)
  const [localDuration, setLocalDuration] = useState<number | null>(null)
  // Before #155 this was a setter-less useState pinned to null, so every upload
  // landed in the account root no matter what the user wanted.
  const [selectedFolder, setSelectedFolder] = useState<SelectedSproutFolder | null>(null)

  const selectFile = async (): Promise<string | null> => {
    const file = await openFileDialog({
      multiple: false,
      filters: [{ name: 'Videos', extensions: ['mp4', 'mov', 'avi'] }]
    })
    if (typeof file === 'string') {
      setSelectedFile(file)
      // Probe the local file for duration as a fallback for when Sprout
      // hasn't finished processing at Trello-update time. Non-fatal.
      setLocalDuration(null)
      getVideoDuration(file)
        .then((duration) => setLocalDuration(duration))
        .catch((error) => {
          logger.warn('Could not read local video duration:', error)
          setLocalDuration(null)
        })
      return file
    }
    return null
  }

  const resetUploadState = () => {
    setUploading(false)
    setResponse(null)
  }

  const uploadFile = async (
    apiKey: string | null,
    title?: string,
    folder?: SelectedSproutFolder | null
  ) => {
    const destination = folder !== undefined ? folder : selectedFolder
    // Validate file selection and API key
    if (!selectedFile) {
      toast.error('Please select a video file.')
      return
    }
    if (!apiKey) {
      toast.error('API key is missing. Please set it in the settings.')
      return
    }

    // Reset state for new upload
    setUploading(true)
    setResponse(null)

    try {
      // Waits for upload_complete or upload_error, backed by a liveness deadline
      // that follows the transfer's progress rather than the wall clock.
      const finalResponse = await new Promise<SproutUploadResponse>((resolve, reject) => {
        let completeUnlisten: Promise<() => void> | null = null
        let errorUnlisten: Promise<() => void> | null = null
        let progressUnlisten: Promise<() => void> | null = null
        let silenceTimeoutId: NodeJS.Timeout | null = null

        const unsubscribe = async (
          pending: Promise<() => void> | null,
          channel: string
        ) => {
          if (!pending) return
          try {
            const unsub = await pending
            unsub()
          } catch (e) {
            logger.warn(`Failed to unsubscribe from ${channel}:`, e)
          }
        }

        const cleanup = async () => {
          if (silenceTimeoutId) clearTimeout(silenceTimeoutId)
          await unsubscribe(completeUnlisten, 'upload_complete')
          await unsubscribe(errorUnlisten, 'upload_error')
          await unsubscribe(progressUnlisten, 'upload_progress')
        }

        /**
         * (Re)arms the backend liveness deadline. Called once at the start and
         * again on every progress event, so the deadline measures *silence* and
         * not elapsed time: an upload that is still moving bytes can run for as
         * long as it needs to.
         */
        const armSilenceDeadline = () => {
          if (silenceTimeoutId) clearTimeout(silenceTimeoutId)
          silenceTimeoutId = setTimeout(async () => {
            await cleanup()
            reject(
              'The upload backend stopped responding: no progress and no result for ' +
                `${BACKEND_SILENCE_TIMEOUT_MS / 1000} seconds. The transfer may still be ` +
                'running in the background; restart the app before trying again.'
            )
          }, BACKEND_SILENCE_TIMEOUT_MS)
        }

        armSilenceDeadline()

        // Every 64 KB read on the Rust side emits one of these, so any transfer
        // that is alive at all keeps the deadline pushed out.
        progressUnlisten = listenUploadProgress(() => {
          armSilenceDeadline()
        })

        // Listen for the upload_complete event and resolve with its payload
        completeUnlisten = listenUploadComplete(async (event) => {
          await cleanup()
          resolve(event.payload as SproutUploadResponse)
        })

        // Listen for the upload_error event and reject with its payload
        errorUnlisten = listenUploadError(async (event) => {
          await cleanup()
          reject(event.payload)
        })

        // Invoke the Rust backend command to start the upload
        uploadVideo(
          selectedFile,
          apiKey,
          destination?.id ?? null,
          title?.trim() || null
        ).catch(async (error) => {
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

      // Passed through verbatim. Every terminal message the backend sends is
      // already user-facing prose -- #152 classified the failures that report
      // themselves, #154 the oversized file, #204 the stall -- so the two
      // `includes()` rewrites that used to live here only destroyed detail. A
      // stall message reading "no data has reached Sprout for 71s, stopped at
      // 1.68 GB of 4.10 GB" matched `includes('connection')` and was rewritten
      // into a generic "Network connection error", discarding precisely the
      // information that lets a user tell a dead transfer from a slow one. #152
      // removed the same string sniffing at two other sites.
      toast.error(`Upload failed: ${typeof error === 'string' ? error : String(error)}`)
    } finally {
      // Regardless of success or failure, mark the upload as finished
      setUploading(false)
    }
  }

  return {
    selectedFile,
    uploading,
    response,
    localDuration,
    selectedFolder,
    setSelectedFolder,
    selectFile,
    uploadFile,
    resetUploadState
  }
}
