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
import { applyTargetSelection, setDefault, toggleFavourite } from '../internal/prefs'
import {
  deriveTargets,
  validFormats as getValidFormats,
  resolveTemplate,
  validateParams
} from '../internal/resolve'
import { checkAlpha, samplePoints } from '../internal/sampler'
import { checkTextOverflow, createCanvasMeasurer } from '../internal/textOverflow'
import type {
  CatalogueEntry,
  MotionFormat,
  MotionTarget,
  MotionTemplate,
  ParamValues,
  ParticlesLayer,
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
// Image decoding and particle re-sampling (M2.6)
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

/**
 * Compute the bounding box of a set of points (used as the re-sampling
 * target box, matching the built-in points' extent).
 */
function pointsBoundingBox(points: { x: number; y: number }[]): {
  x: number
  y: number
  w: number
  h: number
} {
  if (points.length === 0) return { x: 0, y: 0, w: 3840, h: 2160 }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

/**
 * Return a shallow copy of the template with the specified particle layer's
 * points replaced. Does not mutate the original.
 */
function replaceParticlePoints(
  template: MotionTemplate,
  newPoints: { x: number; y: number; region?: string }[]
): MotionTemplate {
  return {
    ...template,
    layers: template.layers.map(layer => {
      if (layer.kind === 'particles' && (layer as ParticlesLayer).imageParam) {
        return { ...layer, points: newPoints }
      }
      return layer
    })
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
  const [resampledPoints, setResampledPoints] = useState<
    { x: number; y: number; region?: string }[] | null
  >(null)

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

  // When the user picks an image and re-sampled points are available,
  // create a copy of the template with replaced particle points. This
  // feeds the new figure into preview, video and export without changing
  // resolve.ts (which another agent owns).
  const effectiveTemplate = useMemo(
    () => (resampledPoints ? replaceParticlePoints(template, resampledPoints) : template),
    [template, resampledPoints]
  )

  // Effective entry for export (uses re-sampled points when available)
  const effectiveEntry = useMemo(
    () => (resampledPoints ? { ...entry, template: effectiveTemplate } : entry),
    [entry, effectiveTemplate, resampledPoints]
  )

  // Resolve the template for the evaluator
  const resolved = useMemo(
    () => resolveTemplate(effectiveTemplate, values, format),
    [effectiveTemplate, values, format]
  )

  // Ticker drives the preview animation
  const ticker = useMotionTicker({
    duration: resolved.duration,
    inEnd: resolved.inEnd,
    playing
  })

  // Track the template id so we can reset state when it changes
  const [lastTemplateId, setLastTemplateId] = useState(template.id)
  if (template.id !== lastTemplateId) {
    setLastTemplateId(template.id)
    setValues(defaultValues(entry))
    setImageError(null)
    setPickedImagePath(undefined)
    setResampledPoints(null)
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

  // Measurer uses canvas.measureText with the loaded template font when
  // available, falling back to a coarse approximation in jsdom. Created
  // once and reused for the lifetime of the dialog.
  const measurer = useMemo(() => createCanvasMeasurer(), [])

  const overflowResults = useMemo(() => {
    if (textLayers.length === 0) return []
    return checkTextOverflow(textLayers, measurer)
  }, [textLayers, measurer])

  const hasOverflow = overflowResults.some(r => r.overflowing)

  // Param validation
  const paramErrors = useMemo(() => validateParams(template, values), [template, values])
  const hasParamErrors = paramErrors.length > 0

  // Font availability
  const fontInstalled = fontState.status === 'ready'
  // ffmpeg availability is checked directly via the typed field, not by
  // string-matching the reason text (which could be about pools, not ffmpeg).
  const ffmpegAvailable = kavanaghAvail.ffmpeg?.status === 'ready'

  // Can export: folder set, at least one target, params valid
  const canExport = projectFolder !== null && targets.length > 0 && !hasParamErrors

  // Can copy prompt: all params valid (no folder or target needed)
  const canCopyPrompt = !hasParamErrors

  // Favourite and default state
  const isFavourite = prefs.favourites.includes(template.id)
  const isDefault = prefs.defaults[template.category] === template.id

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
    const hasBreadcrumbs = await pathExists(`${folder}/breadcrumbs.json`)
    const hasGraphics = await pathExists(`${folder}/Graphics`)
    setFolderWarning(!hasBreadcrumbs && !hasGraphics ? 'not-bucket' : null)
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
      if (!alpha.hasTransparent || !alpha.hasOpaque) {
        setImageError(
          !alpha.hasTransparent
            ? 'Image has no transparent pixels - use a cut-out PNG with a transparent background'
            : 'Image has no opaque pixels'
        )
        return
      }

      // Find the particle layer with an imageParam to get its seed and
      // built-in points (for the target bounding box)
      const particleLayer = template.layers.find(
        (l): l is ParticlesLayer =>
          l.kind === 'particles' && !!(l as ParticlesLayer).imageParam
      )
      if (!particleLayer) {
        setImageError('No particle layer configured for image input')
        return
      }

      // Re-sample using the layer's seed and the built-in points' bounding box
      const targetBox = pointsBoundingBox(particleLayer.points)
      const newPoints = samplePoints({
        rgba: decoded.rgba,
        width: decoded.width,
        height: decoded.height,
        minDistance: 6,
        seed: particleLayer.seed,
        targetBox
      })

      if (newPoints.length === 0) {
        setImageError('No points could be sampled from the image')
        return
      }

      setImageError(null)
      setPickedImagePath(path)
      setResampledPoints(newPoints)
      setValues(prev => ({ ...prev, image: { pickedPath: path } }))
    } catch {
      setImageError('Could not read the image file')
    }
  }, [template])

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
          {hasOverflow && (
            <p className="text-warning text-sm" role="status">
              Text is wider than its box
            </p>
          )}

          {/* Param editor */}
          <ParamEditor
            template={template}
            values={values}
            onChange={setValues}
            onPickImage={handlePickImage}
            imageError={imageError}
          />

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
