/**
 * useReplaceUpload (issue #282)
 *
 * The transfer half of replacing the video behind a Baker link. It sits beside
 * useFileUpload rather than inside it because that hook is welded to the Add
 * Video flow: it hardcodes `uploadVideo`, records the result as the app's
 * latest upload, raises its own error toast and shares `selectedFile` with the
 * Add form. Driving a replace through it would make a replace completion
 * indistinguishable from an add.
 *
 * This hook keeps its own file and progress state, reports outcomes as values
 * for the dialog to render, and honours only events that carry its own
 * operation id -- there is no permissive window (see awaitUploadOutcome).
 */
import { useRef, useState } from 'react'

import { logger } from '@shared/utils'

import { cancelUpload as cancelUploadCommand, openFileDialog, replaceVideo } from '../api'
import { awaitUploadOutcome } from '../internal/awaitUploadOutcome'
import type {
  ReplaceUploadProgress,
  ReplaceUploadResult,
  ReplaceUploadStatus
} from '../types'

const IDLE_PROGRESS: ReplaceUploadProgress = {
  percentage: 0,
  bytesSent: 0,
  totalBytes: 0
}

export interface UseReplaceUploadReturn {
  selectedFile: string | null
  /** Opens the video picker; resolves with the path, or null when dismissed. */
  selectFile: () => Promise<string | null>
  clearFile: () => void
  /**
   * Replaces `videoId`'s source with the selected file. Resolves once the
   * backend has reported a terminal event; never rejects, never toasts.
   */
  start: (videoId: string, apiKey: string) => Promise<ReplaceUploadResult>
  /**
   * Signals cancellation. `status` becomes `cancelling` and only returns to
   * `idle` when the backend confirms with `upload_cancelled`, which is what
   * `start` then resolves on. A no-op when nothing is running.
   */
  cancel: () => Promise<void>
  progress: ReplaceUploadProgress
  status: ReplaceUploadStatus
  error: string | null
  /** Clears the error and progress; keeps the selected file. */
  reset: () => void
}

export const useReplaceUpload = (): UseReplaceUploadReturn => {
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [status, setStatus] = useState<ReplaceUploadStatus>('idle')
  const [progress, setProgress] = useState<ReplaceUploadProgress>(IDLE_PROGRESS)
  const [error, setError] = useState<string | null>(null)
  /**
   * The id the backend registered the running transfer under. A ref because
   * cancel must read the current value from a handler that may have closed over
   * an older render.
   */
  const operationIdRef = useRef<string | null>(null)

  const selectFile = async (): Promise<string | null> => {
    const file = await openFileDialog({
      multiple: false,
      filters: [{ name: 'Videos', extensions: ['mp4', 'mov', 'avi'] }]
    })
    if (typeof file !== 'string') return null
    setSelectedFile(file)
    return file
  }

  const clearFile = () => setSelectedFile(null)

  const reset = () => {
    setStatus('idle')
    setProgress(IDLE_PROGRESS)
    setError(null)
  }

  const fail = (message: string): ReplaceUploadResult => {
    setError(message)
    setStatus('error')
    return { status: 'error', message }
  }

  const start = async (videoId: string, apiKey: string): Promise<ReplaceUploadResult> => {
    const file = selectedFile
    if (!file) return fail('Choose the replacement video file first.')

    setStatus('uploading')
    setError(null)
    setProgress(IDLE_PROGRESS)
    operationIdRef.current = null

    try {
      const outcome = await awaitUploadOutcome({
        start: () => replaceVideo(file, apiKey, videoId),
        beforeIdKnown: 'buffer',
        onOperationId: (id) => {
          operationIdRef.current = id
        },
        onProgress: ({ percentage, bytesSent, totalBytes }) =>
          setProgress({ percentage, bytesSent, totalBytes })
      })

      if (outcome.kind === 'cancelled') {
        setStatus('idle')
        return { status: 'cancelled' }
      }

      // A 2xx whose video Sprout could not process is a failed replace with a
      // well-formed body, the same case useSproutVideoProcessor handles for adds.
      if (outcome.video.state === 'failed') {
        return fail(
          'Sprout Video could not process the replacement video. Check the file format and try again.'
        )
      }

      setStatus('idle')
      return { status: 'complete', video: outcome.video }
    } catch (caught) {
      // Terminal messages from the backend are already user-facing prose.
      return fail(typeof caught === 'string' ? caught : String(caught))
    } finally {
      operationIdRef.current = null
    }
  }

  const cancel = async () => {
    const operationId = operationIdRef.current
    if (!operationId) return

    setStatus('cancelling')
    try {
      await cancelUploadCommand(operationId)
    } catch (caught) {
      // The transfer is either already over or the backend is unreachable; the
      // liveness deadline reports a silent backend on its own.
      logger.warn('Could not signal cancellation for the replace:', caught)
    }
  }

  return {
    selectedFile,
    selectFile,
    clearFile,
    start,
    cancel,
    progress,
    status,
    error,
    reset
  }
}
