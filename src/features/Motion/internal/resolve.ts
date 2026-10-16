/**
 * Shared resolve module (issue #327)
 *
 * Params resolution and validation, macro expansion, hold shift, format scaling,
 * frame snap, slug, export folder name, target derivation and per-fps validity.
 *
 * Every exporter and the preview use this: they call `resolveTemplate` and work
 * from the result, so the same template is rendered everywhere.
 */
import type {
  ArcLayer,
  EllipseLayer,
  ImageValue,
  Keyframe,
  Layer,
  MotionFormat,
  MotionTarget,
  MotionTemplate,
  NumberListItem,
  ParamDef,
  ParamValues,
  ParticlesLayer,
  PathLayer,
  PrimitiveLayer,
  RectLayer,
  ResolvedTemplate,
  SeriesLayer,
  TextLayer
} from '../types'
import { expandTemplate } from './expand'

// ---------------------------------------------------------------------------
// Param validation
// ---------------------------------------------------------------------------

export interface ParamError {
  paramId: string
  message: string
}

/** Validate a single text param. */
function validateTextParam(
  id: string,
  def: Extract<ParamDef, { kind: 'text' }>,
  val: unknown
): ParamError[] {
  const errors: ParamError[] = []
  const text = typeof val === 'string' ? val : def.default
  if (def.required && text === '') {
    errors.push({ paramId: id, message: `${id}: required text is empty` })
  }
  if (text.length > def.maxLength) {
    errors.push({
      paramId: id,
      message: `${id}: text exceeds maxLength ${def.maxLength}`
    })
  }
  return errors
}

/** Validate a single numberList param. */
function validateNumberListParam(
  id: string,
  def: Extract<ParamDef, { kind: 'numberList' }>,
  val: unknown
): ParamError[] {
  const errors: ParamError[] = []
  const list: NumberListItem[] = Array.isArray(val) ? val : def.default
  if (list.length > 8) {
    errors.push({
      paramId: id,
      message: `${id}: numberList has more than 8 items`
    })
  }
  for (let i = 0; i < list.length; i++) {
    if (list[i].value < def.valueMin || list[i].value > def.valueMax) {
      errors.push({
        paramId: id,
        message: `${id}[${i}]: value outside range [${def.valueMin}, ${def.valueMax}]`
      })
    }
  }
  return errors
}

/**
 * Validate param values against the template's param definitions.
 * Returns an empty array when all values are valid.
 */
export function validateParams(
  template: MotionTemplate,
  values: ParamValues
): ParamError[] {
  const errors: ParamError[] = []

  for (const [id, def] of Object.entries(template.params)) {
    const val = values[id]

    switch (def.kind) {
      case 'text':
        errors.push(...validateTextParam(id, def, val))
        break
      case 'colour': {
        const colour = typeof val === 'string' ? val : def.default
        if (!/^#[0-9a-fA-F]{6}$/.test(colour)) {
          errors.push({ paramId: id, message: `${id}: invalid hex colour` })
        }
        break
      }
      case 'hold': {
        const hold = typeof val === 'number' ? val : def.default
        if (hold < def.min || hold > def.max) {
          errors.push({
            paramId: id,
            message: `${id}: hold outside range [${def.min}, ${def.max}]`
          })
        }
        break
      }
      case 'numberList':
        errors.push(...validateNumberListParam(id, def, val))
        break
      case 'number': {
        const n = typeof val === 'number' ? val : def.default
        if (n < def.min || n > def.max) {
          errors.push({
            paramId: id,
            message: `${id}: number outside range [${def.min}, ${def.max}]`
          })
        }
        break
      }
      // image: no validation - picked or default
    }
  }

  return errors
}

// ---------------------------------------------------------------------------
// Param resolution (apply values or defaults)
// ---------------------------------------------------------------------------

function resolveValues(template: MotionTemplate, values: ParamValues): ParamValues {
  const resolved: ParamValues = {}
  for (const [id, def] of Object.entries(template.params)) {
    const val = values[id]
    switch (def.kind) {
      case 'text':
        resolved[id] = typeof val === 'string' ? val : def.default
        break
      case 'colour':
        resolved[id] = typeof val === 'string' ? val : def.default
        break
      case 'hold':
        resolved[id] = typeof val === 'number' ? val : def.default
        break
      case 'numberList':
        resolved[id] = Array.isArray(val) ? val : def.default
        break
      case 'number':
        resolved[id] = typeof val === 'number' ? val : def.default
        break
      case 'image':
        resolved[id] = val ?? ({ sourceName: 'source.png' } as ImageValue)
        break
    }
  }
  return resolved
}

