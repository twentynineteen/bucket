/**
 * Poster frame internals (Issue #140)
 *
 * Pure helpers shared by the poster frame upload hook: filename derivation,
 * canvas export, Sprout error classification and the retry backoff.
 */

import type { PosterFrameError } from '../types'

/** Sprout Video's hard limit for jpg/png poster frames. */
export const POSTER_FRAME_MAX_BYTES = 500 * 1024

/** Backoff between poster frame attempts — three retries after the first try. */
export const POSTER_FRAME_RETRY_DELAYS_MS = [2000, 5000, 10000]

/**
 * Builds the filename stem for a poster frame, matching the convention the
 * Posterframe page already uses for saved thumbnails.
 */
export function posterFrameFileStem(text: string): string {
  const sanitised = text.trim().replace(/[^a-zA-Z0-9]/g, '_')
  return sanitised ? `posterframe-${sanitised}` : 'posterframe'
}

/** Normalises an unknown rejection into the backend's error shape. */
export function toPosterFrameError(error: unknown): PosterFrameError {
  if (error && typeof error === 'object' && 'message' in error) {
    const candidate = error as { status?: number | null; message?: unknown }
    return {
      status: typeof candidate.status === 'number' ? candidate.status : null,
      message: String(candidate.message ?? 'Poster frame upload failed')
    }
  }

  return { status: null, message: String(error) }
}

/**
 * True when another attempt with the same bytes could plausibly succeed:
 * transport failures (no status), server errors and rate limiting. A 413 or
 * an auth/not-found failure will fail identically every time, so those are
 * terminal.
 */
export function isTransientPosterFrameError(error: unknown): boolean {
  const { status } = toPosterFrameError(error)

  if (status === null) return true
  if (status === 429) return true
  return status >= 500 && status < 600
}

/** Human-readable failure text, with the size spelled out for a 413. */
export function describePosterFrameError(error: unknown, byteLength: number): string {
  const { status, message } = toPosterFrameError(error)

  if (status === 413) {
    const actual = Math.round(byteLength / 1024)
    const limit = Math.round(POSTER_FRAME_MAX_BYTES / 1024)
    return `Poster frame is ${actual} KB — Sprout Video allows up to ${limit} KB. Use a lighter background image.`
  }

  return status ? `${message} (HTTP ${status})` : message
}

/** Awaitable sleep, isolated here so tests can skip the real backoff. */
export function posterFrameDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Snapshots a canvas as JPEG bytes. Matches the Posterframe page's export
 * exactly (native canvas size, default quality) so both paths produce the
 * same image.
 */
export function exportCanvasJpeg(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error('Could not render the poster frame from the canvas'))
        return
      }

      try {
        resolve(new Uint8Array(await blob.arrayBuffer()))
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    }, 'image/jpeg')
  })
}
