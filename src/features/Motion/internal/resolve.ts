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
import { parseBindPath } from './bindPath'
import { expandTemplate } from './expand'
import { hasParticles } from './layers'
import type { TextMeasurer } from './textOverflow'
import { countLines, wrapText } from './wrapText'

/** Exhaustiveness check: the compiler proves this is never called. */
function assertNever(x: never): never {
  throw new Error(`Unexpected layer kind: ${(x as { kind: string }).kind}`)
}

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

/** Validate a single colour param. */
function validateColourParam(
  id: string,
  def: Extract<ParamDef, { kind: 'colour' }>,
  val: unknown
): ParamError[] {
  const colour = typeof val === 'string' ? val : def.default
  if (!/^#[0-9a-fA-F]{6}$/.test(colour)) {
    return [{ paramId: id, message: `${id}: invalid hex colour` }]
  }
  return []
}

/** Validate a single hold param. */
function validateHoldParam(
  id: string,
  def: Extract<ParamDef, { kind: 'hold' }>,
  val: unknown
): ParamError[] {
  const hold = typeof val === 'number' ? val : def.default
  if (hold < def.min || hold > def.max) {
    return [
      { paramId: id, message: `${id}: hold outside range [${def.min}, ${def.max}]` }
    ]
  }
  return []
}

/** Validate a single number param. */
function validateNumberParam(
  id: string,
  def: Extract<ParamDef, { kind: 'number' }>,
  val: unknown
): ParamError[] {
  const n = typeof val === 'number' ? val : def.default
  if (n < def.min || n > def.max) {
    return [
      { paramId: id, message: `${id}: number outside range [${def.min}, ${def.max}]` }
    ]
  }
  return []
}

/**
 * Validate param values against the template's param definitions.
 * Returns an empty array when all values are valid.
 *
 * When a measurer is provided, wrap layers are checked for line count.
 * Without a measurer, the fallback approximation is used.
 */
export function validateParams(
  template: MotionTemplate,
  values: ParamValues,
  measurer?: TextMeasurer
): ParamError[] {
  const errors: ParamError[] = []
  const m = measurer ?? APPROX_MEASURER

  for (const [id, def] of Object.entries(template.params)) {
    const val = values[id]

    switch (def.kind) {
      case 'text':
        errors.push(...validateTextParam(id, def, val))
        errors.push(...validateWrapLineCount(id, def, val, template, m))
        break
      case 'colour':
        errors.push(...validateColourParam(id, def, val))
        break
      case 'hold':
        errors.push(...validateHoldParam(id, def, val))
        break
      case 'numberList':
        errors.push(...validateNumberListParam(id, def, val))
        break
      case 'number':
        errors.push(...validateNumberParam(id, def, val))
        break
      // image: no validation - picked or default
    }
  }

  return errors
}

