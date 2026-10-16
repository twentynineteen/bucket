/**
 * Motion evaluator (issue #328)
 *
 * `evaluate(resolved, t) -> LayerState[]` is the single source of truth for
 * what every layer looks like at time t. It is pure: no side effects, no
 * mutation of the input. The preview, the video renderer and the tests all
 * call this function.
 *
 * The input is a `ResolvedTemplate` (values applied, macros expanded, hold
 * shifted, format-scaled, frame-snapped) produced by #327's `resolveTemplate`.
 */
import type {
  ArcLayer,
  EllipseLayer,
  Keyframe,
  LayerState,
  Matrix2D,
  ParticlesLayer,
  ParticlesLayerState,
  PrimitiveLayer,
  RectLayer,
  ResolvedTemplate,
  ShapeLayerState,
  StaggerUnit,
  TextLayer,
  TextLayerState
} from '../types'
import { solveCubicBezier } from './bezier'
import { formatCounter } from './expand'
import { computeParticleState } from './particleState'

// ---------------------------------------------------------------------------
// Matrix helpers (2D affine: [a, b, c, d, tx, ty])
// ---------------------------------------------------------------------------

const IDENTITY: Matrix2D = [1, 0, 0, 1, 0, 0]

/** Multiply two 2D affine matrices: result = A * B */
function multiplyMatrix(a: Matrix2D, b: Matrix2D): Matrix2D {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5]
  ]
}

/**
 * Build the local transform matrix for a layer at time t.
 *
 * Order: translate(position) * translate(-anchor) * rotate * scale
 * This ensures the anchor acts as the transform origin.
 */
function buildLocalMatrix(layer: PrimitiveLayer, t: number): Matrix2D {
  const pos = interpolatePoint(layer.position, t) ?? { x: 0, y: 0 }
  const sc = interpolatePoint(layer.scale, t) ?? { x: 1, y: 1 }
  const rot = interpolateNumber(layer.rotation, t) ?? 0
  const anchor = layer.anchor

  const radians = (rot * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)

  // Combined: translate(pos) * translate(-anchor) * rotate * scale
  // But we want: T(pos) * R(rot) * S(sc) * T(-anchor)
  // So the anchor offset is applied after scaling and rotation.
  const a = cos * sc.x
  const b = sin * sc.x
  const c = -sin * sc.y
  const d = cos * sc.y

  const tx = pos.x - (a * anchor.x + c * anchor.y)
  const ty = pos.y - (b * anchor.x + d * anchor.y)

  return [a, b, c, d, tx, ty]
}

// ---------------------------------------------------------------------------
// Keyframe interpolation
// ---------------------------------------------------------------------------

/**
 * Interpolate a numeric keyframe track at time t.
 * Holds before first key and after last key.
 * Uses the ease on keyframe k to interpolate the segment k -> k+1.
 */
function interpolateNumber(
  track: Keyframe<number>[] | undefined,
  t: number
): number | undefined {
  if (!track || track.length === 0) return undefined
  if (track.length === 1 || t <= track[0].t) return track[0].value
  if (t >= track[track.length - 1].t) return track[track.length - 1].value

  for (let i = 0; i < track.length - 1; i++) {
    if (t >= track[i].t && t <= track[i + 1].t) {
      const dt = track[i + 1].t - track[i].t
      if (dt <= 0) return track[i].value
      const localT = (t - track[i].t) / dt
      const ease = track[i].ease
      const progress = ease ? solveCubicBezier(ease, localT) : localT
      return track[i].value + (track[i + 1].value - track[i].value) * progress
    }
  }
  return track[track.length - 1].value
}

/**
 * Interpolate a 2D point keyframe track at time t.
 */
