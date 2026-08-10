/**
 * Sharing a folder index between team members (issue #155, search)
 *
 * The interesting cases are the two ways this could go wrong: rejecting a good
 * index because a colleague's API key differs, or accepting another account's
 * index whose folder ids mean nothing here.
 */
import { describe, expect, it } from 'vitest'

import type { SproutFolder } from '@shared/types'

import { accountFingerprint, createFolderIndex } from './folderIndex'
import {
  assessImport,
  describeVerdict,
  exportFileName,
  parseImportedIndex
} from './folderIndexTransfer'

const FOLDERS: SproutFolder[] = [
  { id: 'p1', name: 'Postgraduate', parent_id: null },
  { id: 'p2', name: 'Undergraduate', parent_id: null },
  { id: 'm1', name: 'IB9X7', parent_id: 'p1' }
]

const NOW = '2026-08-10T09:30:00.000Z'

describe('reading an exported file', () => {
  it('accepts an index exported by a colleague with a different API key', () => {
    // The whole point: fingerprints differ per key, and rejecting on that would
    // strand a legitimate share between two people on the same account.
    const theirs = createFolderIndex('their-different-key', FOLDERS, false, NOW)

    const parsed = parseImportedIndex(JSON.parse(JSON.stringify(theirs)))

    expect(parsed).not.toBeNull()
    expect(parsed!.folders).toEqual(FOLDERS)
    expect(parsed!.account).toBe(accountFingerprint('their-different-key'))
  })

  it('carries the partial flag so an imported partial index is not called complete', () => {
    const theirs = createFolderIndex('k', FOLDERS, true, NOW)
    expect(parseImportedIndex(theirs)!.partial).toBe(true)
  })

  it('rejects a file from an incompatible version rather than misreading it', () => {
    const theirs = { ...createFolderIndex('k', FOLDERS, false, NOW), version: 99 }
    expect(parseImportedIndex(theirs)).toBeNull()
  })

  it('rejects an empty index, which would silently import nothing', () => {
    expect(parseImportedIndex(createFolderIndex('k', [], false, NOW))).toBeNull()
  })

  it('rejects unrelated or malformed JSON', () => {
    expect(parseImportedIndex(null)).toBeNull()
    expect(parseImportedIndex('a string')).toBeNull()
    expect(parseImportedIndex({ hello: 'world' })).toBeNull()
    expect(
      parseImportedIndex({
        ...createFolderIndex('k', FOLDERS, false, NOW),
        folders: [{ id: 1, name: null, parent_id: null }]
      })
    ).toBeNull()
  })
})

describe('deciding whether an index belongs to this account', () => {
  const imported = parseImportedIndex(createFolderIndex('k', FOLDERS, false, NOW))!

  it('accepts when the root folder ids overlap', () => {
    // Folder ids are account-scoped, so a shared root id means a shared account.
    expect(assessImport(imported, ['p1', 'p2'])).toEqual({
      ok: true,
      reason: 'matches-account'
    })
  })

  it('accepts on a partial overlap, since roots may have been added since', () => {
    expect(assessImport(imported, ['p1', 'brand-new'])).toMatchObject({ ok: true })
  })

  it('refuses when no root id is recognised', () => {
    // Importing this would offer folders that do not exist here, so uploads
    // would be filed against ids Sprout rejects.
    expect(assessImport(imported, ['someone-elses-root'])).toEqual({
      ok: false,
      reason: 'different-account'
    })
  })

  it('allows an unverifiable import when this account has no root folders', () => {
    // Nothing to compare against, and an empty account has no folders to file
    // anything into wrongly — blocking would strand a legitimate import.
    expect(assessImport(imported, [])).toEqual({ ok: true, reason: 'unverifiable' })
  })

  it('allows an unverifiable import when the file has no root folders', () => {
    const deepOnly = parseImportedIndex(
      createFolderIndex('k', [{ id: 'm1', name: 'IB9X7', parent_id: 'p1' }], true, NOW)
    )!

    expect(assessImport(deepOnly, ['p1'])).toEqual({ ok: true, reason: 'unverifiable' })
  })
})

describe('explaining the outcome', () => {
  it('names the cause when refusing, and suggests what to do', () => {
    const message = describeVerdict({ ok: false, reason: 'different-account' }, 0)

    expect(message).toMatch(/different Sprout Video account/i)
    expect(message).toMatch(/export from the same account|index this one/i)
  })

  it('says how many folders arrived on success', () => {
    expect(describeVerdict({ ok: true, reason: 'matches-account' }, 1200)).toMatch(/1200/)
  })

  it('admits when an import could not be verified', () => {
    expect(describeVerdict({ ok: true, reason: 'unverifiable' }, 5)).toMatch(
      /could not be verified/i
    )
  })
})

describe('export filename', () => {
  it('is dated so successive exports are distinguishable', () => {
    expect(exportFileName(NOW)).toBe('sprout-folder-index-2026-08-10.json')
  })
})