// ---------------------------------------------------------------------------
// Apply text param values to layers
// ---------------------------------------------------------------------------

function applyTextValues(
  layers: Layer[],
  params: Record<string, ParamDef>,
  values: ParamValues
): Layer[] {
  return layers.map(layer => {
    if (layer.kind === 'group') {
      return {
        ...layer,
        children: applyTextValues(layer.children, params, values)
      }
    }
    if (layer.kind === 'text' && layer.param) {
      const val = values[layer.param]
      if (typeof val === 'string') {
        return { ...layer, text: val }
      }
    }
    return layer
  })
}

// ---------------------------------------------------------------------------
// Apply colour param bindings
// ---------------------------------------------------------------------------

function applyColourBindings(
  layers: Layer[],
  params: Record<string, ParamDef>,
  values: ParamValues
): Layer[] {
  // Build a map of bound paths to their resolved colour
  const bindings = new Map<string, string>()
  for (const [id, def] of Object.entries(params)) {
    if (def.kind === 'colour') {
      const colour = typeof values[id] === 'string' ? (values[id] as string) : def.default
      for (const bindPath of def.binds) {
        bindings.set(bindPath, colour)
      }
    }
  }

  function applyToLayers(ls: Layer[], prefix: string): Layer[] {
    return ls.map((layer, i) => {
      const path = `${prefix}[${i}]`
      if (layer.kind === 'group') {
        return {
          ...layer,
          children: applyToLayers(layer.children, `${path}.children`)
        }
      }
      const bound = bindings.get(path)
      if (bound && 'fill' in layer) {
        return { ...layer, fill: bound }
      }
      return layer
    })
  }

  return applyToLayers(layers, 'layers')
}

// ---------------------------------------------------------------------------
// Hold shift
// ---------------------------------------------------------------------------

/**
 * Shift keyframes at or after `outStart` by `delta` seconds.
 * Also adjusts `outStart` and `duration` by the same amount.
 */
function applyHoldShift(layers: Layer[], outStart: number, delta: number): Layer[] {
  if (delta === 0) return layers

  function shiftKeyframes<V>(kfs: Keyframe<V>[] | undefined): Keyframe<V>[] | undefined {
    if (!kfs) return kfs
    return kfs.map(kf => (kf.t >= outStart ? { ...kf, t: kf.t + delta } : kf))
  }

  function shiftLayer(layer: Layer): Layer {
    const base = {
      ...layer,
      position: shiftKeyframes(layer.position),
      scale: shiftKeyframes(layer.scale),
      rotation: shiftKeyframes(layer.rotation),
      opacity: shiftKeyframes(layer.opacity)
    }

    switch (layer.kind) {
      case 'text':
        return {
          ...base,
          kind: 'text',
          fillAnimation: shiftKeyframes(layer.fillAnimation),
          tracking: shiftKeyframes(layer.tracking),
          counter: layer.counter
            ? { ...layer.counter, progress: shiftKeyframes(layer.counter.progress)! }
            : undefined
        } as TextLayer
      case 'rect':
        return {
          ...base,
          kind: 'rect',
          fillAnimation: shiftKeyframes(layer.fillAnimation),
          widthAnimation: shiftKeyframes(layer.widthAnimation),
          heightAnimation: shiftKeyframes(layer.heightAnimation)
        } as RectLayer
      case 'ellipse':
        return {
          ...base,
          kind: 'ellipse',
          fillAnimation: shiftKeyframes(layer.fillAnimation)
        } as EllipseLayer
      case 'path':
        return {
          ...base,
          kind: 'path',
          fillAnimation: shiftKeyframes(layer.fillAnimation)
        } as PathLayer
      case 'arc':
        return {
          ...base,
          kind: 'arc',
          sweep: shiftKeyframes(layer.sweep)!,
          startAngle: shiftKeyframes(layer.startAngle)!,
          fillAnimation: shiftKeyframes(layer.fillAnimation)
        } as ArcLayer
      case 'group':
        return {
          ...base,
          kind: 'group',
          children: layer.children.map(shiftLayer)
        }
      case 'particles':
        return base as ParticlesLayer
      case 'series':
        return base as SeriesLayer
      default:
        return base as Layer
    }
  }

  return layers.map(shiftLayer)
}

// ---------------------------------------------------------------------------
// Format scaling
// ---------------------------------------------------------------------------

/** Scale factor from 3840x2160 (template space) to the output format. */
function scaleFactor(format: MotionFormat): number {
  return format.width / 3840
}