function interpolatePoint(
  track: Keyframe<{ x: number; y: number }>[] | undefined,
  t: number
): { x: number; y: number } | undefined {
  if (!track || track.length === 0) return undefined
  if (track.length === 1 || t <= track[0].t) return track[0].value
  if (t >= track[track.length - 1].t) return track[track.length - 1].value

  for (let i = 0; i < track.length - 1; i++) {
    if (t >= track[i].t && t <= track[i + 1].t) {
      const dt = track[i + 1].t - track[i].t
      if (dt <= 0) return track[i].value
      const localT = (t - track[i].t) / dt
      const ease = track[i].ease
      const progress = ease ? solveCubicBezier(ease, localT) : localT
      return {
        x: track[i].value.x + (track[i + 1].value.x - track[i].value.x) * progress,
        y: track[i].value.y + (track[i + 1].value.y - track[i].value.y) * progress
      }
    }
  }
  return track[track.length - 1].value
}

// ---------------------------------------------------------------------------
// Colour interpolation (sRGB per-channel)
// ---------------------------------------------------------------------------

/** Parse #rrggbb to [r, g, b] in 0-255. */
function parseHex(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}

/** Convert [r, g, b] 0-255 to #rrggbb. */
function toHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
  return (
    '#' +
    clamp(r).toString(16).padStart(2, '0') +
    clamp(g).toString(16).padStart(2, '0') +
    clamp(b).toString(16).padStart(2, '0')
  )
}

/**
 * Interpolate a colour keyframe track at time t (per-channel sRGB).
 */
function interpolateColour(
  track: Keyframe<string>[] | undefined,
  t: number
): string | undefined {
  if (!track || track.length === 0) return undefined
  if (track.length === 1 || t <= track[0].t) return track[0].value
  if (t >= track[track.length - 1].t) return track[track.length - 1].value

  for (let i = 0; i < track.length - 1; i++) {
    if (t >= track[i].t && t <= track[i + 1].t) {
      const dt = track[i + 1].t - track[i].t
      if (dt <= 0) return track[i].value
      const localT = (t - track[i].t) / dt
      const ease = track[i].ease
      const progress = ease ? solveCubicBezier(ease, localT) : localT

      const [r0, g0, b0] = parseHex(track[i].value)
      const [r1, g1, b1] = parseHex(track[i + 1].value)
      return toHex(
        r0 + (r1 - r0) * progress,
        g0 + (g1 - g0) * progress,
        b0 + (b1 - b0) * progress
      )
    }
  }
  return track[track.length - 1].value
}

// ---------------------------------------------------------------------------
// Grapheme segmentation for stagger
// ---------------------------------------------------------------------------

/**
 * Split text into grapheme clusters using Intl.Segmenter.
 * Falls back to Array.from if Segmenter is unavailable.
 */
function segmentGraphemes(text: string): string[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    return Array.from(segmenter.segment(text), s => s.segment)
  }
  // Fallback: split by code points (less accurate but functional)
  return Array.from(text)
}

// ---------------------------------------------------------------------------
// Layer evaluation
// ---------------------------------------------------------------------------

/** Evaluate a single text layer into its LayerState. */
function evaluateTextLayer(
  layer: TextLayer,
  worldMatrix: Matrix2D,
  worldOpacity: number,
  t: number
): TextLayerState {
  const fill = interpolateColour(layer.fillAnimation, t) ?? layer.fill
  const tracking = interpolateNumber(layer.tracking, t) ?? 0

  // Counter: compute the animated text from counter progress
  let text = layer.text
  if (layer.counter) {
    const progress = interpolateNumber(layer.counter.progress, t) ?? 0
    // We need the param value - but in a resolved template, the counter's
    // param value has been baked in. For now, extract it from the text or
    // rely on the original counter definition.
    // The counter param value comes through resolve - the evaluate function
    // receives a resolved template with counter intact. The param value
    // needs to be looked up from the template's values.
    // We pass the evaluate function the ResolvedTemplate which has `values`.
    // But evaluateTextLayer doesn't have access to it directly.
    // This is handled by the evaluate() function wrapper below.
    text = formatCounter(
      progress,
      (layer as TextLayer & { _counterValue?: number })._counterValue ?? 0,
      layer.counter.decimals,
      layer.counter.prefix,
      layer.counter.suffix
    )
  }

  // Stagger: compute per-character states
  let units: StaggerUnit[] | undefined
  if (layer.stagger) {
    const chars = segmentGraphemes(text)
    units = chars.map((char, idx) => {
      const staggerT = t - idx * layer.stagger!.delay
      const unitOpacity = interpolateNumber(layer.opacity, staggerT) ?? 1
      const unitFill = interpolateColour(layer.fillAnimation, staggerT) ?? layer.fill
      const unitTracking = interpolateNumber(layer.tracking, staggerT) ?? 0

      // Build per-unit matrix (same world transform but with per-unit opacity)
      // For stagger, each unit shares the world matrix of the parent text layer
      // but has its own opacity/fill from the staggered time
      void unitTracking // tracking is per-layer, not per-unit
      return {
        text: char,
        matrix: worldMatrix,
        opacity: unitOpacity * worldOpacity,
        fill: unitFill
      }
    })
  }

  return {
    kind: 'text',
    id: layer.id,
    matrix: worldMatrix,
    opacity: (interpolateNumber(layer.opacity, t) ?? 1) * worldOpacity,
    fill,
    text,
    font: { ...layer.font },
    align: layer.align,
    lineHeight: layer.lineHeight,
    multiline: layer.multiline,
    tracking,
    units
  }
}

