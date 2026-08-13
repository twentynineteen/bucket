/**
 * useKavanaghCheck (issue #180, stages 2-3, B3-B8, B10, B11)
 *
 * Owns one run: starting it, showing its progress, cancelling it, and holding
 * the report it produced. One run covers both checks - the watermark and the
 * closing tail - because the tail has to run first to tell the watermark pass
 * where to stop (D9).
 *
 * The report is held in memory here and nowhere else (D16). Failure thumbnails
 * come with it as JPEG bytes and are never written to disk unless the operator
 * asks (D15), which is why they live in React state rather than a cache with an
 * eviction policy nobody controls.
 */

import { useMutation } from '@tanstack/react-query'
import React from 'react'

import {
  cancelKavanaghRun,
  listenKavanaghProgress,
  runKavanaghCheck,
  type KavanaghCheckRequest
} from '../api'
import { asKavanaghError, isCancellation } from '../internal/kavanaghError'
import type { KavanaghCheckReport, KavanaghError, KavanaghProgressEvent } from '../types'

export interface UseKavanaghCheckResult {
  /** True while a run is in flight, which is what disables a second start (B8.6). */
  isRunning: boolean
  /** The most recent progress event, or null before the first one arrives. */
  progress: KavanaghProgressEvent | null
  /** The report from the last completed run, or null. */
  report: KavanaghCheckReport | null
  /** Why the last run failed, or null. A cancellation is not surfaced here. */
  error: KavanaghError | null
  run: (request: KavanaghCheckRequest) => Promise<void>
  cancel: () => Promise<void>
  /** Clears the report and any error, releasing the thumbnails held with it. */
  reset: () => void
}

export function useKavanaghCheck(): UseKavanaghCheckResult {
  const [progress, setProgress] = React.useState<KavanaghProgressEvent | null>(null)
  const [report, setReport] = React.useState<KavanaghCheckReport | null>(null)
  const [error, setError] = React.useState<KavanaghError | null>(null)

  // Subscribed for the page's lifetime rather than per run: `listen` resolves
  // asynchronously, so subscribing at the moment a run starts races the first
  // events and loses them.
  React.useEffect(() => {
    let unlisten: (() => void) | null = null
    let cancelled = false

    listenKavanaghProgress((event) => setProgress(event.payload))
      .then((stop) => {
        if (cancelled) {
          stop()
          return
        }
        unlisten = stop
      })
      .catch(() => {
        // No progress events is a degraded page, not a broken one: the run still
        // completes and still reports.
      })

    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [])

  const mutation = useMutation({
    mutationFn: runKavanaghCheck,
    // A QC run costs a full decode pass. Retrying one automatically would double
    // that for a failure that is nearly always a real one.
    retry: false,
    onMutate: () => {
      setProgress(null)
      setReport(null)
      setError(null)
    },
    onSuccess: (result) => setReport(result),
    onError: (raised) => {
      const normalised = asKavanaghError(raised)
      // A cancellation is the operator's own doing, so it clears the run rather
      // than showing a failure they would read as a bug.
      setError(isCancellation(normalised) ? null : normalised)
    }
  })

  const run = React.useCallback(
    async (request: KavanaghCheckRequest) => {
      try {
        await mutation.mutateAsync(request)
      } catch {
        // Already recorded in `onError`; rethrowing would make every caller
        // handle a failure the hook has already turned into state.
      }
    },
    [mutation]
  )

  const cancel = React.useCallback(async () => {
    try {
      await cancelKavanaghRun()
    } catch (raised) {
      setError(asKavanaghError(raised))
    }
  }, [])

  const reset = React.useCallback(() => {
    setReport(null)
    setError(null)
    setProgress(null)
  }, [])

  return {
    isRunning: mutation.isPending,
    progress,
    report,
    error,
    run,
    cancel,
    reset
  }
}
