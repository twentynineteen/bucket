/**
 * useMotionExport - orchestrates the export flow (issue #337)
 *
 * Composes exporters, the export bundle, the video render pipeline, and the
 * clipboard prompt copy. Provides the state and actions the dialog needs.
 */
import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import {
  copyFileTo,
  copyToClipboard,
  joinPath,
  makeDir,
  pathExists,
  removeDirRecursive,
  renamePath,
  revealInFinder,
  writeBytes,
  writeText
} from '../api'
import { beginBundle, commitBundle, type ExportBundleApi } from '../internal/exportBundle'
import { generateJsx } from '../internal/exporters/ae/generateJsx'
import { generateSetting } from '../internal/exporters/fusion/generateSetting'
import { generatePrompt } from '../internal/exporters/prompt'
import { generateReadme } from '../internal/exporters/readme'
import { slugify } from '../internal/resolve'
import type {
  CatalogueEntry,
  ExportFile,
  ExportInput,
  MotionFormat,
  MotionTarget,
  ParamValues,
  ResolvedTemplate
} from '../types'
import { useRenderVideo } from './useRenderVideo'

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

// ---------------------------------------------------------------------------
// Api adapter for exportBundle
// ---------------------------------------------------------------------------

const bundleApi: ExportBundleApi = {
  joinPath,
  makeDir,
  writeText,
  writeBytes,
  renamePath,
  removeDirRecursive,
  pathExists,
  copyFileTo
}

// ---------------------------------------------------------------------------
// File generation
// ---------------------------------------------------------------------------

function generateFiles(
  input: ExportInput,
  targets: MotionTarget[]
): { files: ExportFile[]; notes: string[] } {
  const files: ExportFile[] = []
  const allNotes: string[] = []

  if (targets.includes('ae') || targets.includes('mogrt-via-ae')) {
    const mogrt = targets.includes('mogrt-via-ae')
    const aeResult = generateJsx({ ...input, mogrt })
    files.push(...aeResult.files)
    allNotes.push(...aeResult.notes)
  }

  if (targets.includes('resolve')) {
    const resResult = generateSetting(input)
    files.push(...resResult.files)
    allNotes.push(...resResult.notes)
  }

  if (targets.includes('prompt')) {
    const promptText = generatePrompt(input)
    files.push({
      name: `${input.template.id}-prompt.md`,
      kind: 'text',
      contents: promptText
    })
  }

  // README is always included
  const readmeText = generateReadme(input, allNotes)
  files.push({
    name: 'README.md',
    kind: 'text',
    contents: readmeText
  })

  return { files, notes: allNotes }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useMotionExport(): UseMotionExportResult {
  const [isExporting, setIsExporting] = useState(false)
  const renderVideo = useRenderVideo()

  const renderProgress = renderVideo.state === 'rendering' ? renderVideo.progress : null

  const cancelRender = useCallback(() => {
    renderVideo.cancel()
  }, [renderVideo])

  const exportToProject = useCallback(
    async (opts: ExportToProjectOptions) => {
      setIsExporting(true)

      try {
        const {
          entry,
          values,
          format,
          resolved,
          targets,
          projectFolder,
          ffmpegDirectory,
          fontBytes,
          pickedImagePath
        } = opts

        const exportInput: ExportInput = {
          template: entry.template,
          values,
          format,
          resolved,
          targets,
          mogrt: targets.includes('mogrt-via-ae')
        }

        // Generate text/script files
        const { files } = generateFiles(exportInput, targets)

        // Build the slug from the primary text param
        const primaryParam = entry.template.primaryTextParam
        const primaryValue = primaryParam ? values[primaryParam] : undefined
        const slug = typeof primaryValue === 'string' ? slugify(primaryValue) : ''

        const bundleInput = {
          projectFolder,
          templateId: entry.template.id,
          slug,
          files,
          values,
          format,
          targets,
          templateVersion: entry.template.version,
          pickedImagePath
        }

        // S1 fix: create the temp folder first so the video can be
        // rendered into it, then commit everything atomically.
        const { tmpDir } = await beginBundle(bundleInput, bundleApi)

        try {
          // Render video into the temp folder if requested
          if (targets.includes('video')) {
            const videoOutputPath = await joinPath(tmpDir, `${entry.template.id}.mov`)

            const videoResult = await renderVideo.render({
              resolved,
              format,
              outputPath: videoOutputPath,
              fonts: fontBytes ? [{ family: 'Cabrito Semi', bytes: fontBytes }] : [],
              ffmpegDirectory
            })

            if (!videoResult) {
              // Cancelled - clean up the temp folder
              toast.info('Export cancelled')
              try {
                await removeDirRecursive(tmpDir)
              } catch {
                // Ignore cleanup errors
              }
              return
            }
          }

          // Commit the bundle (write files, rename to final)
          const result = await commitBundle(bundleInput, bundleApi, tmpDir)

          toast.success('Exported to project', {
            description: result.finalFolder.split('/').pop(),
            action: {
              label: 'Reveal in Finder',
              onClick: () => void revealInFinder(result.finalFolder)
            }
          })
        } catch (innerErr) {
          // Clean up the temp folder on any error in the inner block
          try {
            await removeDirRecursive(tmpDir)
          } catch {
            // Ignore cleanup errors
          }
          throw innerErr
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Export failed')
      } finally {
        setIsExporting(false)
      }
    },
    [renderVideo]
  )

  const copyPrompt = useCallback((opts: CopyPromptOptions) => {
    const { entry, values, format, resolved } = opts

    const exportInput: ExportInput = {
      template: entry.template,
      values,
      format,
      resolved,
      targets: ['prompt'],
      mogrt: false
    }

    const promptText = generatePrompt(exportInput)

    // MUST call copyToClipboard synchronously (before any await) for WKWebView
    void copyToClipboard(promptText)

    toast.success('Prompt copied to clipboard')
  }, [])

  return {
    isExporting,
    renderProgress,
    exportToProject,
    copyPrompt,
    cancelRender
  }
}
