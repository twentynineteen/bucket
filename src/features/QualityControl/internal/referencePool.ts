/**
 * Reference pool internals (issue #180, stage 1)
 *
 * QC compares frames against a pool of reference images: watermarks in
 * `watermarks/` and sting stills in `stings/`, both under one folder configured
 * in Settings.
 *
 * The state vocabulary deliberately matches `useBackgroundFolder` in
 * @features/Upload. Issue #166 was caused by collapsing "no folder set", "the
 * folder is gone" and "the folder is empty" into one unavailable state, which
 * sent people to Settings to re-enter a path that was already correct. The same
 * mistake is available here and is avoided the same way.
 */

/** The two reference pools QC reads. Subfolder names double as the pool ids. */
export const REFERENCE_POOLS = ['watermarks', 'stings'] as const

export type ReferencePool = (typeof REFERENCE_POOLS)[number]

/** Extensions accepted as reference images. Stings are supplied as JPGs. */
export const REFERENCE_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png'])

/** Why a pool cannot be used, or `ready` when it can. */
export type ReferencePoolStatus =
  /** Settings have not loaded, so we do not know what is configured. */
  | 'unknown'
  /** Settings could not be read, so the configured folder is unknowable. */
  | 'settings-error'
  /** Settings loaded and hold no reference folder. */
  | 'not-configured'
  /** A folder is configured and its listing is in flight. */
  | 'loading'
  /** The pool subfolder is absent, or present but unreadable. */
  | 'cannot-read'
  /** The subfolder listed fine but holds no reference images. */
  | 'empty'
  /** The subfolder listed fine and holds at least one reference image. */
  | 'ready'

/** Outcome of listing one pool subfolder. */
export type ReferencePoolListing =
  | { status: 'ok'; files: string[] }
  | { status: 'missing' }
  | { status: 'unreadable'; detail: string }

export interface ReferencePoolState {
  status: ReferencePoolStatus
  /** User-facing explanation, or null when there is nothing to explain. */
  reason: string | null
}

/** Keeps only files QC can actually decode as a reference image. */
export function filterReferenceImages(names: string[]): string[] {
  void names
  throw new Error('not implemented')
}

/**
 * Resolves one pool's state.
 *
 * Priority order matters: a problem we already know about is reported before a
 * check that has not finished, and no state is claimed while its own check is
 * still in flight.
 */
export function resolveReferencePoolState(input: {
  pool: ReferencePool
  settingsPending: boolean
  settingsError: boolean
  folder: string | null
  isLoading: boolean
  isError: boolean
  listing: ReferencePoolListing | null
}): ReferencePoolState {
  void input
  throw new Error('not implemented')
}