/** Evaluate a shape layer (rect, ellipse, path, arc). */
function evaluateShapeLayer(
  layer: RectLayer | EllipseLayer | ArcLayer,
  worldMatrix: Matrix2D,
  worldOpacity: number,
  t: number
): ShapeLayerState {
  const opacity = (interpolateNumber(layer.opacity, t) ?? 1) * worldOpacity
  const fill =
    'fillAnimation' in layer
      ? (interpolateColour(layer.fillAnimation as Keyframe<string>[], t) ?? layer.fill)
      : layer.fill

  const base: ShapeLayerState = {
    kind: layer.kind as 'rect' | 'ellipse' | 'arc',
    id: layer.id,
    matrix: worldMatrix,
    opacity,
    fill
  }

  if (layer.kind === 'rect') {
    const w =
      interpolateNumber((layer as RectLayer).widthAnimation, t) ??
      (layer as RectLayer).width
    const h =
      interpolateNumber((layer as RectLayer).heightAnimation, t) ??
      (layer as RectLayer).height
    base.size = { w, h }
    base.radius = (layer as RectLayer).radius
  }

  if (layer.kind === 'arc') {
    const arc = layer as ArcLayer
    base.arc = {
      innerRadius: arc.innerRadius,
      outerRadius: arc.outerRadius,
      sweep: interpolateNumber(arc.sweep, t) ?? 0,
      startAngle: interpolateNumber(arc.startAngle, t) ?? 0
    }
  }

  return base
}

/** Evaluate a path layer. */
function evaluatePathLayer(
  layer: PrimitiveLayer & { kind: 'path' },
  worldMatrix: Matrix2D,
  worldOpacity: number,
  t: number
): ShapeLayerState {
  const opacity = (interpolateNumber(layer.opacity, t) ?? 1) * worldOpacity
  const fill = interpolateColour(layer.fillAnimation, t) ?? layer.fill

  return {
    kind: 'path',
    id: layer.id,
    matrix: worldMatrix,
    opacity,
    fill,
    d: layer.d
  }
}

/** Evaluate a particles layer. */
function evaluateParticlesLayer(
  layer: ParticlesLayer,
  worldMatrix: Matrix2D,
  worldOpacity: number,
  t: number,
  rt: ResolvedTemplate
): ParticlesLayerState {
  const opacity = (interpolateNumber(layer.opacity, t) ?? 1) * worldOpacity

  const pointStates = computeParticleState({
    points: layer.points,
    seed: layer.seed,
    assembleStart: layer.assembleStart,
    assembleEnd: layer.assembleEnd,
    t,
    duration: rt.duration,
    outStart: rt.outStart,
    baseFill: layer.baseFill,
    regionFills: layer.regionFills,
    pointRadius: layer.pointRadius
  })

  return {
    kind: 'particles',
    id: layer.id,
    matrix: worldMatrix,
    opacity,
    points: pointStates,
    pointRadius: layer.pointRadius
  }
}

