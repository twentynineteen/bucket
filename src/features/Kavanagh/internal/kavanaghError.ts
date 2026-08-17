/**
 * Normalising QC failures (issue #180, stage 2)
 *
 * A rejected `invoke` hands back whatever the Rust side serialised, typed as
 * `unknown`. Every code path that shows an error needs a `KavanaghError`, and a screen
 * reading "[object Object]" is the failure mode this exists to prevent.
 */

import type { KavanaghError } from '../types'

const KINDS = [
  'busy',
  'cancelled',
  'unavailable',
  'probe',
  'ffmpeg',
  'referencePool',
  'threshold',
  'io'
] as const

/**
 * Turns an unknown rejection into a `KavanaghError`.
 *
 * Anything unrecognised becomes an `io` error carrying its own text rather than a
 * generic message: an unexpected shape is still worth showing, since it is the
 * only clue there is.
 */
export function asKavanaghError(error: unknown): KavanaghError {
  if (
    typeof error === 'object' &&
    error !== null &&
    'kind' in error &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string' &&
    KINDS.includes((error as { kind: string }).kind as (typeof KINDS)[number])
  ) {
    return error as KavanaghError
  }

  return {
    kind: 'io',
    message:
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : 'Quality control failed for an unknown reason.'
  }
}

/**
 * True when a failure is the operator's own cancellation.
 *
 * Cancelling is not a fault, so it must not be shown as one - a red alert after
 * someone deliberately stopped a run reads as a bug in the app.
 */
export function isCancellation(error: KavanaghError | null): boolean {
  return error?.kind === 'cancelled'
}
