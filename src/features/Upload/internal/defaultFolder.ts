/**
 * The stored default upload folder, classified (issue #169)
 *
 * `sproutDefaultFolderId` is an opaque handle to something that lives in a
 * Sprout account, and the account can change without this app hearing about it.
 * Synthesising a folder object straight out of storage therefore renders a
 * folder that may have been deleted or renamed as the confident destination for
 * an upload -- structurally the same defect as #166, one layer up.
 *
 * Validation resolves against the **saved folder index**, which is a disk read
 * and zero Sprout requests. That constraint is not negotiable: Sprout allows
 * 200 requests/minute account-wide, shared with in-flight uploads, and #155 R1
 * settled that folders are never fetched speculatively. A live check is not
 * available anyway -- Sprout has no get-folder-by-id endpoint, so the only probe
 * is listing the folder's children, which spends budget to obtain an answer that
 * cannot separate "no such folder" from "no subfolders".
 *
 * The index is documented as a cache and never the source of truth, so absence
 * from it is only treated as evidence when the index is **complete** and belongs
 * to **this** account. Everything else is `unverified`: the stored folder is
 * offered unchanged and nothing is claimed about it. The stored value itself is
 * never modified here -- a stale index that has not yet seen a newly created
 * folder must not be able to destroy a working configuration (#166).
 */
import type { SelectedSproutFolder } from '../types'
import type { FolderIndex } from './folderIndex'
import { withPaths } from './folderPaths'

/** Why the stored default folder can or cannot be used as a destination. */
export type DefaultFolderStatus =
  /** Settings have not loaded yet, so nothing is known about the default. */
  | 'unknown'
  /** Settings could not be read, so the default is unknowable. */
  | 'settings-error'
  /** Settings loaded and hold no default folder: uploads go to the root. */
  | 'not-configured'
  /** A default is stored, and no index can vouch for it either way. */
  | 'unverified'
  /** A default is stored and the indexed folders contain it. */
  | 'verified'
  /** A complete index for this account does not contain it. */
  | 'missing'

export interface ResolvedDefaultFolder {
  status: DefaultFolderStatus
  /** The destination the default resolves to, or null for the account root. */
  folder: SelectedSproutFolder | null
  /** User-facing explanation, or null when there is nothing to explain. */
  reason: string | null
}

/** Label for a default saved before Settings recorded the folder's name. */
const UNNAMED_DEFAULT = 'Default folder'

const settingsErrorReason =
  'Could not read your settings, so the default upload folder is unknown.'

/**
 * Worded to be true whether the folder was deleted or renamed, and it claims no
 * more than the index can support -- hence "no longer among", not "deleted".
 * Re-indexing is named because a folder created after the index was built looks
 * identical from here, and that is the one false accusation this can make.
 */
const missingReason = (name: string) =>
  `Default upload folder "${name}" is no longer among this account's indexed folders. It may have been deleted or renamed on Sprout. Choose a folder, or re-index from the folder picker.`

export interface ResolveDefaultFolderInput {
  /** The settings read has not finished. */
  settingsPending: boolean
  /** The settings read failed, so `storedId` is unknowable rather than absent. */
  settingsError: boolean
  storedId: string | undefined
  /**
   * The label Settings saved with the id. Written as the folder's breadcrumb
   * path at the time it was chosen, so it can be shown before anything loads.
   */
  storedName: string | undefined
  /** The saved index for this account, or null when none applies. */
  index: FolderIndex | null
  /** The index file is still being read. */
  indexPending: boolean
}

/**
 * Priority order matters: a problem already known about is reported before a
 * check that has not finished, and no state is claimed while its own check is
 * still in flight.
 */
export function resolveDefaultFolder({
  settingsPending,
  settingsError,
  storedId,
  storedName,
  index,
  indexPending
}: ResolveDefaultFolderInput): ResolvedDefaultFolder {
  if (settingsError) {
    return { status: 'settings-error', folder: null, reason: settingsErrorReason }
  }
  if (settingsPending) return { status: 'unknown', folder: null, reason: null }
  if (!storedId) return { status: 'not-configured', folder: null, reason: null }

  const label = storedName ?? UNNAMED_DEFAULT
  const stored: SelectedSproutFolder = { id: storedId, name: label, path: label }

  // Nothing to check against. Offering the stored folder is the status quo, and
  // silence beats telling every user without an index that we cannot be sure.
  if (indexPending || !index)
    return { status: 'unverified', folder: stored, reason: null }

  // Paths are composed from the whole index so a verified folder shows its
  // current breadcrumb rather than the label captured when it was chosen -- a
  // folder renamed on Sprout reads correctly here.
  const indexed = withPaths(index.folders).find((folder) => folder.id === storedId)
  if (indexed) return { status: 'verified', folder: indexed, reason: null }

  // A crawl that was cancelled, bounded or errored has holes in it by
  // definition, so a folder it does not mention may simply never have been
  // reached.
  if (index.partial) return { status: 'unverified', folder: stored, reason: null }

  return { status: 'missing', folder: null, reason: missingReason(label) }
}
