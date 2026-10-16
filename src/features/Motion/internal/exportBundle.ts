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

/**
 * Export a bundle of files atomically into `<project>/Graphics/Motion/<name>`.
 *
 * 1. Create `Graphics/Motion/` recursively
 * 2. Write all files into `.tmp-<id>-<rand>/`
 * 3. Rename to `<id>-<slug>` (with collision suffix if needed)
 * 4. On any error, remove the temp folder
 */
export async function exportBundle(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  input: ExportBundleInput,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  api: ExportBundleApi
): Promise<ExportBundleResult> {
  throw new Error('not implemented')
}