/** Check whether a text param's value wraps to more than maxLines. */
function validateWrapLineCount(
  id: string,
  def: Extract<ParamDef, { kind: 'text' }>,
  val: unknown,
  template: MotionTemplate,
  measurer: TextMeasurer
): ParamError[] {
  const text = typeof val === 'string' ? val : def.default

  // Find layers that bind this param and have wrap enabled
  function findWrapLayers(
    layers: Layer[]
  ): (TextLayer & { wrap: true; maxLines: number; width: number })[] {
    const result: (TextLayer & { wrap: true; maxLines: number; width: number })[] = []
    for (const layer of layers) {
      if (layer.kind === 'group') {
        result.push(...findWrapLayers(layer.children))
      } else if (
        layer.kind === 'text' &&
        layer.param === id &&
        layer.wrap &&
        layer.maxLines != null &&
        layer.width != null
      ) {
        result.push(layer as TextLayer & { wrap: true; maxLines: number; width: number })
      }
    }
    return result
  }

  const wrapLayers = findWrapLayers(template.layers)
  const errors: ParamError[] = []

  for (const layer of wrapLayers) {
    const wrapped = wrapText(text, layer.width, layer.font, measurer)
    const lines = countLines(wrapped)
    if (lines > layer.maxLines) {
      errors.push({
        paramId: id,
        message: `Needs ${lines} lines; this template fits ${layer.maxLines}.`
      })
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
// Automatic line wrapping
// ---------------------------------------------------------------------------

/**
 * Default (approximation-based) measurer: chars x size x 0.6.
 * Used by timing rules, unit tests, and when no canvas font is available.
 */
const APPROX_MEASURER: TextMeasurer = {
  measure(text: string, font: { family: string; size: number }): number {
    return text.length * font.size * 0.6
  }
}

/**
 * Apply automatic wrapping to text layers that opt in (`wrap: true`).
 * Runs at native template sizes (before scaling), so break positions
 * are identical at every output format.
 */
function applyWrap(layers: Layer[], measurer: TextMeasurer): Layer[] {
  return layers.map(layer => {
    if (layer.kind === 'group') {
      return { ...layer, children: applyWrap(layer.children, measurer) }
    }
    if (layer.kind === 'text' && layer.wrap && layer.width != null) {
      const wrapped = wrapText(layer.text, layer.width, layer.font, measurer)
      return { ...layer, text: wrapped }
    }
    return layer
  })
}

// ---------------------------------------------------------------------------
// Stagger delay quantisation
// ---------------------------------------------------------------------------

/**
 * Count grapheme clusters in a string using Intl.Segmenter.
 * Falls back to Array.from if Segmenter is unavailable.
 */
function graphemeCount(text: string): number {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    return Array.from(segmenter.segment(text)).length
  }
  return Array.from(text).length
}

/**
 * Quantise stagger delays to whole frames at the chosen fps, clamped so the
 * total stagger never exceeds 40% of `inEnd`.
 *
 * The approach: compute the maximum number of whole frames that keeps the
 * stagger budget, then cap the authored delay at that frame count. When even
 * one frame per character would exceed the budget, stagger is disabled (delay 0).
 *
 * This replaces the earlier two-step approach (continuous clamp then round up)
 * which broke the budget when a sub-frame delay rounded up to a full frame.
 */
function quantiseStaggerDelays(layers: Layer[], fps: number, inEnd: number): Layer[] {
  const frameDuration = 1 / fps
  const budget = inEnd * 0.4

  return layers.map(layer => {
    if (layer.kind === 'group') {
      return {
        ...layer,
        children: quantiseStaggerDelays(layer.children, fps, inEnd)
      }
    }
    if (layer.kind === 'text' && layer.stagger && layer.stagger.delay > 0) {
      const charCount = graphemeCount(layer.text)
      const n = Math.max(1, charCount - 1)
      // Maximum whole frames that keeps n * delay within the budget.
      // n is charCount - 1 (the number of inter-character gaps).
      // The epsilon stops float noise (0.4 * 0.7 * 25 / 7 = 0.9999...) from
      // dropping an exact fit to zero frames.
      const maxFrames = Math.floor((budget * fps) / n + 1e-9)
      if (maxFrames <= 0) {
        // Even one frame per character exceeds the budget - drop stagger
        // entirely so exporters do not emit a follower with delay 0
        return { ...layer, stagger: undefined }
      }
      // Authored delay to the nearest whole frame, at least one so a short
      // authored stagger stays visible, then capped by the budget
      const authoredFrames = Math.max(1, Math.round(layer.stagger.delay * fps))
      const quantised = Math.min(authoredFrames, maxFrames) * frameDuration
      if (quantised !== layer.stagger.delay) {
        return { ...layer, stagger: { delay: quantised } }
      }
    }
    return layer
  })
}

// ---------------------------------------------------------------------------
// Apply colour param bindings
// ---------------------------------------------------------------------------

/**
 * Particle region tints name colour params (spec D2a). Replace each name with
 * that param's value. A literal hex colour is kept as authored; any other
 * name falls back to the layer's base fill, so a canvas never receives a
 * string it cannot paint (which it would silently draw black).
 */
function resolveRegionFills(
  layers: Layer[],
  params: MotionTemplate['params'],
  values: ParamValues
): Layer[] {
  const colourOf = (name: string, fallback: string): string => {
    const def = params[name]
    if (def?.kind === 'colour') {
      const v = values[name]
      return typeof v === 'string' ? v : def.default
    }
    return /^#[0-9a-f]{3,8}$/i.test(name) ? name : fallback
  }
  return layers.map(layer => {
    if (layer.kind === 'group') {
      return { ...layer, children: resolveRegionFills(layer.children, params, values) }
    }
    if (layer.kind !== 'particles') return layer
    const regionFills = Object.fromEntries(
      Object.entries(layer.regionFills).map(([region, ref]) => [
        region,
        colourOf(ref, layer.baseFill)
      ])
    )
    return { ...layer, regionFills }
  })
}

function applyColourBindings(
  layers: Layer[],
  params: Record<string, ParamDef>,
  values: ParamValues
): Layer[] {
  // Build a map of parsed bind-path index lists to their resolved colour.
  // Using parseBindPath ensures the same grammar as the schema and Fusion.
  const bindings: { indices: number[]; colour: string }[] = []
  for (const [id, def] of Object.entries(params)) {
    if (def.kind === 'colour') {
      const colour = typeof values[id] === 'string' ? (values[id] as string) : def.default
      for (const bindPath of def.binds) {
        const indices = parseBindPath(bindPath)
        if (indices) bindings.push({ indices, colour })
      }
    }
  }

  // Walk the layer tree by index, matching each node against every binding.
  function applyAtPath(ls: Layer[], parentIndices: number[]): Layer[] {
    return ls.map((layer, i) => {
      const current = [...parentIndices, i]
      if (layer.kind === 'group') {
        return {
          ...layer,
          children: applyAtPath(layer.children, current)
        }
      }
      // Check whether any binding targets this exact node
      for (const { indices, colour } of bindings) {
        if (
          indices.length === current.length &&
          indices.every((idx, j) => idx === current[j]) &&
          'fill' in layer
        ) {
          return { ...layer, fill: colour }
        }
      }
      return layer
    })
  }

  return applyAtPath(layers, [])
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
        return assertNever(layer)
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
    case 'series':
      // Series layers are expanded before scaling, but the type union
      // still includes them. Pass through (should not be reached).
      return base as SeriesLayer
    default:
      return assertNever(layer)
  }
}

/**
 * Scale numeric coordinates in an SVG path d string.
 *
 * The schema restricts `d` to absolute M, L and Z commands. Every
 * numeric token in that grammar is a coordinate, so a blanket replacement
 * is correct (unlike the old version which would also scale arc flags).
 */
function scalePathD(d: string, factor: number): string {
  if (factor === 1) return d
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
    case 'series':
      return base as SeriesLayer
    default:
      return assertNever(layer)
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

  function checkTextTracks(layer: TextLayer): boolean {
    return (
      checkTrack(layer.fillAnimation, strEq) &&
      checkTrack(layer.tracking, numEq) &&
      (!layer.counter || checkTrack(layer.counter.progress, numEq))
    )
  }

  /** Check kind-specific animated tracks for a single layer. */
  function checkKindTracks(layer: Layer): boolean {
    switch (layer.kind) {
      case 'text':
        return checkTextTracks(layer)
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
      case 'particles':
      case 'series':
        return true
      default:
        return assertNever(layer)
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
// Hold param helper
// ---------------------------------------------------------------------------

/**
 * Return the single hold param entry, or null. The schema enforces at most one.
 */
export function getHoldParam(
  template: MotionTemplate
): { id: string; def: Extract<ParamDef, { kind: 'hold' }> } | null {
  for (const [id, def] of Object.entries(template.params)) {
    if (def.kind === 'hold') return { id, def }
  }
  return null
}

// ---------------------------------------------------------------------------
// Shared structure resolution
// ---------------------------------------------------------------------------

/**
 * Apply values, text, colour, expand macros and fill default positions.
 *
 * Both `validFormats` and `resolveTemplate` call this, so the two pipelines
 * cannot drift in the steps that precede hold-shift and scaling.
 */
function resolveStructure(
  template: MotionTemplate,
  values: ParamValues,
  measurer?: TextMeasurer
): { layers: Layer[]; resolvedValues: ParamValues } {
  const resolvedValues = resolveValues(template, values)
  let layers = applyTextValues(template.layers, template.params, resolvedValues)
  layers = applyWrap(layers, measurer ?? APPROX_MEASURER)
  layers = applyColourBindings(layers, template.params, resolvedValues)
  layers = resolveRegionFills(layers, template.params, resolvedValues)
  layers = expandTemplate(layers, template.params, resolvedValues)
  layers = fillDefaultPositions(layers)
  return { layers, resolvedValues }
}

// ---------------------------------------------------------------------------
// Valid formats
// ---------------------------------------------------------------------------

const ALL_WIDTHS = [3840, 1920] as const
const ALL_FPS = [24, 25, 30, 50, 60] as const

/**
 * Return every format at which this template's keyframes do not collapse.
 *
 * The check runs on expanded, hold-shifted layers (at the hold param's
 * default value) so that series marker keys and shifted out-keys are covered.
 */
export function validFormats(template: MotionTemplate): MotionFormat[] {
  const { layers } = resolveStructure(template, {})

  // Check at the default hold and at the extremes of the hold range
  const hold = getHoldParam(template)
  const holdDeltas = [0]
  if (hold) {
    holdDeltas.push(hold.def.min - hold.def.default, hold.def.max - hold.def.default)
  }

  const formats: MotionFormat[] = []
  for (const width of ALL_WIDTHS) {
    const height = width === 3840 ? 2160 : 1080
    for (const fps of ALL_FPS) {
      let valid = true
      for (const delta of holdDeltas) {
        const shifted =
          delta !== 0 ? applyHoldShift(layers, template.outStart, delta) : layers
        const issue = checkCollapsingKeyframes(shifted, fps)
        if (issue) {
          valid = false
          break
        }
      }
      if (valid) {
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
// Default position fill
// ---------------------------------------------------------------------------

/**
 * Ensure every layer has an explicit position track. When position is absent,
 * the evaluator defaults to the origin. Making that explicit means no exporter
 * needs its own default, and the Fusion/AE/preview pipelines cannot disagree.
 */
function fillDefaultPositions(layers: Layer[]): Layer[] {
  return layers.map(layer => {
    if (layer.kind === 'group') {
      const patched = {
        ...layer,
        children: fillDefaultPositions(layer.children)
      }
      if (!patched.position) {
        return { ...patched, position: [{ t: 0, value: { x: 0, y: 0 } }] }
      }
      return patched
    }
    if (!layer.position) {
      return { ...layer, position: [{ t: 0, value: { x: 0, y: 0 } }] }
    }
    return layer
  })
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
  format: MotionFormat,
  measurer?: TextMeasurer
): ResolvedTemplate {
  // Steps 1-4b: shared with validFormats via resolveStructure
  const structure = resolveStructure(template, values, measurer)
  const { resolvedValues } = structure
  let { layers } = structure

  // 5. Hold shift (the hold param is the single source)
  const hold = getHoldParam(template)
  let outStart = template.outStart
  let duration = template.duration

  if (hold) {
    const holdValue =
      typeof resolvedValues[hold.id] === 'number'
        ? (resolvedValues[hold.id] as number)
        : hold.def.default
    const holdDelta = holdValue - hold.def.default
    layers = applyHoldShift(layers, template.outStart, holdDelta)
    outStart = template.outStart + holdDelta
    duration = template.duration + holdDelta
  }

  // 6. Scale to format
  layers = scaleLayers(layers, format)

  // 7. Snap inEnd first so the stagger budget uses the snapped value
  const inEnd = snapToFrame(template.inEnd, format.fps)

  // 8. Quantise stagger delays to whole frames, clamped to the 40% budget
  layers = quantiseStaggerDelays(layers, format.fps, inEnd)

  // 9. Snap keyframes to frame grid
  layers = snapAllKeyframes(layers, format.fps)
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
    hasHold: !!hold,
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
