/**
 * MotionTemplateDialog - template modal with preview, param editor and export
 * (issue #337)
 *
 * Props frozen by #327: `{ template, open, onOpenChange }` with a `DialogTitle`.
 * The grid opens it; this module does not import the grid's files.
 */
import { useKavanaghAvailability } from '@features/Kavanagh'
import { useApiKeys } from '@shared/hooks'
import { Button } from '@shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle
} from '@shared/ui/dialog'
import { Clipboard, Loader2, Package, Star } from 'lucide-react'
import React, { useCallback, useMemo, useState } from 'react'
import { pathExists, pickFolder, pickPngImage, readBytes } from '../api'
import { useMotionExport } from '../hooks/useMotionExport'
import { useMotionFont } from '../hooks/useMotionFont'
import { useMotionPrefs } from '../hooks/useMotionPrefs'
import { useMotionTicker } from '../hooks/useMotionTicker'
import { applyImageParam } from '../internal/imageParam'
import { applyTargetSelection, setDefault, toggleFavourite } from '../internal/prefs'
import {
  deriveTargets,
  validFormats as getValidFormats,
  resolveTemplate,
  validateParams
} from '../internal/resolve'
import { checkAlpha } from '../internal/sampler'
import { checkTextOverflow, createCanvasMeasurer } from '../internal/textOverflow'
import type {
  CatalogueEntry,
  MotionFormat,
  MotionTarget,
  MotionTemplate,
  ParamValues,
  TextLayer
} from '../types'
import ExportPanel from './ExportPanel'
import MotionPreview from './MotionPreview'
import ParamEditor from './ParamEditor'
import PreviewStage from './PreviewStage'

export interface MotionTemplateDialogProps {
  template: CatalogueEntry
  open: boolean
  onOpenChange: (open: boolean) => void
}

// ---------------------------------------------------------------------------
// Image decoding and particle re-sampling
// ---------------------------------------------------------------------------

/**
 * Decode a PNG file's bytes into RGBA ImageData using a canvas element.
 * Returns null if decoding fails (e.g. invalid PNG).
 */
async function decodeImageToRgba(
  pngBytes: Uint8Array
): Promise<{ rgba: Uint8ClampedArray; width: number; height: number } | null> {
  const blob = new Blob([new Uint8Array(pngBytes)], { type: 'image/png' })
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Image decode failed'))
      img.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(img, 0, 0)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    return { rgba: imageData.data, width: canvas.width, height: canvas.height }
  } catch {
    return null
  } finally {
    URL.revokeObjectURL(url)
  }
}

// ---------------------------------------------------------------------------
// Default values from template params
// ---------------------------------------------------------------------------

function defaultValues(entry: CatalogueEntry): ParamValues {
  const values: ParamValues = {}
  for (const [id, def] of Object.entries(entry.template.params)) {
    switch (def.kind) {
      case 'text':
        values[id] = def.default
        break
      case 'colour':
        values[id] = def.default
        break
      case 'hold':
        values[id] = def.default
        break
      case 'numberList':
        values[id] = [...def.default]
        break
      case 'number':
        values[id] = def.default
        break
      // image: starts unset
    }
  }
  return values
}

// ---------------------------------------------------------------------------
// Alpha validation error message
// ---------------------------------------------------------------------------

function alphaErrorMessage(alpha: {
  hasOpaque: boolean
  hasTransparent: boolean
}): string | null {
  if (!alpha.hasTransparent)
    return 'Image has no transparent pixels - use a cut-out PNG with a transparent background'
  if (!alpha.hasOpaque) return 'Image has no opaque pixels'
  return null
}

// ---------------------------------------------------------------------------
// Re-sampling result check
// ---------------------------------------------------------------------------

/** True when at least one particle layer with an imageParam produced points. */
function hasResampledPoints(tmpl: MotionTemplate): boolean {
  function check(layers: MotionTemplate['layers']): boolean {
    return layers.some(l => {
      if (l.kind === 'particles') {
        return l.imageParam !== undefined && l.points.length > 0
      }
      if (l.kind === 'group') {
        return check(l.children)
      }
      return false
    })
  }
  return check(tmpl.layers)
}