// ---------------------------------------------------------------------------
// Recursive tree walk
// ---------------------------------------------------------------------------

/**
 * Walk the layer tree, composing transforms and collecting leaf LayerStates
 * in paint order.
 */
function walkLayers(
  layers: PrimitiveLayer[],
  parentMatrix: Matrix2D,
  parentOpacity: number,
  t: number,
  rt: ResolvedTemplate,
  out: LayerState[]
): void {
  for (const layer of layers) {
    const localMatrix = buildLocalMatrix(layer, t)
    const worldMatrix = multiplyMatrix(parentMatrix, localMatrix)
    const layerOpacity = interpolateNumber(layer.opacity, t) ?? 1
    const worldOpacity = parentOpacity * layerOpacity

    if (layer.kind === 'group') {
      // Recurse into children; group itself produces no output
      walkLayers(
        layer.children as PrimitiveLayer[],
        worldMatrix,
        worldOpacity,
        t,
        rt,
        out
      )
      continue
    }

    // For groups, the worldOpacity already includes the group's opacity.
    // For leaf layers, we need the parent's accumulated opacity only,
    // since evaluateXxx reads the layer's own opacity internally.
    // Actually, re-examining: we compute worldOpacity = parentOpacity * layerOpacity
    // and then each evaluateXxx does (interpolateNumber(layer.opacity, t) ?? 1) * worldOpacity.
    // That would double-count the layer's own opacity.
    //
    // Fix: pass parentOpacity * parentGroupOpacity to leaf evaluators,
    // and let the evaluator multiply by the layer's own opacity.
    //
    // But we already computed worldOpacity including layerOpacity.
    // The evaluators multiply by layerOpacity again.
    // Solution: pass the ancestor opacity (without this layer's opacity) to leaf evaluators.
    const ancestorOpacity = parentOpacity

    switch (layer.kind) {
      case 'text':
        out.push(evaluateTextLayer(layer, worldMatrix, ancestorOpacity, t))
        break
      case 'rect':
      case 'ellipse':
      case 'arc':
        out.push(evaluateShapeLayer(layer, worldMatrix, ancestorOpacity, t))
        break
      case 'path':
        out.push(
          evaluatePathLayer(
            layer as PrimitiveLayer & { kind: 'path' },
            worldMatrix,
            ancestorOpacity,
            t
          )
        )
        break
      case 'particles':
        out.push(evaluateParticlesLayer(layer, worldMatrix, ancestorOpacity, t, rt))
        break
    }
  }
}

// ---------------------------------------------------------------------------
// Counter value injection
// ---------------------------------------------------------------------------

/**
 * Inject counter param values into text layers that have counters.
 * This is needed because the evaluator is pure and doesn't look up param values.
 */
function injectCounterValues(
  layers: PrimitiveLayer[],
  values: Record<string, unknown>
): PrimitiveLayer[] {
  return layers.map(layer => {
    if (layer.kind === 'group') {
      return {
        ...layer,
        children: injectCounterValues(layer.children as PrimitiveLayer[], values)
      }
    }
    if (layer.kind === 'text' && layer.counter) {
      const paramValue = values[layer.counter.param]
      const numValue = typeof paramValue === 'number' ? paramValue : 0
      return {
        ...layer,
        _counterValue: numValue
      } as TextLayer & { _counterValue: number }
    }
    return layer
  }) as PrimitiveLayer[]
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Evaluate a resolved template at time t, returning a flat list of
 * `LayerState` objects in paint order (later entries paint above earlier ones).
 *
 * Pure function: does not mutate the input, does not produce side effects.
 *
 * @param rt - a `ResolvedTemplate` from `resolveTemplate()`
 * @param t - time in seconds
 */
export function evaluate(rt: ResolvedTemplate, t: number): LayerState[] {
  const out: LayerState[] = []

  // Inject counter values so evaluateTextLayer can access them
  const layers = injectCounterValues(rt.layers, rt.values)

  walkLayers(layers, IDENTITY, 1, t, rt, out)
  return out
}
