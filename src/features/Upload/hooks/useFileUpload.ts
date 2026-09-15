import { appStore } from '@shared/store'
import { SproutUploadResponse } from '@shared/types'
import type { SelectedSproutFolder } from '../types'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

import { logger } from '@shared/utils'

import {
  cancelUpload as cancelUploadCommand,
  getVideoDuration,
  openFileDialog,
  uploadVideo
} from '../api'
import { awaitUploadOutcome } from '../internal/awaitUploadOutcome'

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
  /**
   * Stops the upload in flight, tearing the request down rather than merely
   * detaching the UI from it. A no-op when nothing is running.
   *
   * Before #225 there was no cancel path at all, which is why #204 had to put
   * stall detection in Rust: the frontend could watch a transfer die but never
   * end it. Resolves once the cancellation has been signalled; the terminal
   * `upload_cancelled` event is what settles `uploading`.
   */
  cancelUpload: () => Promise<void>
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
  /**
   * The id the backend registered the running upload under, or null when nothing
   * is running. A ref rather than state: cancelling must read the current value
   * from an event handler that may have closed over an older render.
   */
  const operationIdRef = useRef<string | null>(null)

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
    operationIdRef.current = null
  }

  const cancelUpload = async () => {
    const operationId = operationIdRef.current
    // Nothing running. A dialog is routinely dismissed when no upload is in
    // flight, and naming an operation that never existed would be noise.
    if (!operationId) return

    try {
      await cancelUploadCommand(operationId)
    } catch (error) {
      // The upload is either already over or the backend is unreachable. Neither
      // is worth a toast on top of whatever the user is already seeing, and the
      // liveness deadline will report a silent backend on its own.
      logger.warn('Could not signal cancellation for the upload:', error)
    }
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
    operationIdRef.current = null

    try {
      // Waits for a terminal event -- complete, error or cancelled -- backed by a
      // liveness deadline that follows the transfer's progress rather than the
      // wall clock (see awaitUploadOutcome). Events are accepted permissively
      // until the backend names the operation, as this hook always has: it only
      // ever starts one upload, and any earlier one has already emitted its
      // single terminal event and been deregistered (#150 UP-11).
      const outcome = await awaitUploadOutcome({
        start: () =>
          uploadVideo(
            selectedFile,
            apiKey,
            destination?.id ?? null,
            title?.trim() || null
          ),
        beforeIdKnown: 'accept',
        onOperationId: (registeredOperationId) => {
          operationIdRef.current = registeredOperationId
        }
      })

      // A cancelled upload produced nothing to record, and must not overwrite the
      // last successful upload in the store with a null.
      if (outcome.kind === 'complete') {
        setResponse(outcome.video)
        appStore.getState().setLatestSproutUpload(outcome.video)
      }
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
      // Regardless of success, failure or cancellation, the upload is over
      setUploading(false)
      operationIdRef.current = null
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
    cancelUpload,
    resetUploadState
  }
}