// ---------------------------------------------------------------------------
// Reduced motion detection
// ---------------------------------------------------------------------------

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function')
    return false
  const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
  return mql?.matches ?? false
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const MotionTemplateDialog: React.FC<MotionTemplateDialogProps> = ({
  template: entry,
  open,
  onOpenChange
}) => {
  const { template } = entry

  // State
  const [values, setValues] = useState<ParamValues>(() => defaultValues(entry))
  const [playing, setPlaying] = useState(() => !prefersReducedMotion())
  const [imageError, setImageError] = useState<string | null>(null)
  const [folderWarning, setFolderWarning] = useState<string | null>(null)
  const [pickedImagePath, setPickedImagePath] = useState<string | undefined>()
  const [imageTemplate, setImageTemplate] = useState<MotionTemplate | null>(null)

  // Hooks
  const { prefs, updatePrefs } = useMotionPrefs()
  const fontState = useMotionFont()
  const kavanaghAvail = useKavanaghAvailability()
  const { data: apiKeys } = useApiKeys()
  const motionExport = useMotionExport()

  // Derived state
  const supportedTargets = useMemo(() => deriveTargets(template), [template])
  const isParticle = useMemo(
    () => supportedTargets.length === 2 && supportedTargets.includes('video'),
    [supportedTargets]
  )
  const allValidFormats = useMemo(() => getValidFormats(template), [template])

  // Format from prefs
  const [format, setFormat] = useState<MotionFormat>(prefs.defaultFormat)

  // Targets: restored from prefs or default to all supported
  const [targets, setTargets] = useState<MotionTarget[]>(() => {
    if (prefs.rememberedTargets) {
      return applyTargetSelection(prefs.rememberedTargets, supportedTargets, isParticle)
    }
    return [...supportedTargets]
  })

  // Project folder from prefs
  const [projectFolder, setProjectFolder] = useState<string | null>(
    prefs.lastProjectFolder
  )

  // When the user picks an image, applyImageParam returns a modified
  // template with re-sampled particle points preserving aspect ratio.
  const effectiveTemplate = imageTemplate ?? template

  // Effective entry for export (uses re-sampled template when available)
  const effectiveEntry = useMemo(
    () => ({ ...entry, template: effectiveTemplate }),
    [entry, effectiveTemplate]
  )

  // Text measurer for line wrapping. Re-created when the font becomes ready,
  // so every useMemo that resolves text re-runs with the canvas measurer.
  const fontReady = fontState.status === 'ready'
  const measurer = useMemo(
    () => (fontReady ? createCanvasMeasurer() : undefined),
    [fontReady]
  )

  // Resolve the template for the evaluator (and export)
  const resolved = useMemo(
    () => resolveTemplate(effectiveTemplate, values, format, measurer),
    [effectiveTemplate, values, format, measurer]
  )

  // Ticker drives the preview animation
  const ticker = useMotionTicker({
    duration: resolved.duration,
    inEnd: resolved.inEnd,
    playing
  })

  // Reset state when the template changes (a new card was opened)
  const [lastTemplateId, setLastTemplateId] = useState(template.id)
  const templateChanged = template.id !== lastTemplateId
  if (templateChanged) {
    setLastTemplateId(template.id)
    setValues(defaultValues(entry))
    setImageError(null)
    setPickedImagePath(undefined)
    setImageTemplate(null)
  }

  // The time to pass to the preview (null during the gap)
  const time = ticker.time

  // Text overflow check
  const textLayers = useMemo(() => {
    return resolved.layers.filter(
      (l): l is TextLayer & { width: number } =>
        l.kind === 'text' && (l as TextLayer).width != null
    )
  }, [resolved.layers])

  // For overflow and param validation, use the same measurer or a fallback.
  const overflowMeasurer = useMemo(() => measurer ?? createCanvasMeasurer(), [measurer])

  const overflowResults = useMemo(() => {
    if (textLayers.length === 0) return []
    return checkTextOverflow(textLayers, overflowMeasurer)
  }, [textLayers, overflowMeasurer])

  const hasOverflow = overflowResults.some(r => r.overflowing)

  // Param validation (uses the same measurer for line-count checks)
  const paramErrors = useMemo(
    () => validateParams(template, values, measurer),
    [template, values, measurer]
  )
  const hasParamErrors = paramErrors.length > 0

  // Font availability
  const fontLoading = fontState.status === 'loading'
  const fontInstalled = fontState.status === 'ready'
  // ffmpeg availability is checked directly via the typed field, not by
  // string-matching the reason text (which could be about pools, not ffmpeg).
  const ffmpegAvailable = kavanaghAvail.ffmpeg?.status === 'ready'

  // Can export: folder set, at least one target, params valid, font loaded
  const canExport =
    Boolean(projectFolder) && targets.length > 0 && !hasParamErrors && !fontLoading
  const canCopyPrompt = !hasParamErrors

  // Favourite and default state
  const isFavourite = prefs.favourites.includes(template.id)
  const isDefault = prefs.defaults[template.category] === template.id

  // Show the region notice when a custom image replaces built-in region data
  const showRegionNotice = Boolean(pickedImagePath) && isParticle

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handlePickFolder = useCallback(async () => {
    const folder = await pickFolder({
      defaultPath: projectFolder ?? undefined,
      title: 'Choose project folder'
    })
    if (!folder) return

    setProjectFolder(folder)
    void updatePrefs({ lastProjectFolder: folder })

    // Check if it looks like a Bucket project
    const isBucket =
      (await pathExists(`${folder}/breadcrumbs.json`)) ||
      (await pathExists(`${folder}/Graphics`))
    setFolderWarning(isBucket ? null : 'not-bucket')
  }, [projectFolder, updatePrefs])

  const handlePickImage = useCallback(async () => {
    const path = await pickPngImage()
    if (!path) return

    try {
      const bytes = await readBytes(path)

      // Decode the PNG to real RGBA pixel data via a canvas
      const decoded = await decodeImageToRgba(bytes)
      if (!decoded) {
        setImageError('Could not decode the image')
        return
      }

      // Check the real alpha channel for both opaque and transparent pixels
      const alpha = checkAlpha(decoded.rgba, decoded.width, decoded.height)
      const alphaErr = alphaErrorMessage(alpha)
      if (alphaErr) {
        setImageError(alphaErr)
        return
      }

      // applyImageParam is pure: it derives minDistance from a target point
      // count, preserves the image's aspect ratio inside the built-in
      // bounding box, caps the result, and keys the param value by each
      // layer's imageParam field.
      const result = applyImageParam(template, values, decoded, path)

      if (!hasResampledPoints(result.template)) {
        setImageError('No points could be sampled from the image')
        return
      }

      setImageError(null)
      setPickedImagePath(path)
      setImageTemplate(result.template)
      setValues(prev => ({ ...prev, ...result.values }))
    } catch {
      setImageError('Could not read the image file')
    }
  }, [template, values])

  const handleTargetsChange = useCallback(
    (newTargets: MotionTarget[]) => {
      setTargets(newTargets)
      void updatePrefs({ rememberedTargets: newTargets })
    },
    [updatePrefs]
  )

  const handleFavourite = useCallback(() => {
    void updatePrefs(toggleFavourite(prefs, template.id))
  }, [prefs, template.id, updatePrefs])

  const handleDefault = useCallback(() => {
    const next = setDefault(prefs, template.id, template.category, !isDefault)
    void updatePrefs(next)
  }, [prefs, template.id, template.category, isDefault, updatePrefs])

  const handleExport = useCallback(async () => {
    if (!projectFolder) return

    await motionExport.exportToProject({
      entry: effectiveEntry,
      values,
      format,
      resolved,
      targets,
      projectFolder,
      ffmpegDirectory: apiKeys?.ffmpegDirectory ?? null,
      fontBytes: fontState.bytes,
      pickedImagePath
    })
  }, [
    effectiveEntry,
    values,
    format,
    resolved,
    targets,
    projectFolder,
    apiKeys?.ffmpegDirectory,
    fontState.bytes,
    pickedImagePath,
    motionExport
  ])

  const handleCopyPrompt = useCallback(() => {
    motionExport.copyPrompt({ entry: effectiveEntry, values, format, resolved })
  }, [effectiveEntry, values, format, resolved, motionExport])

  const handlePlayPause = useCallback(() => {
    setPlaying(prev => !prev)
  }, [])

  const handleRestart = useCallback(() => {
    // Reset by toggling playing off and on
    setPlaying(false)
    requestAnimationFrame(() => setPlaying(true))
  }, [])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[85vh] max-w-3xl flex-col"
        hideClose={motionExport.isExporting}
      >
        {/* Header - stays pinned above the scroll */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <DialogTitle>{template.name}</DialogTitle>
            <DialogDescription>{template.description}</DialogDescription>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleFavourite}
              aria-label={`Favourite ${template.name}`}
              aria-pressed={isFavourite}
              className="h-8 w-8"
            >
              <Star
                className={`h-4 w-4 ${isFavourite ? 'fill-current text-yellow-500' : ''}`}
              />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDefault}
              aria-label="Set as category default"
              aria-pressed={isDefault}
              className="text-xs"
            >
              {isDefault ? 'Default' : 'Set as default'}
            </Button>
          </div>
        </div>

        {/* Scrollable body - everything between header and footer */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto" data-slot="dialog-body">
          {/* Preview in a block-level wrapper so it takes 16:9 space */}
          <PreviewStage containerRef={ticker.containerRef}>
            <MotionPreview
              template={effectiveTemplate}
              values={values}
              format={format}
              time={time}
              name={template.name}
              measurer={measurer}
            />
          </PreviewStage>

          {/* Play controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePlayPause}
              aria-label={playing ? 'Pause' : 'Play'}
            >
              {playing ? 'Pause' : 'Play'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRestart}
              aria-label="Restart"
            >
              Restart
            </Button>
          </div>

          {/* Overflow warning */}
          <p className="text-warning text-sm" role="status" hidden={!hasOverflow}>
            Text is wider than its box
          </p>

          {/* Font loading indicator */}
          <p className="text-muted-foreground text-sm" hidden={!fontLoading}>
            Loading font...
          </p>

          {/* Param editor */}
          <ParamEditor
            template={template}
            values={values}
            onChange={setValues}
            onPickImage={handlePickImage}
            imageError={imageError}
            paramErrors={paramErrors}
          />

          {/* Notice: custom image replaces built-in region data */}
          <p
            className="text-muted-foreground text-xs"
            role="note"
            hidden={!showRegionNotice}
          >
            Region tints and callouts from the built-in figure are not applied to a custom
            image.
          </p>

          {/* Export settings (format, folder, targets, progress) */}
          <ExportPanel
            template={template}
            format={format}
            onFormatChange={setFormat}
            projectFolder={projectFolder}
            onPickFolder={handlePickFolder}
            folderWarning={folderWarning}
            targets={targets}
            onTargetsChange={handleTargetsChange}
            supportedTargets={supportedTargets}
            isParticle={isParticle}
            ffmpegAvailable={ffmpegAvailable}
            fontInstalled={fontInstalled}
            fontName="Cabrito.otf"
            renderProgress={motionExport.renderProgress}
            onCancelRender={motionExport.cancelRender}
            validFormats={allValidFormats}
          />
        </div>

        {/* Pinned footer - always visible */}
        <DialogFooter className="gap-2 border-t pt-4 sm:justify-stretch">
          <Button
            onClick={handleExport}
            disabled={!canExport || motionExport.isExporting}
            className="flex-1"
          >
            {motionExport.isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Package className="mr-2 h-4 w-4" />
                Export to project
              </>
            )}
          </Button>
          <Button variant="outline" onClick={handleCopyPrompt} disabled={!canCopyPrompt}>
            <Clipboard className="mr-2 h-4 w-4" />
            Copy Claude prompt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default MotionTemplateDialog
