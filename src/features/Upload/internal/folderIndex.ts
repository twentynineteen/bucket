/**
 * Saved folder index (issue #155, search)
 *
 * Sprout cannot search folders server-side, so searching folders the user has
 * never opened means crawling the tree — expensive against a 200 request/minute
 * account-wide limit. The crawl therefore runs once and its result is saved, so
 * searching costs nothing thereafter.
 *
 * The index is a **cache**: rebuildable, safe to discard, and never the source
 * of truth for what exists on Sprout.
 */
import type { SproutFolder } from '@shared/types'

/** Bumped when the shape changes, so an older file is discarded not misread. */
export const FOLDER_INDEX_VERSION = 1

export interface FolderIndex {
  version: number
  /**
   * Identifies the account without storing its key. A raw key here would put a
   * credential in a cache file for no benefit — see issue #158 for the same
   * mistake in query keys.
   */
  account: string
  /** ISO timestamp, so the UI can say how stale the index is. */
  indexedAt: string
  /** True when a bound, a cancellation or an error stopped the crawl early. */
  partial: boolean
  folders: SproutFolder[]
}

/**
 * Short, non-reversible account discriminator (FNV-1a).
 *
 * Not cryptographic and does not need to be: the goal is that two different
 * keys produce different values and neither can be read back from the file.
 */
export function accountFingerprint(apiKey: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < apiKey.length; i++) {
    hash ^= apiKey.charCodeAt(i)
    // Multiply by the FNV prime with 32-bit wraparound.
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
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
 * Validates a loaded index for the current account.
 *
 * Returns null — meaning "not indexed" — for anything unusable: a different
 * account, an older version, or a malformed file. Silently accepting a
 * mismatched index would show one account's folder names while uploading to
 * another, which is worse than offering no search at all.
 */
export function parseFolderIndex(raw: unknown, apiKey: string): FolderIndex | null {
  if (!raw || typeof raw !== 'object') return null

  const { version, account, indexedAt, partial, folders } = raw as Record<string, unknown>

  if (version !== FOLDER_INDEX_VERSION) return null
  if (account !== accountFingerprint(apiKey)) return null
  if (typeof indexedAt !== 'string') return null
  if (!Array.isArray(folders) || !folders.every(isFolder)) return null

  return {
    version: FOLDER_INDEX_VERSION,
    account,
    indexedAt,
    partial: partial === true,
    folders
  }
}

/** Builds the persistable index for a crawl result. */
export function createFolderIndex(
  apiKey: string,
  folders: SproutFolder[],
  partial: boolean,
  now: string
): FolderIndex {
  return {
    version: FOLDER_INDEX_VERSION,
    account: accountFingerprint(apiKey),
    indexedAt: now,
    partial,
    folders
  }
}

/** Whole days since the index was built; null when the date is unreadable. */
export function indexAgeInDays(index: FolderIndex, now: number): number | null {
  const built = Date.parse(index.indexedAt)
  if (Number.isNaN(built)) return null
  return Math.max(0, Math.floor((now - built) / 86_400_000))
}
