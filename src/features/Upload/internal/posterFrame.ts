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
    // Compression already ran before the upload (issue #189), so a 413 here
    // means even the quality floor could not fit the frame - advising a
    // lighter background would be misdirection.
    return `Poster frame is ${actual} KB — Sprout Video allows up to ${limit} KB, and compressing further would degrade it too much.`
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
export function exportCanvasJpeg(
  canvas: HTMLCanvasElement,
  quality?: number
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          reject(new Error('Could not render the poster frame from the canvas'))
          return
        }

        try {
          resolve(new Uint8Array(await blob.arrayBuffer()))
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)))
        }
      },
      'image/jpeg',
      quality
    )
  })
}

/**
 * Quality steps tried when the default-quality export is over the limit.
 * 0.5 is the floor: below that a 1080p frame looks worse than the
 * auto-generated still it replaces.
 */
export const POSTER_FRAME_QUALITY_STEPS = [0.9, 0.8, 0.7, 0.6, 0.5]

/** The export could not be brought under the limit, even at the floor. */
export class PosterFrameTooLargeError extends Error {
  readonly byteLength: number

  constructor(byteLength: number, maxBytes: number) {
    const actual = Math.round(byteLength / 1024)
    const limit = Math.round(maxBytes / 1024)
    super(
      `Poster frame is ${actual} KB even at the lowest quality — the limit is ${limit} KB. Use a simpler background image.`
    )
    this.name = 'PosterFrameTooLargeError'
    this.byteLength = byteLength
  }
}

export type CanvasJpegEncoder = (
  canvas: HTMLCanvasElement,
  quality?: number
) => Promise<Uint8Array>

/**
 * Exports a canvas as JPEG at or under `maxBytes` (issue #189 B5.1-B5.3).
 *
 * The first attempt passes no quality at all, so an export that already fits
 * is byte-identical to the single-shot export both surfaces used before. Only
 * an oversized frame pays for re-encoding, stepping the quality down to the
 * floor and throwing {@link PosterFrameTooLargeError} if even that is over.
 */
export async function exportCanvasJpegUnder(
  canvas: HTMLCanvasElement,
  maxBytes: number,
  encode: CanvasJpegEncoder = exportCanvasJpeg
): Promise<Uint8Array> {
  let bytes = await encode(canvas, undefined)
  if (bytes.byteLength <= maxBytes) return bytes

  for (const quality of POSTER_FRAME_QUALITY_STEPS) {
    bytes = await encode(canvas, quality)
    if (bytes.byteLength <= maxBytes) return bytes
  }

  throw new PosterFrameTooLargeError(bytes.byteLength, maxBytes)
}
