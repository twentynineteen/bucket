/**
 * Waits for a Sprout transfer to reach a terminal event.
 *
 * Extracted from useFileUpload (issue #282) so the replace transfer can share
 * the listener wiring, the liveness deadline and the operation-id matching
 * instead of copying 110 lines of them. The behaviour useFileUpload had is
 * preserved exactly under `beforeIdKnown: 'accept'`; the replace hook uses
 * `'buffer'`, which closes the permissive window described below.
 */
import { logger } from '@shared/utils'

import {
  listenUploadCancelled,
  listenUploadComplete,
  listenUploadError,
  listenUploadProgress
} from '../api'
import type {
  SproutUploadResponse,
  UploadCancelledEvent,
  UploadCompleteEvent,
  UploadErrorEvent,
  UploadProgressEvent
} from '../types'

/**
 * How long to wait for *any* word from the backend -- a progress event or a
 * terminal event -- before concluding the backend itself has stopped talking.
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
 * healthy upload of a very large file over a slow connection. See issue #204.
 */
export const BACKEND_SILENCE_TIMEOUT_MS = 150_000

export type UploadOutcome =
  | { kind: 'complete'; video: SproutUploadResponse }
  | { kind: 'cancelled' }

export interface AwaitUploadOutcomeOptions {
  /** Invokes the backend command and resolves with the operation id it registered. */
  start: () => Promise<string>
  /**
   * What to do with events that arrive before `start` has resolved the id.
   *
   * `accept` is useFileUpload's historical behaviour: any id is taken as ours,
   * because that hook only ever runs one transfer and an earlier one has already
   * emitted its single terminal event. It leaves a window of a few milliseconds
   * in which a zombie operation's completion would be mistaken for this one's.
   *
   * `buffer` holds early events and replays only those whose id turns out to
   * match, so nothing foreign is honoured and nothing of ours is dropped.
   */
  beforeIdKnown: 'accept' | 'buffer'
  /** Called as soon as the backend has told us the operation id. */
  onOperationId?: (operationId: string) => void
  /** Called for every progress event that belongs to this transfer. */
  onProgress?: (event: UploadProgressEvent) => void
  silenceTimeoutMs?: number
}

type Buffered =
  | { channel: 'progress'; payload: UploadProgressEvent }
  | { channel: 'complete'; payload: UploadCompleteEvent }
  | { channel: 'error'; payload: UploadErrorEvent }
  | { channel: 'cancelled'; payload: UploadCancelledEvent }

/**
 * Resolves with the terminal outcome, or rejects with a user-facing string when
 * the backend reported an error, refused to start, or went silent.
 */
export function awaitUploadOutcome(
  options: AwaitUploadOutcomeOptions
): Promise<UploadOutcome> {
  const {
    start,
    beforeIdKnown,
    onOperationId,
    onProgress,
    silenceTimeoutMs = BACKEND_SILENCE_TIMEOUT_MS
  } = options

  return new Promise<UploadOutcome>((resolve, reject) => {
    let completeUnlisten: Promise<() => void> | null = null
    let errorUnlisten: Promise<() => void> | null = null
    let progressUnlisten: Promise<() => void> | null = null
    let cancelledUnlisten: Promise<() => void> | null = null
    let silenceTimeoutId: NodeJS.Timeout | null = null

    /** The operation the backend registered, once it has told us. */
    let operationId: string | null = null
    let settled = false
    const buffered: Buffered[] = []

    const unsubscribe = async (pending: Promise<() => void> | null, channel: string) => {
      if (!pending) return
      try {
        const unsub = await pending
        unsub()
      } catch (e) {
        logger.warn(`Failed to unsubscribe from ${channel}:`, e)
      }
    }

    const cleanup = async () => {
      settled = true
      if (silenceTimeoutId) clearTimeout(silenceTimeoutId)
      await unsubscribe(completeUnlisten, 'upload_complete')
      await unsubscribe(errorUnlisten, 'upload_error')
      await unsubscribe(progressUnlisten, 'upload_progress')
      await unsubscribe(cancelledUnlisten, 'upload_cancelled')
    }

    /**
     * (Re)arms the backend liveness deadline. Called once at the start and again
     * on every progress event, so the deadline measures *silence* and not elapsed
     * time: a transfer that is still moving bytes can run for as long as it needs.
     */
    const armSilenceDeadline = () => {
      if (silenceTimeoutId) clearTimeout(silenceTimeoutId)
      silenceTimeoutId = setTimeout(async () => {
        await cleanup()
        reject(
          'The upload backend stopped responding: no progress and no result for ' +
            `${silenceTimeoutMs / 1000} seconds. The transfer may still be ` +
            'running. Cancel it, and restart the app if that has no effect.'
        )
      }, silenceTimeoutMs)
    }

    const handle = async (event: Buffered) => {
      if (settled) return
      switch (event.channel) {
        case 'progress':
          armSilenceDeadline()
          onProgress?.(event.payload)
          return
        case 'complete':
          await cleanup()
          resolve({ kind: 'complete', video: event.payload.video })
          return
        case 'error':
          await cleanup()
          reject(event.payload.message)
          return
        case 'cancelled':
          // Cancellation settles the transfer without being a failure.
          await cleanup()
          resolve({ kind: 'cancelled' })
      }
    }

    /**
     * Routes an event: dropped when it is not ours, held when we cannot yet tell
     * (buffer mode), otherwise handled. Strict once the id is known, which is
     * what stops a zombie operation's events settling a retry (#150 UP-11).
     */
    const route = async (event: Buffered) => {
      if (operationId !== null) {
        if (event.payload.operationId === operationId) await handle(event)
        return
      }
      if (beforeIdKnown === 'accept') {
        await handle(event)
        return
      }
      buffered.push(event)
    }

    armSilenceDeadline()

    // At most one of these per 100ms on the Rust side, so any transfer that is
    // alive at all keeps the deadline pushed out.
    progressUnlisten = listenUploadProgress((event) =>
      route({ channel: 'progress', payload: event.payload })
    )
    completeUnlisten = listenUploadComplete((event) =>
      route({ channel: 'complete', payload: event.payload })
    )
    errorUnlisten = listenUploadError((event) =>
      route({ channel: 'error', payload: event.payload })
    )
    cancelledUnlisten = listenUploadCancelled((event) =>
      route({ channel: 'cancelled', payload: event.payload })
    )

    start()
      .then(async (registeredOperationId) => {
        if (settled) return
        operationId = registeredOperationId
        onOperationId?.(registeredOperationId)
        // Replay what arrived before we knew who we were, ours only, in order.
        const held = buffered.splice(0)
        for (const event of held) {
          if (event.payload.operationId === operationId) await handle(event)
        }
      })
      .catch(async (error) => {
        await cleanup()
        reject(error)
      })
  })
}
