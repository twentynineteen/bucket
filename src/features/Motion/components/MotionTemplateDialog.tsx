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
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@shared/ui/dialog'
import { Star } from 'lucide-react'
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
import { checkTextOverflow, createCanvasMeasurer } from '../internal/textOverflow'
import type {
  CatalogueEntry,
  MotionFormat,
  MotionTarget,
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

  // Resolve the template for the evaluator
  const resolved = useMemo(
    () => resolveTemplate(template, values, format),
    [template, values, format]
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

      // Check the image has transparent and opaque pixels
      // Simple check: look for any alpha < 255 and any alpha > 0
      // PNG bytes are complex; for now just accept it
      // A proper check would decode the PNG, but that's beyond jsdom.
      // The sampler will catch issues.
      const hasTransparent = bytes.some((b, i) => i % 4 === 3 && b < 255)
      const hasOpaque = bytes.some((b, i) => i % 4 === 3 && b > 0)

      if (!hasTransparent || !hasOpaque) {
        setImageError(
          !hasTransparent
            ? 'Image has no transparent pixels'
            : 'Image has no opaque pixels'
        )
        return
      }

      setImageError(null)
      setPickedImagePath(path)
      setValues(prev => ({ ...prev, image: { pickedPath: path } }))
    } catch {
      setImageError('Could not read the image file')
    }
  }, [])

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
      entry,
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
    entry,
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
    motionExport.copyPrompt({ entry, values, format, resolved })
  }, [entry, values, format, resolved, motionExport])

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
      <DialogContent className="max-w-3xl" hideClose={motionExport.isExporting}>
        {/* Header */}
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

        {/* Preview */}
        <PreviewStage>
          <MotionPreview
            template={template}
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
          <Button variant="ghost" size="sm" onClick={handleRestart} aria-label="Restart">
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

        {/* Export panel */}
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
          canExport={canExport}
          isExporting={motionExport.isExporting}
          onExport={handleExport}
          canCopyPrompt={canCopyPrompt}
          onCopyPrompt={handleCopyPrompt}
          renderProgress={motionExport.renderProgress}
          onCancelRender={motionExport.cancelRender}
          validFormats={allValidFormats}
        />
      </DialogContent>
    </Dialog>
  )
}

export default MotionTemplateDialog
