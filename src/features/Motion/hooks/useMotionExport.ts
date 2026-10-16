/**
 * useMotionExport - orchestrates the export flow (issue #337)
 *
 * Composes exporters, the export bundle, the video render pipeline, and the
 * clipboard prompt copy. Provides the state and actions the dialog needs.
 */
import type {
  CatalogueEntry,
  MotionFormat,
  MotionTarget,
  ParamValues,
  ResolvedTemplate
} from '../types'

export interface UseMotionExportResult {
  isExporting: boolean
  renderProgress: number | null
  exportToProject: (opts: ExportToProjectOptions) => Promise<void>
  copyPrompt: (opts: CopyPromptOptions) => void
  cancelRender: () => void
}

export interface ExportToProjectOptions {
  entry: CatalogueEntry
  values: ParamValues
  format: MotionFormat
  resolved: ResolvedTemplate
  targets: MotionTarget[]
  projectFolder: string
  ffmpegDirectory: string | null
  fontBytes?: Uint8Array
  pickedImagePath?: string
}

export interface CopyPromptOptions {
  entry: CatalogueEntry
  values: ParamValues
  format: MotionFormat
  resolved: ResolvedTemplate
}

export function useMotionExport(): UseMotionExportResult {
  throw new Error('not implemented')
}
