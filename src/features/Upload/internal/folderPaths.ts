/**
 * Folder path composition (issue #155)
 *
 * Shared by the live cache filter and the saved folder index, so a folder reads
 * the same either way -- `2026 Projects / MSc Programmes / Module X`.
 */
import type { SproutFolder } from '@shared/types'

import type { SelectedSproutFolder } from '../types'

/**
 * Builds breadcrumb paths for every folder in `folders`.
 *
 * A folder whose ancestors are not all present still gets a path -- just a
 * shorter one, starting from the highest ancestor available. That matters for
 * the live cache, where the user may have opened a deep level without its
 * parents being present.
 */
export function withPaths(
  folders: Iterable<SproutFolder> | null | undefined
): SelectedSproutFolder[] {
  // Guarded because the input comes from a cache or a parsed file, which may
  // hold something unexpected. Returning nothing beats throwing inside render.
  if (
    !folders ||
    typeof (folders as Iterable<SproutFolder>)[Symbol.iterator] !== 'function'
  ) {
    return []
  }

  const byId = new Map<string, SproutFolder>()
  for (const folder of folders) byId.set(folder.id, folder)

  const pathOf = (folder: SproutFolder): string => {
    const segments: string[] = [folder.name]
    let cursor = folder.parent_id
    // A malformed parent chain must not hang the UI, so track what we've seen.
    const seen = new Set<string>([folder.id])

    while (cursor && !seen.has(cursor)) {
      seen.add(cursor)
      const parent = byId.get(cursor)
      if (!parent) break
      segments.unshift(parent.name)
      cursor = parent.parent_id
    }

    return segments.join(' / ')
  }

  return [...byId.values()]
    .map((folder) => ({ id: folder.id, name: folder.name, path: pathOf(folder) }))
    .sort((a, b) => a.path.localeCompare(b.path))
}

/** Case-insensitive substring match over the breadcrumb path. */
export function matchFolders(
  folders: SelectedSproutFolder[],
  query: string
): SelectedSproutFolder[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return []
  return folders.filter((folder) => folder.path.toLowerCase().includes(needle))
}
