/**
 * Export bundle - atomic folder export (issue #337)
 *
 * Creates a temp folder, writes all export files into it, then renames it
 * to the final name. On any failure the temp folder is removed.
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
// Main export
// ---------------------------------------------------------------------------

/**
 * Export a bundle of files atomically into `<project>/Graphics/Motion/<name>`.
 *
 * 1. Create `Graphics/Motion/` recursively
 * 2. Write all files into `.tmp-<id>-<rand>/`
 * 3. Rename to `<id>-<slug>` (with collision suffix if needed)
 * 4. On any error, remove the temp folder
 */
export async function exportBundle(
  input: ExportBundleInput,
  api: ExportBundleApi
): Promise<ExportBundleResult> {
  const motionDir = await api.joinPath(input.projectFolder, 'Graphics', 'Motion')
  await api.makeDir(motionDir)

  const rand = Math.random().toString(36).slice(2, 8)
  const tmpName = `.tmp-${input.templateId}-${rand}`
  const tmpDir = await api.joinPath(motionDir, tmpName)
  await api.makeDir(tmpDir)

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
