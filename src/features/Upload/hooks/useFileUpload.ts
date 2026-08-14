import { appStore } from '@shared/store'
import { SproutUploadResponse } from '@shared/types'
import type { SelectedSproutFolder } from '../types'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

import { logger } from '@shared/utils'

import {
  cancelUpload as cancelUploadCommand,
  getVideoDuration,
  listenUploadCancelled,
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
 * (`sprout_upload.rs::supervise_upload`), which can see byte offsets and tear the
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
      // wall clock. Resolves null when the user cancelled: there is no response
      // to record and nothing went wrong.
      const finalResponse = await new Promise<SproutUploadResponse | null>(
        (resolve, reject) => {
          let completeUnlisten: Promise<() => void> | null = null
          let errorUnlisten: Promise<() => void> | null = null
          let progressUnlisten: Promise<() => void> | null = null
          let cancelledUnlisten: Promise<() => void> | null = null
          let silenceTimeoutId: NodeJS.Timeout | null = null

          /**
           * The operation the backend registered, once it has told us. Held here as
           * well as in the ref so the listeners below close over it directly.
           */
          let operationId: string | null = null

          /**
           * Whether an event belongs to this upload.
           *
           * Strict once the id is known, which is what stops a zombie operation's
           * events settling a retry (#150 UP-11). Permissive before then, because
           * `upload_video` resolves the id a tick after the backend starts reading:
           * only one upload is ever started by this hook, and any earlier one has
           * already emitted its single terminal event and been deregistered.
           */
          const isThisOperation = (eventOperationId: string) =>
            operationId === null || eventOperationId === operationId

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
            operationIdRef.current = null
            await unsubscribe(completeUnlisten, 'upload_complete')
            await unsubscribe(errorUnlisten, 'upload_error')
            await unsubscribe(progressUnlisten, 'upload_progress')
            await unsubscribe(cancelledUnlisten, 'upload_cancelled')
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
                  'running. Cancel it, and restart the app if that has no effect.'
              )
            }, BACKEND_SILENCE_TIMEOUT_MS)
          }

          armSilenceDeadline()

          // At most one of these per 100ms on the Rust side, so any transfer that
          // is alive at all keeps the deadline pushed out.
          progressUnlisten = listenUploadProgress((event) => {
            if (!isThisOperation(event.payload.operationId)) return
            armSilenceDeadline()
          })

          // Listen for the upload_complete event and resolve with its payload
          completeUnlisten = listenUploadComplete(async (event) => {
            if (!isThisOperation(event.payload.operationId)) return
            await cleanup()
            resolve(event.payload.video)
          })

          // Listen for the upload_error event and reject with its payload
          errorUnlisten = listenUploadError(async (event) => {
            if (!isThisOperation(event.payload.operationId)) return
            await cleanup()
            reject(event.payload.message)
          })

          // Cancellation settles the upload without being a failure, so it resolves
          // rather than rejects and carries no response to record.
          cancelledUnlisten = listenUploadCancelled(async (event) => {
            if (!isThisOperation(event.payload.operationId)) return
            await cleanup()
            resolve(null)
          })

          // Invoke the Rust backend command to start the upload
          uploadVideo(
            selectedFile,
            apiKey,
            destination?.id ?? null,
            title?.trim() || null
          )
            .then((registeredOperationId) => {
              operationId = registeredOperationId
              operationIdRef.current = registeredOperationId
            })
            .catch(async (error) => {
              await cleanup()
              reject(error)
            })
        }
      )

      // A cancelled upload produced nothing to record, and must not overwrite the
      // last successful upload in the store with a null.
      if (finalResponse) {
        setResponse(finalResponse)
        appStore.getState().setLatestSproutUpload(finalResponse)
      }
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