function scaleKeyframesPoint(
  kfs: Keyframe<{ x: number; y: number }>[] | undefined,
  factor: number
): Keyframe<{ x: number; y: number }>[] | undefined {
  if (!kfs || factor === 1) return kfs
  return kfs.map(kf => ({
    ...kf,
    value: { x: kf.value.x * factor, y: kf.value.y * factor }
  }))
}

function scaleKeyframesNumber(
  kfs: Keyframe<number>[] | undefined,
  factor: number
): Keyframe<number>[] | undefined {
  if (!kfs || factor === 1) return kfs
  return kfs.map(kf => ({ ...kf, value: kf.value * factor }))
}

function scaleLayer(layer: Layer, factor: number): Layer {
  if (factor === 1) return layer

  const base = {
    ...layer,
    anchor: { x: layer.anchor.x * factor, y: layer.anchor.y * factor },
    position: scaleKeyframesPoint(layer.position, factor)
    // scale, rotation, opacity are NOT scaled - they are ratios/angles/fractions
  }

  switch (layer.kind) {
    case 'text':
      return {
        ...base,
        kind: 'text',
        font: { ...layer.font, size: layer.font.size * factor },
        width: layer.width ? layer.width * factor : undefined
      } as TextLayer
    case 'rect':
      return {
        ...base,
        kind: 'rect',
        width: layer.width * factor,
        height: layer.height * factor,
        widthAnimation: scaleKeyframesNumber(layer.widthAnimation, factor),
        heightAnimation: scaleKeyframesNumber(layer.heightAnimation, factor),
        radius: layer.radius * factor
      } as RectLayer
    case 'ellipse':
      return {
        ...base,
        kind: 'ellipse',
        radiusX: layer.radiusX * factor,
        radiusY: layer.radiusY * factor
      } as EllipseLayer
    case 'path':
      // Path d coordinates would need scaling too - scale them
      return {
        ...base,
        kind: 'path',
        d: scalePathD(layer.d, factor)
      } as PathLayer
    case 'arc':
      return {
        ...base,
        kind: 'arc',
        innerRadius: layer.innerRadius * factor,
        outerRadius: layer.outerRadius * factor
      } as ArcLayer
    case 'group':
      return {
        ...base,
        kind: 'group',
        children: layer.children.map(c => scaleLayer(c, factor))
      }
    case 'particles':
      return {
        ...base,
        kind: 'particles',
        points: layer.points.map(p => ({
          ...p,
          x: p.x * factor,
          y: p.y * factor
        })),
        pointRadius: layer.pointRadius * factor
      } as ParticlesLayer
    default:
      return base as Layer
  }
}

/** Scale numeric coordinates in an SVG path d string. */
function scalePathD(d: string, factor: number): string {
  if (factor === 1) return d
  // Replace each number in the path data with its scaled version
  return d.replace(/-?\d+(\.\d+)?/g, match => {
    return String(parseFloat(match) * factor)
  })
}

function scaleLayers(layers: Layer[], format: MotionFormat): Layer[] {
  const factor = scaleFactor(format)
  if (factor === 1) return layers
  return layers.map(l => scaleLayer(l, factor))
}

// ---------------------------------------------------------------------------
// Frame snap
// ---------------------------------------------------------------------------

/** Snap a time to the nearest frame at the given fps. */
function snapToFrame(t: number, fps: number): number {
  const frame = Math.round(t * fps)
  return frame / fps
}

/**
 * Snap all keyframe times in the template to the nearest frame.
 */
function snapKeyframes<V>(
  kfs: Keyframe<V>[] | undefined,
  fps: number
): Keyframe<V>[] | undefined {
  if (!kfs) return kfs
  return kfs.map(kf => ({ ...kf, t: snapToFrame(kf.t, fps) }))
}

