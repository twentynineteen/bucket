/**
 * Saved folder index (issue #155, search)
 *
 * The index is what makes search free after one crawl, so the tests are about
 * refusing to trust a file that does not belong to this account or this version
 * — showing one account's folder names while uploading to another would be
 * worse than offering no search at all.
 */
import { describe, expect, it } from 'vitest'

import type { SproutFolder } from '@shared/types'

import {
  FOLDER_INDEX_VERSION,
  accountFingerprint,
  createFolderIndex,
  indexAgeInDays,
  mergeFolderIndex,
  parseFolderIndex
} from './folderIndex'

const FOLDERS: SproutFolder[] = [
  { id: 'p1', name: 'Postgraduate', parent_id: null },
  { id: 'm1', name: 'IB9X7', parent_id: 'p1' }
]

const KEY = 'sprout-key-abc'
const OTHER_KEY = 'sprout-key-xyz'
const NOW = '2026-08-10T09:00:00.000Z'

describe('account fingerprint', () => {
  it('never contains the key itself', () => {
    // The whole point: identify the account without caching a credential.
    const fingerprint = accountFingerprint(KEY)
    expect(fingerprint).not.toContain(KEY)
    expect(KEY).not.toContain(fingerprint)
  })

  it('is stable for the same key', () => {
    expect(accountFingerprint(KEY)).toBe(accountFingerprint(KEY))
  })

  it('differs between keys', () => {
    expect(accountFingerprint(KEY)).not.toBe(accountFingerprint(OTHER_KEY))
  })
})

describe('round trip', () => {
  it('parses an index it just created', () => {
    const index = createFolderIndex(KEY, FOLDERS, false, NOW)
    const parsed = parseFolderIndex(JSON.parse(JSON.stringify(index)), KEY)

    expect(parsed).not.toBeNull()
    expect(parsed!.folders).toEqual(FOLDERS)
    expect(parsed!.partial).toBe(false)
    expect(parsed!.indexedAt).toBe(NOW)
  })

  it('carries the partial flag through, so the UI can be honest', () => {
    const index = createFolderIndex(KEY, FOLDERS, true, NOW)
    expect(parseFolderIndex(index, KEY)!.partial).toBe(true)
  })
})

describe('refusing an index that does not apply', () => {
  it('rejects an index built for a different account', () => {
    const index = createFolderIndex(OTHER_KEY, FOLDERS, false, NOW)
    expect(parseFolderIndex(index, KEY)).toBeNull()
  })

  it('rejects an older version rather than misreading it', () => {
    const index = { ...createFolderIndex(KEY, FOLDERS, false, NOW), version: 0 }
    expect(parseFolderIndex(index, KEY)).toBeNull()
  })

  it('rejects missing, non-object and malformed payloads', () => {
    expect(parseFolderIndex(null, KEY)).toBeNull()
    expect(parseFolderIndex('nope', KEY)).toBeNull()
    expect(parseFolderIndex({}, KEY)).toBeNull()
    expect(
      parseFolderIndex(
        { ...createFolderIndex(KEY, FOLDERS, false, NOW), folders: 'no' },
        KEY
      )
    ).toBeNull()
  })

  it('rejects an index containing a malformed folder', () => {
    const index = createFolderIndex(KEY, FOLDERS, false, NOW)
    const corrupt = { ...index, folders: [...index.folders, { id: 1, name: null }] }
    expect(parseFolderIndex(corrupt, KEY)).toBeNull()
  })

  it('rejects an unreadable timestamp', () => {
    const index = { ...createFolderIndex(KEY, FOLDERS, false, NOW), indexedAt: 42 }
    expect(parseFolderIndex(index, KEY)).toBeNull()
  })

  it('declares its version so a future shape change is a clean discard', () => {
    expect(createFolderIndex(KEY, FOLDERS, false, NOW).version).toBe(FOLDER_INDEX_VERSION)
  })
})

describe('staleness', () => {
  it('reports whole days since the index was built', () => {
    const index = createFolderIndex(KEY, FOLDERS, false, NOW)
    const threeDaysLater = Date.parse(NOW) + 3 * 86_400_000

    expect(indexAgeInDays(index, threeDaysLater)).toBe(3)
  })

  it('reports zero for an index built moments ago', () => {
    const index = createFolderIndex(KEY, FOLDERS, false, NOW)
    expect(indexAgeInDays(index, Date.parse(NOW) + 5_000)).toBe(0)
  })

  it('never reports a negative age when the clock disagrees', () => {
    const index = createFolderIndex(KEY, FOLDERS, false, NOW)
    expect(indexAgeInDays(index, Date.parse(NOW) - 86_400_000)).toBe(0)
  })

  it('returns null for an unparseable timestamp rather than NaN', () => {
    expect(
      indexAgeInDays(
        { ...createFolderIndex(KEY, FOLDERS, false, NOW), indexedAt: 'x' },
        Date.now()
      )
    ).toBeNull()
  })
})

describe('merging a crawl into an existing index', () => {
  const EXISTING: SproutFolder[] = [
    { id: 'p1', name: 'Postgraduate', parent_id: null },
    { id: 'm1', name: 'IB9X7', parent_id: 'p1' },
    { id: 'm2', name: 'IB9Y2', parent_id: 'p1' }
  ]

  it('never loses folders when an interrupted crawl found fewer', () => {
    // The bug this exists to prevent: a 1200-folder account takes minutes to
    // crawl, so interruption is normal. Writing only the partial result wiped
    // folders the user could previously find.
    const existing = createFolderIndex(KEY, EXISTING, false, NOW)
    const partial = [{ id: 'p1', name: 'Postgraduate', parent_id: null }]

    const merged = mergeFolderIndex(existing, partial, false, KEY, NOW)

    expect(merged.folders.map((f) => f.id).sort()).toEqual(['m1', 'm2', 'p1'])
  })

  it('marks a merged index partial so the UI does not imply full coverage', () => {
    const existing = createFolderIndex(KEY, EXISTING, false, NOW)
    expect(mergeFolderIndex(existing, [], false, KEY, NOW).partial).toBe(true)
  })

  it('adds newly discovered folders to what was already known', () => {
    const existing = createFolderIndex(KEY, EXISTING, false, NOW)
    const found = [{ id: 'y1', name: '2026', parent_id: 'm1' }]

    const merged = mergeFolderIndex(existing, found, false, KEY, NOW)

    expect(merged.folders).toHaveLength(4)
    expect(merged.folders.map((f) => f.id)).toContain('y1')
  })

  it('lets the fresher crawl win on a renamed folder', () => {
    const existing = createFolderIndex(KEY, EXISTING, false, NOW)
    const renamed = [{ id: 'm1', name: 'IB9X7 (retired)', parent_id: 'p1' }]

    const merged = mergeFolderIndex(existing, renamed, false, KEY, NOW)

    expect(merged.folders.find((f) => f.id === 'm1')!.name).toBe('IB9X7 (retired)')
  })

  it('replaces wholesale on a complete crawl, so deleted folders drop out', () => {
    // Only a full pass can know a folder is gone; a partial one must not assume.
    const existing = createFolderIndex(KEY, EXISTING, false, NOW)
    const complete = [{ id: 'p1', name: 'Postgraduate', parent_id: null }]

    const merged = mergeFolderIndex(existing, complete, true, KEY, NOW)

    expect(merged.folders).toEqual(complete)
    expect(merged.partial).toBe(false)
  })

  it('works with no existing index', () => {
    const merged = mergeFolderIndex(null, EXISTING, false, KEY, NOW)
    expect(merged.folders).toHaveLength(3)
    expect(merged.partial).toBe(true)
  })
})
