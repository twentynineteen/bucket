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
  return names.filter((name) => {
    const dot = name.lastIndexOf('.')
    // `dot > 0` rather than `!== -1`: a name that is only an extension, like a
    // bare ".png", is a dotfile with nothing to match against.
    if (dot <= 0) return false
    return REFERENCE_IMAGE_EXTENSIONS.has(name.slice(dot).toLowerCase())
  })
}

/**
 * Resolves one pool's state.
 *
 * Priority order matters: a problem we already know about is reported before a
 * check that has not finished, and no state is claimed while its own check is
 * still in flight.
 */
export function resolveReferencePoolState({
  pool,
  settingsPending,
  settingsError,
  folder,
  isLoading,
  isError,
  listing
}: {
  pool: ReferencePool
  settingsPending: boolean
  settingsError: boolean
  folder: string | null
  isLoading: boolean
  isError: boolean
  listing: ReferencePoolListing | null
}): ReferencePoolState {
  if (settingsError) {
    return { status: 'settings-error', reason: REASONS.settingsError }
  }
  if (settingsPending) return { status: 'unknown', reason: null }
  if (!folder) return { status: 'not-configured', reason: REASONS.notConfigured }

  // Before the loading check, because an unexpected rejection leaves `listing`
  // null and would otherwise be reported as still in flight forever.
  if (isError) return { status: 'cannot-read', reason: cannotReadReason(folder, pool) }
  if (isLoading || !listing) return { status: 'loading', reason: null }

  if (listing.status === 'missing' || listing.status === 'unreadable') {
    // An `unreadable` detail is Tauri error text: logged by the caller, never
    // shown, because it is not something a user can act on.
    return { status: 'cannot-read', reason: cannotReadReason(folder, pool) }
  }

  if (listing.files.length === 0) {
    return { status: 'empty', reason: emptyReason(pool) }
  }

  return { status: 'ready', reason: null }
}

const REASONS = {
  settingsError: 'Could not read your settings, so the QC reference folder is unknown.',
  notConfigured: 'No QC reference folder configured. Set one in Settings.'
} as const

/**
 * Names the pool, not just "no images": with two pools under one folder, a
 * reason that omits which one is empty sends the user looking in the wrong
 * place.
 */
const emptyReason = (pool: ReferencePool) =>
  `The ${pool} folder contains no reference images.`

/** Worded to be true whether the subfolder is absent or merely unreadable. */
const cannotReadReason = (folder: string, pool: ReferencePool) =>
  `Cannot read the ${pool} folder: ${folder}/${pool}`