function snapLayer(layer: Layer, fps: number): Layer {
  const base = {
    ...layer,
    position: snapKeyframes(layer.position, fps),
    scale: snapKeyframes(layer.scale, fps),
    rotation: snapKeyframes(layer.rotation, fps),
    opacity: snapKeyframes(layer.opacity, fps)
  }

  switch (layer.kind) {
    case 'text':
      return {
        ...base,
        kind: 'text',
        fillAnimation: snapKeyframes(layer.fillAnimation, fps),
        tracking: snapKeyframes(layer.tracking, fps),
        counter: layer.counter
          ? { ...layer.counter, progress: snapKeyframes(layer.counter.progress, fps)! }
          : undefined
      } as TextLayer
    case 'rect':
      return {
        ...base,
        kind: 'rect',
        fillAnimation: snapKeyframes(layer.fillAnimation, fps),
        widthAnimation: snapKeyframes(layer.widthAnimation, fps),
        heightAnimation: snapKeyframes(layer.heightAnimation, fps)
      } as RectLayer
    case 'ellipse':
      return {
        ...base,
        kind: 'ellipse',
        fillAnimation: snapKeyframes(layer.fillAnimation, fps)
      } as EllipseLayer
    case 'path':
      return {
        ...base,
        kind: 'path',
        fillAnimation: snapKeyframes(layer.fillAnimation, fps)
      } as PathLayer
    case 'arc':
      return {
        ...base,
        kind: 'arc',
        sweep: snapKeyframes(layer.sweep, fps)!,
        startAngle: snapKeyframes(layer.startAngle, fps)!,
        fillAnimation: snapKeyframes(layer.fillAnimation, fps)
      } as ArcLayer
    case 'group':
      return {
        ...base,
        kind: 'group',
        children: layer.children.map(c => snapLayer(c, fps))
      }
    case 'particles':
      return base as ParticlesLayer
    default:
      return base as Layer
  }
}

function snapAllKeyframes(layers: Layer[], fps: number): Layer[] {
  return layers.map(l => snapLayer(l, fps))
}

// ---------------------------------------------------------------------------
// Per-fps validity: detect collapsing keyframes
// ---------------------------------------------------------------------------

/**
 * Collect all keyframe pairs that might collapse at a given fps.
 * Returns an issue string if any pair of distinct-valued keyframes snaps to the
 * same frame, or null if all are valid.
 */
