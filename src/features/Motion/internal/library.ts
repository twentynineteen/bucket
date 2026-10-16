/**
 * Library loading and catalogue merging (issue #333)
 *
 * Reads the user's library folder (top-level *.json only), validates each file
 * through the schema, collects issues for anything that fails, and merges the
 * result with the built-in catalogue.
 */
import { compareVersions } from '@shared/utils'
import type { CatalogueEntry, CatalogueIssue, MotionTemplate } from '../types'
import { parseTemplate } from './schema'

// ---------------------------------------------------------------------------
// Types for dependency injection (tests pass mock I/O)
// ---------------------------------------------------------------------------

type ListFolderFn = (path: string) => Promise<{ name: string; isFile: boolean }[]>

type ReadTextFn = (path: string) => Promise<string>

interface LoadLibraryOptions {
  /** Map of template id to its image default value, for absolute-path checking. */
  imageDefaults?: Record<string, string>
}

// ---------------------------------------------------------------------------
// loadLibrary
// ---------------------------------------------------------------------------

interface LoadLibraryResult {
  templates: MotionTemplate[]
  issues: CatalogueIssue[]
}

/**
 * Load templates from a library folder.
 *
 * Only top-level *.json files are read. Subfolders, non-JSON files and files
 * that fail to parse are skipped, with each producing an issue.
 */
export async function loadLibrary(
  folder: string | null,
  listFolder: ListFolderFn,
  readText: ReadTextFn,
  options?: LoadLibraryOptions
): Promise<LoadLibraryResult> {
  if (!folder) return { templates: [], issues: [] }

  let entries: { name: string; isFile: boolean }[]
  try {
    entries = await listFolder(folder)
  } catch {
    return {
      templates: [],
      issues: [{ path: folder, message: `Library folder not found: ${folder}` }]
    }
  }

  // Filter to top-level .json files and sort by filename for deterministic order
  const jsonFiles = entries
    .filter(e => e.isFile && e.name.endsWith('.json'))
    .sort((a, b) => a.name.localeCompare(b.name))

  const templates: MotionTemplate[] = []
  const issues: CatalogueIssue[] = []
  const seenIds = new Map<string, string>() // id -> filename

  for (const file of jsonFiles) {
    const filePath = `${folder}/${file.name}`

    let text: string
    try {
      text = await readText(filePath)
    } catch (err) {
      issues.push({ path: filePath, message: String(err) })
      continue
    }

    let json: unknown
    try {
      json = JSON.parse(text)
    } catch {
      issues.push({ path: filePath, message: 'Invalid JSON' })
      continue
    }

    const result = parseTemplate(json)
    if (!result.success) {
      issues.push({ path: filePath, message: result.error })
      continue
    }

    const template = result.data

    // Check for absolute image paths (L2.7)
    const imageDefault = options?.imageDefaults?.[template.id]
    if (imageDefault && (imageDefault.startsWith('/') || imageDefault.startsWith('\\'))) {
      issues.push({
        path: filePath,
        message: 'Image references must be relative, not absolute paths'
      })
      continue
    }

    // Check for duplicate IDs (L2.5)
    const existingFile = seenIds.get(template.id)
    if (existingFile) {
      issues.push({
        path: filePath,
        message: `Duplicate template id "${template.id}" (already loaded from ${existingFile})`
      })
      continue
    }

    seenIds.set(template.id, file.name)
    templates.push(template)
  }

  return { templates, issues }
}

// ---------------------------------------------------------------------------
// mergeCatalogue
// ---------------------------------------------------------------------------

interface MergeResult {
  entries: CatalogueEntry[]
  issues: CatalogueIssue[]
}

/**
 * Merge built-in entries with library templates.
 *
 * A library template with the same id as a built-in replaces the built-in when
 * its version is strictly higher (semver). Otherwise the built-in is kept and
 * the library file is reported as an issue.
 */
export function mergeCatalogue(
  builtins: CatalogueEntry[],
  libraryItems: { template: MotionTemplate; path: string }[]
): MergeResult {
  const issues: CatalogueIssue[] = []
  const builtinMap = new Map<string, CatalogueEntry>()
  for (const entry of builtins) {
    builtinMap.set(entry.template.id, entry)
  }

  const entries: CatalogueEntry[] = [...builtins]

  for (const lib of libraryItems) {
    const existing = builtinMap.get(lib.template.id)
    if (existing) {
      const cmp = compareVersions(lib.template.version, existing.template.version)
      if (cmp > 0) {
        // Library version is higher - replace the built-in
        const idx = entries.findIndex(e => e.template.id === lib.template.id)
        if (idx >= 0) {
          entries[idx] = {
            template: lib.template,
            source: 'library',
            path: lib.path
          }
        }
      } else {
        // Built-in kept - report the library file as an issue
        issues.push({
          path: lib.path,
          message: `Library template "${lib.template.id}" has version ${lib.template.version} which does not exceed built-in version ${existing.template.version}`
        })
      }
    } else {
      // No built-in conflict - add from library
      entries.push({
        template: lib.template,
        source: 'library',
        path: lib.path
      })
    }
  }

  return { entries, issues }
}
