/**
 * Sharing a folder index between team members (issue #155, search)
 *
 * Indexing a large account takes minutes and spends a chunk of a shared
 * 200 requests/minute budget. Exporting lets one person pay that once and
 * everyone else import the result for a single request.
 *
 * The hard part is not the file, it is deciding whether an imported index
 * belongs to *your* account:
 *
 * - The `account` field is a fingerprint of the API key, so two colleagues with
 *   different keys to the same Sprout account produce different fingerprints.
 *   Requiring a match would reject a perfectly good shared index.
 * - Ignoring the account entirely would let another account's tree in, and its
 *   folder ids do not exist for you -- uploads would be filed against ids
 *   Sprout rejects, or worse, silently land somewhere unexpected.
 *
 * So the check is on the data rather than the key: two indexes of the same
 * account share folder **ids**. Comparing the imported root folders against the
 * account's real root folders (one request) settles it.
 */
import type { SproutFolder } from '@shared/types'

import type { FolderIndex } from './folderIndex'
import { FOLDER_INDEX_VERSION, accountFingerprint } from './folderIndex'

export interface ImportedIndex {
  folders: SproutFolder[]
  partial: boolean
  /** Fingerprint from the file. Informational — never used to accept or reject. */
  account: string | null
  /** When the exporting machine built it. */
  indexedAt: string | null
}

function isFolder(value: unknown): value is SproutFolder {
  if (!value || typeof value !== 'object') return false
  const { id, name, parent_id: parentId } = value as Record<string, unknown>
  return (
    typeof id === 'string' &&
    typeof name === 'string' &&
    (parentId === null || typeof parentId === 'string')
  )
}

/**
 * Reads an exported index file.
 *
 * Deliberately does NOT check the account fingerprint — see the module note.
 * Returns null for anything structurally unusable.
 */
export function parseImportedIndex(raw: unknown): ImportedIndex | null {
  if (!raw || typeof raw !== 'object') return null

  const { version, account, indexedAt, partial, folders } = raw as Record<string, unknown>

  if (version !== FOLDER_INDEX_VERSION) return null
  if (!Array.isArray(folders) || folders.length === 0) return null
  if (!folders.every(isFolder)) return null

  return {
    folders,
    partial: partial === true,
    account: typeof account === 'string' ? account : null,
    indexedAt: typeof indexedAt === 'string' ? indexedAt : null
  }
}

export type ImportVerdict =
  | { ok: true; reason: 'matches-account' }
  | { ok: true; reason: 'unverifiable' }
  | { ok: false; reason: 'different-account' }

/**
 * Decides whether an imported index describes this account.
 *
 * `actualRootIds` are the ids Sprout returns for the account's root level, which
 * costs one request to fetch — far cheaper than the crawl the import replaces.
 *
 * An empty account cannot be checked either way, so that is allowed through as
 * unverifiable rather than blocked: refusing would strand a legitimate import,
 * and an empty account has no folders to file anything into wrongly.
 */
export function assessImport(
  imported: ImportedIndex,
  actualRootIds: string[]
): ImportVerdict {
  const importedRootIds = imported.folders
    .filter((folder) => folder.parent_id === null)
    .map((folder) => folder.id)

  if (importedRootIds.length === 0 || actualRootIds.length === 0) {
    return { ok: true, reason: 'unverifiable' }
  }

  const actual = new Set(actualRootIds)
  const overlaps = importedRootIds.some((id) => actual.has(id))

  // Folder ids are account-scoped, so no overlap at the root means a different
  // account. Importing it would offer folders this account cannot upload into.
  return overlaps
    ? { ok: true, reason: 'matches-account' }
    : { ok: false, reason: 'different-account' }
}

/** Message for a verdict, phrased for someone who did not write this code. */
export function describeVerdict(verdict: ImportVerdict, folderCount: number): string {
  if (!verdict.ok) {
    return 'That index is from a different Sprout Video account — none of its top-level folders exist here. Ask your colleague to export from the same account, or index this one instead.'
  }
  if (verdict.reason === 'unverifiable') {
    return `Imported ${folderCount} folders. This account has no top-level folders to check against, so the index could not be verified.`
  }
  return `Imported ${folderCount} folders.`
}

/**
 * Combines an imported index with the local one.
 *
 * Deliberately **not** `mergeFolderIndex`. That treats a complete crawl as
 * grounds to replace wholesale, which is right for a crawl this machine just
 * ran -- it observed the account as it is now. An import is different evidence:
 * complete as of *someone else's machine*, at *some earlier time*. Replacing on
 * that would delete folders discovered locally since they exported, so an import
 * only ever adds.
 *
 * Deduplication is by folder **id**, which is what Sprout keys folders on. A
 * folder both people already have therefore appears once, not twice. Two folders
 * that merely share a name are genuinely distinct on Sprout and both survive.
 *
 * On an id collision the record from the **newer** source wins, so a stale
 * export cannot revert a rename that the other side already knows about.
 */
export function mergeImportedIndex(
  existing: FolderIndex | null,
  imported: ImportedIndex,
  apiKey: string,
  now: string
): FolderIndex {
  const importedIsNewer = isNewer(imported.indexedAt, existing?.indexedAt ?? null)

  const byId = new Map<string, SproutFolder>()
  // The loser goes in first so the winner overwrites it.
  const [first, second] = importedIsNewer
    ? [existing?.folders ?? [], imported.folders]
    : [imported.folders, existing?.folders ?? []]

  for (const folder of first) byId.set(folder.id, folder)
  for (const folder of second) byId.set(folder.id, folder)

  return {
    version: FOLDER_INDEX_VERSION,
    account: accountFingerprint(apiKey),
    indexedAt: now,
    // A complete import still leaves a complete picture -- the union is a
    // superset of it -- but it is reached by adding, never by deleting.
    partial: imported.partial,
    folders: [...byId.values()]
  }
}

/** True when `a` is a later timestamp than `b`; unknown dates lose. */
function isNewer(a: string | null, b: string | null): boolean {
  const left = a ? Date.parse(a) : Number.NaN
  const right = b ? Date.parse(b) : Number.NaN
  if (Number.isNaN(left)) return false
  if (Number.isNaN(right)) return true
  return left > right
}

/** Suggested filename for an export, dated so versions are distinguishable. */
export function exportFileName(isoDate: string): string {
  const day = isoDate.slice(0, 10)
  return `sprout-folder-index-${day}.json`
}