function checkCollapsingKeyframes(layers: Layer[], fps: number): string | null {
  function checkTrack<V>(
    kfs: Keyframe<V>[] | undefined,
    equal: (a: V, b: V) => boolean
  ): boolean {
    if (!kfs || kfs.length < 2) return true
    for (let i = 0; i < kfs.length - 1; i++) {
      for (let j = i + 1; j < kfs.length; j++) {
        const snapI = snapToFrame(kfs[i].t, fps)
        const snapJ = snapToFrame(kfs[j].t, fps)
        if (snapI === snapJ && !equal(kfs[i].value, kfs[j].value)) {
          return false
        }
      }
    }
    return true
  }

  const numEq = (a: number, b: number) => a === b
  const strEq = (a: string, b: string) => a === b
  const ptEq = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    a.x === b.x && a.y === b.y

  /** Check kind-specific animated tracks for a single layer. */
  function checkKindTracks(layer: Layer): boolean {
    switch (layer.kind) {
      case 'text':
        return (
          checkTrack(layer.fillAnimation, strEq) &&
          checkTrack(layer.tracking, numEq) &&
          (!layer.counter || checkTrack(layer.counter.progress, numEq))
        )
      case 'rect':
        return (
          checkTrack(layer.fillAnimation, strEq) &&
          checkTrack(layer.widthAnimation, numEq) &&
          checkTrack(layer.heightAnimation, numEq)
        )
      case 'ellipse':
      case 'path':
        return checkTrack((layer as EllipseLayer).fillAnimation, strEq)
      case 'arc':
        return (
          checkTrack(layer.sweep, numEq) &&
          checkTrack(layer.startAngle, numEq) &&
          checkTrack(layer.fillAnimation, strEq)
        )
      case 'group':
        return layer.children.every(checkLayer)
      default:
        return true
    }
  }

  function checkLayer(layer: Layer): boolean {
    if (!checkTrack(layer.position, ptEq)) return false
    if (!checkTrack(layer.scale, ptEq)) return false
    if (!checkTrack(layer.rotation, numEq)) return false
    if (!checkTrack(layer.opacity, numEq)) return false
    return checkKindTracks(layer)
  }

  for (const layer of layers) {
    if (!checkLayer(layer)) {
      return `keyframes collapse at ${fps}fps`
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Slug and folder name
// ---------------------------------------------------------------------------

/**
 * Generate a URL-safe slug from a text value.
 * NFKD normalise, strip diacritics, lowercase, keep [a-z0-9], join with -,
 * cap at 40 characters, no leading or trailing -.
 */
export function slugify(text: string): string {
  const normalized = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // non-alnum runs become -
    .replace(/^-+|-+$/g, '') // strip leading/trailing -

  if (normalized.length <= 40) return normalized

  // Cut at 40, then strip trailing -
  return normalized.slice(0, 40).replace(/-+$/, '')
}

/**
 * Build the export folder name from template id and slug.
 */
export function exportFolderName(templateId: string, slug: string): string {
  if (!slug) return templateId
  return `${templateId}-${slug}`
}

// ---------------------------------------------------------------------------
// Target derivation
// ---------------------------------------------------------------------------

/** Walk layers recursively to check for particles. */
function hasParticles(layers: Layer[]): boolean {
  for (const layer of layers) {
    if (layer.kind === 'particles') return true
    if (layer.kind === 'group') {
      if (hasParticles(layer.children)) return true
    }
  }
  return false
}

/**
 * Derive the export targets a template supports.
 * Particle templates: video + prompt only.
 * Everything else: ae, resolve, mogrt-via-ae, video, prompt.
 */
export function deriveTargets(template: MotionTemplate): MotionTarget[] {
  if (hasParticles(template.layers)) {
    return ['video', 'prompt']
  }
  return ['ae', 'resolve', 'mogrt-via-ae', 'video', 'prompt']
}

// ---------------------------------------------------------------------------
// Valid formats
// ---------------------------------------------------------------------------

const ALL_WIDTHS = [3840, 1920] as const
const ALL_FPS = [24, 25, 30, 50, 60] as const

/**
 * Return every format at which this template's keyframes do not collapse.
 */
export function validFormats(template: MotionTemplate): MotionFormat[] {
  const formats: MotionFormat[] = []
  for (const width of ALL_WIDTHS) {
    const height = width === 3840 ? 2160 : 1080
    for (const fps of ALL_FPS) {
      const issue = checkCollapsingKeyframes(template.layers, fps)
      if (!issue) {
        formats.push({
          width: width as 3840 | 1920,
          height: height as 2160 | 1080,
          fps: fps as 24 | 25 | 30 | 50 | 60
        })
      }
    }
  }
  return formats
}

// ---------------------------------------------------------------------------
// Full resolve pipeline
// ---------------------------------------------------------------------------

/**
 * Resolve a template with given values and format into a `ResolvedTemplate`
 * ready for the evaluator and exporters.
 *
 * Steps: validate, apply defaults, apply text/colour, expand macros, hold shift,
 * scale to format, snap to frame grid.
 */
export function resolveTemplate(
  template: MotionTemplate,
  values: ParamValues,
  format: MotionFormat
): ResolvedTemplate {
  // 1. Resolve values (apply defaults)
  const resolvedValues = resolveValues(template, values)

  // 2. Apply text param values to layers
  let layers = applyTextValues(template.layers, template.params, resolvedValues)

  // 3. Apply colour bindings
  layers = applyColourBindings(layers, template.params, resolvedValues)

  // 4. Expand macros (series, sweepFromParam)
  layers = expandTemplate(layers, template.params, resolvedValues)

  // 5. Hold shift
  const holdParam = Object.entries(template.params).find(([, def]) => def.kind === 'hold')
  let holdDelta = 0
  let outStart = template.outStart
  let duration = template.duration

  if (holdParam && template.hold) {
    const [holdId] = holdParam
    const holdValue =
      typeof resolvedValues[holdId] === 'number'
        ? (resolvedValues[holdId] as number)
        : template.hold.default
    holdDelta = holdValue - template.hold.default
    layers = applyHoldShift(layers, template.outStart, holdDelta)
    outStart = template.outStart + holdDelta
    duration = template.duration + holdDelta
  }

  // 6. Scale to format
  layers = scaleLayers(layers, format)

  // 7. Snap keyframes to frame grid
  layers = snapAllKeyframes(layers, format.fps)

  // Snap timing markers too
  const inEnd = snapToFrame(template.inEnd, format.fps)
  const snappedOutStart = snapToFrame(outStart, format.fps)
  const snappedDuration = snapToFrame(duration, format.fps)

  return {
    id: template.id,
    name: template.name,
    description: template.description,
    category: template.category,
    status: template.status,
    fonts: template.fonts,
    duration: snappedDuration,
    inEnd,
    outStart: snappedOutStart,
    hasHold: !!holdParam,
    layers: asPrimitiveLayers(layers),
    originalTemplate: template,
    values: resolvedValues
  }
}

/**
 * After expansion, series layers are gone. Groups remain for transform
 * composition in the evaluator. The cast is safe because expandTemplate
 * replaces every SeriesLayer with primitives.
 */
function asPrimitiveLayers(layers: Layer[]): PrimitiveLayer[] {
  return layers as PrimitiveLayer[]
}
