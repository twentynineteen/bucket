/**
 * Export bundle - atomic folder export (issue #337)
 *
 * Creates a temp folder, writes all export files into it, then renames it
 * to the final name. On any failure the temp folder is removed.
 *
 * Split into begin/commit so the video render can target the temp folder
 * before any files are written. beginBundle returns motionDir alongside
 * tmpDir so commitBundle does not re-derive it.
 */
import type { ExportFile, MotionFormat, MotionTarget, ParamValues } from '../types'

export interface ExportBundleInput {
  projectFolder: string
  templateId: string
  slug: string
  files: ExportFile[]
  values: ParamValues
  format: MotionFormat
  targets: MotionTarget[]
  templateVersion: string
  pickedImagePath?: string
}

export interface ExportBundleResult {
  finalFolder: string
}

export interface ExportBundleApi {
  joinPath: (...parts: string[]) => Promise<string>
  makeDir: (path: string) => Promise<void>
  writeText: (path: string, text: string) => Promise<void>
  writeBytes: (path: string, bytes: Uint8Array) => Promise<void>
  renamePath: (from: string, to: string) => Promise<void>
  removeDirRecursive: (path: string) => Promise<void>
  pathExists: (path: string) => Promise<boolean>
  copyFileTo: (from: string, to: string) => Promise<void>
  /** List a folder's entries. Required for the stale .tmp-* sweep. */
  listFolder: (path: string) => Promise<{ name: string; isFile: boolean }[]>
  /** Get a path's modified time in epoch milliseconds.
   *  Required for the stale .tmp-* sweep. */
  modifiedTimeMs: (path: string) => Promise<number>
}

// ---------------------------------------------------------------------------
// params.json
// ---------------------------------------------------------------------------

function buildParamsJson(input: ExportBundleInput): string {
  // Scrub absolute paths from values - replace image pickedPath with relative
  const scrubbed: ParamValues = {}
  for (const [key, val] of Object.entries(input.values)) {
    if (val && typeof val === 'object' && !Array.isArray(val) && 'pickedPath' in val) {
      scrubbed[key] = { sourceName: 'source.png' }
    } else {
      scrubbed[key] = val
    }
  }

  return JSON.stringify(
    {
      templateId: input.templateId,
      templateVersion: input.templateVersion,
      values: scrubbed,
      format: input.format,
      exportedAt: new Date().toISOString(),
      schemaVersion: 1
    },
    null,
    2
  )
}

// ---------------------------------------------------------------------------
// Collision-safe folder name
// ---------------------------------------------------------------------------

async function findAvailableName(
  baseDir: string,
  baseName: string,
  api: ExportBundleApi
): Promise<string> {
  const first = await api.joinPath(baseDir, baseName)
  if (!(await api.pathExists(first))) return first

  for (let i = 2; i < 10000; i++) {
    const candidate = await api.joinPath(baseDir, `${baseName}-${i}`)
    if (!(await api.pathExists(candidate))) return candidate
  }

  throw new Error(`Could not find an available folder name for ${baseName}`)
}

// ---------------------------------------------------------------------------
// Stale temp-folder sweep
// ---------------------------------------------------------------------------

const ONE_DAY_MS = 24 * 60 * 60 * 1000

/**
 * Remove `.tmp-*` directories in motionDir that are older than 24 hours.
 * Best-effort: errors are swallowed so the sweep never blocks an export.
 */
async function sweepStaleTmpFolders(
  motionDir: string,
  api: ExportBundleApi
): Promise<void> {
  try {
    const entries = await api.listFolder(motionDir)
    const now = Date.now()

    for (const entry of entries) {
      if (entry.isFile) continue
      if (!entry.name.startsWith('.tmp-')) continue

      try {
        const folderPath = await api.joinPath(motionDir, entry.name)
        const mtime = await api.modifiedTimeMs(folderPath)

        if (now - mtime > ONE_DAY_MS) {
          await api.removeDirRecursive(folderPath)
        }
      } catch {
        // Per-entry best-effort: one failing stat or remove must not
        // prevent cleanup of the remaining stale folders.
      }
    }
  } catch {
    // Best-effort sweep - do not block the export on a sweep failure
  }
}

// ---------------------------------------------------------------------------
// Phase 1: begin - create the temp folder
// ---------------------------------------------------------------------------

/**
 * Create the bundle's temp folder inside `<project>/Graphics/Motion/`.
 *
 * Returns the temp dir path and the motion dir path so the caller can render
 * the video into the temp folder before committing, and commitBundle does not
 * need to re-derive motionDir. The caller is responsible for cleaning up the
 * temp dir on error (commitBundle does this internally).
 *
 * Before creating the new temp folder, sweeps any `.tmp-*` folders older
 * than 24 hours that a previous crashed render may have left behind.
 */
export async function beginBundle(
  input: ExportBundleInput,
  api: ExportBundleApi
): Promise<{ tmpDir: string; motionDir: string }> {
  const motionDir = await api.joinPath(input.projectFolder, 'Graphics', 'Motion')
  await api.makeDir(motionDir)

  // Sweep stale temp folders from crashed renders
  await sweepStaleTmpFolders(motionDir, api)

  const rand = Math.random().toString(36).slice(2, 8)
  const tmpName = `.tmp-${input.templateId}-${rand}`
  const tmpDir = await api.joinPath(motionDir, tmpName)
  await api.makeDir(tmpDir)

  return { tmpDir, motionDir }
}

// ---------------------------------------------------------------------------
// Phase 2: commit - write files and rename to final
// ---------------------------------------------------------------------------

/**
 * Write all export files into the given temp folder and rename it to the
 * final collision-safe name. On any error the temp folder is removed.
 */
export async function commitBundle(
  input: ExportBundleInput,
  api: ExportBundleApi,
  tmpDir: string,
  motionDir: string
): Promise<ExportBundleResult> {
  try {
    // Write all export files
    for (const file of input.files) {
      const filePath = await api.joinPath(tmpDir, file.name)
      if (file.kind === 'text') {
        await api.writeText(filePath, file.contents)
      } else {
        await api.writeBytes(filePath, file.bytes)
      }
    }

    // Write params.json
    const paramsPath = await api.joinPath(tmpDir, 'params.json')
    await api.writeText(paramsPath, buildParamsJson(input))

    // Copy picked image as source.png
    if (input.pickedImagePath) {
      const sourcePath = await api.joinPath(tmpDir, 'source.png')
      await api.copyFileTo(input.pickedImagePath, sourcePath)
    }

    // Find collision-safe folder name
    const folderBaseName = input.slug
      ? `${input.templateId}-${input.slug}`
      : input.templateId
    const finalPath = await findAvailableName(motionDir, folderBaseName, api)

    // Atomic rename
    await api.renamePath(tmpDir, finalPath)

    return { finalFolder: finalPath }
  } catch (err) {
    // Clean up temp folder on any error
    try {
      await api.removeDirRecursive(tmpDir)
    } catch {
      // Ignore cleanup errors
    }
    throw err
  }
}
