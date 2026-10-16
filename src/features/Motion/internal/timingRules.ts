/**
 * Starter timing rules (issue #332)
 *
 * Enforced by a unit test over every built-in template. A template that
 * breaks any rule cannot merge. Each rule returns an array of violations;
 * an empty array means the rule passes.
 *
 * Rules from D5:
 *   - in-duration 0.5-1 s
 *   - out/in ratio 0.5-0.8
 *   - stagger total <= 40% of entrance
 *   - non-text bounds inside 90% title-safe area
 *   - text box fits maxLength x fontSize x 0.6
 *   - entrances ease out, exits ease in
 */
import type {
  Ease,
  Keyframe,
  Layer,
  LayerState,
  MotionFormat,
  MotionTemplate,
  PrimitiveLayer,
  TextLayer
} from '../types'
import { evaluate } from './evaluate'
import { resolveTemplate } from './resolve'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TimingViolation {
  templateId: string
  rule: string
  message: string
}

// ---------------------------------------------------------------------------
// Safe areas (in 3840x2160 template space)
// ---------------------------------------------------------------------------

/** 90% title-safe: 5% inset on each side. */
const TITLE_SAFE = { left: 192, right: 3648, top: 108, bottom: 2052 }

/** 93% action-safe: 3.5% inset on each side. */
const ACTION_SAFE = { left: 134.4, right: 3705.6, top: 75.6, bottom: 2084.4 }

// ---------------------------------------------------------------------------
// Rule S3.1: in-duration 0.5-1 s
// ---------------------------------------------------------------------------

export function checkInDuration(t: MotionTemplate): TimingViolation[] {
  const inDur = t.inEnd
  if (inDur < 0.5 || inDur > 1) {
    return [
      {
        templateId: t.id,
        rule: 'S3.1',
        message: `in-duration ${inDur}s not in [0.5, 1]`
      }
    ]
  }
  return []
}

// ---------------------------------------------------------------------------
// Rule S3.2: out/in ratio 0.5-0.8
// ---------------------------------------------------------------------------

export function checkOutInRatio(t: MotionTemplate): TimingViolation[] {
  const inDur = t.inEnd
  const outDur = t.duration - t.outStart
  if (inDur <= 0) return []
  const ratio = outDur / inDur
  if (ratio < 0.5 || ratio > 0.8) {
    return [
      {
        templateId: t.id,
        rule: 'S3.2',
        message: `out/in ratio ${ratio.toFixed(3)} not in [0.5, 0.8]`
      }
    ]
  }
  return []
}

// ---------------------------------------------------------------------------
// Rule S3.3: stagger total <= 40% of entrance
// ---------------------------------------------------------------------------

/** Return the default text length for stagger budget measurement. */
function findDefaultTextLength(
  layer: TextLayer,
  params: MotionTemplate['params']
): number {
  if (layer.param && params[layer.param]?.kind === 'text') {
    return (params[layer.param] as { default: string }).default.length
  }
  return layer.text.length
}

function collectStaggeredTextLayers(layers: Layer[]): TextLayer[] {
  const result: TextLayer[] = []
  for (const l of layers) {
    if (l.kind === 'text' && l.stagger && l.stagger.delay > 0) {
      result.push(l)
    }
    if (l.kind === 'group') {
      result.push(...collectStaggeredTextLayers(l.children))
    }
  }
  return result
}

export function checkStaggerBudget(t: MotionTemplate): TimingViolation[] {
  const inDur = t.inEnd
  if (inDur <= 0) return []
  const budget = inDur * 0.4
  const violations: TimingViolation[] = []

  for (const layer of collectStaggeredTextLayers(t.layers)) {
    const maxLen = findDefaultTextLength(layer, t.params)
    const total = layer.stagger!.delay * (maxLen - 1)
    if (total > budget + 1e-9) {
      violations.push({
        templateId: t.id,
        rule: 'S3.3',
        message: `layer "${layer.id}": stagger total ${total.toFixed(3)}s > 40% of in-duration (${budget.toFixed(3)}s)`
      })
    }
  }
  return violations
}

// ---------------------------------------------------------------------------
// Rule S3.4: title-safe and action-safe bounds
// ---------------------------------------------------------------------------

/** Collect all keyframe times from all layers. */
function collectKeyframeTimes(layers: PrimitiveLayer[]): number[] {
  const times = new Set<number>()
  function addTrack<V>(track: Keyframe<V>[] | undefined) {
    if (!track) return
    for (const kf of track) times.add(kf.t)
  }
  function walk(ls: PrimitiveLayer[]) {
    for (const l of ls) {
      addTrack(l.position)
      addTrack(l.scale)
      addTrack(l.rotation)
      addTrack(l.opacity)
      if (l.kind === 'text') {
        addTrack(l.fillAnimation)
        addTrack(l.tracking)
        if (l.counter) addTrack(l.counter.progress)
      }
      if (l.kind === 'rect') {
        addTrack(l.widthAnimation)
        addTrack(l.heightAnimation)
        addTrack(l.fillAnimation)
      }
      if (l.kind === 'arc') {
        addTrack(l.sweep)
        addTrack(l.startAngle)
        addTrack(l.fillAnimation)
      }
      if (l.kind === 'ellipse' || l.kind === 'path') {
        addTrack((l as { fillAnimation?: Keyframe<string>[] }).fillAnimation)
      }
      if (l.kind === 'group') {
        walk(l.children as PrimitiveLayer[])
      }
    }
  }
  walk(layers)
  return [...times].sort((a, b) => a - b)
}

/** Compute the bounding box of a layer state, using its matrix and size. */
function layerBounds(
  state: LayerState
): { left: number; right: number; top: number; bottom: number } | null {
  const m = state.matrix
  const tx = m[4]
  const ty = m[5]

  if (state.kind === 'text') {
    // Text layers are checked at their anchor position
    return { left: tx, right: tx, top: ty, bottom: ty }
  }

  if (state.kind === 'rect' && state.size) {
    // Transform the four corners through the matrix
    const w = state.size.w
    const h = state.size.h
    const corners = [
      [0, 0],
      [w, 0],
      [w, h],
      [0, h]
    ]
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (const [cx, cy] of corners) {
      const px = m[0] * cx + m[2] * cy + m[4]
      const py = m[1] * cx + m[3] * cy + m[5]
      minX = Math.min(minX, px)
      maxX = Math.max(maxX, px)
      minY = Math.min(minY, py)
      maxY = Math.max(maxY, py)
    }
    return { left: minX, right: maxX, top: minY, bottom: maxY }
  }

  if (state.kind === 'arc' || state.kind === 'ellipse') {
    // Arc/ellipse bounds depend on their anchor-relative drawing.
    // Checked separately via checkArcEllipseSafe on the original template.
    return null
  }

  return null
}

/** Check a single particles state for action-safe at hold. */
function checkParticlesActionSafe(
  state: LayerState & { kind: 'particles' },
  templateId: string,
  time: number
): TimingViolation | null {
  for (const pt of state.points) {
    if (
      pt.x < ACTION_SAFE.left ||
      pt.x > ACTION_SAFE.right ||
      pt.y < ACTION_SAFE.top ||
      pt.y > ACTION_SAFE.bottom
    ) {
      return {
        templateId,
        rule: 'S3.4',
        message: `particles layer "${state.id}" point (${pt.x}, ${pt.y}) outside 93% action-safe at t=${time}`
      }
    }
  }
  return null
}

/** Check a non-particles state against 90% title-safe. */
function checkLayerTitleSafe(
  state: LayerState,
  templateId: string,
  time: number
): TimingViolation | null {
  const bounds = layerBounds(state)
  if (!bounds) return null
  if (
    bounds.left < TITLE_SAFE.left ||
    bounds.right > TITLE_SAFE.right ||
    bounds.top < TITLE_SAFE.top ||
    bounds.bottom > TITLE_SAFE.bottom
  ) {
    return {
      templateId,
      rule: 'S3.4',
      message: `layer "${state.id}" bounds [${bounds.left.toFixed(0)}, ${bounds.top.toFixed(0)}, ${bounds.right.toFixed(0)}, ${bounds.bottom.toFixed(0)}] outside 90% title-safe at t=${time}`
    }
  }
  return null
}

/**
 * Check arc and ellipse layers directly from template data.
 * Their position keyframe values give the visual centre; we check
 * that centre +/- radius stays in the safe area at hold times.
 */
function checkArcEllipseSafe(
  layers: Layer[],
  inEnd: number,
  outStart: number,
  templateId: string
): TimingViolation[] {
  const violations: TimingViolation[] = []
  for (const layer of layers) {
    if (layer.kind === 'group') {
      violations.push(...checkArcEllipseSafe(layer.children, inEnd, outStart, templateId))
      continue
    }
    if (layer.kind !== 'arc' && layer.kind !== 'ellipse') continue

    const radius =
      layer.kind === 'arc' ? layer.outerRadius : Math.max(layer.radiusX, layer.radiusY)

    // Check at hold-phase position keyframe times
    if (!layer.position) continue
    for (const kf of layer.position) {
      if (kf.t < inEnd - 1e-9 || kf.t > outStart + 1e-9) continue
      const cx = kf.value.x
      const cy = kf.value.y
      if (
        cx - radius < TITLE_SAFE.left ||
        cx + radius > TITLE_SAFE.right ||
        cy - radius < TITLE_SAFE.top ||
        cy + radius > TITLE_SAFE.bottom
      ) {
        violations.push({
          templateId,
          rule: 'S3.4',
          message: `layer "${layer.id}" arc/ellipse bounds outside 90% title-safe at t=${kf.t}`
        })
      }
    }
  }
  return violations
}

export function checkTitleSafe(t: MotionTemplate): TimingViolation[] {
  if (t.category === 'transition') return []

  const format: MotionFormat = { width: 3840, height: 2160, fps: 25 }
  const resolved = resolveTemplate(t, {}, format)
  const kfTimes = collectKeyframeTimes(resolved.layers)
  const violations: TimingViolation[] = []

  for (const time of kfTimes) {
    const states = evaluate(resolved, time)
    const isHold = time >= resolved.inEnd && time <= resolved.outStart

    for (const state of states) {
      if (state.kind === 'particles') {
        if (!isHold) continue
        const v = checkParticlesActionSafe(state, t.id, time)
        if (v) return [v]
        continue
      }
      if (state.kind !== 'text' && !isHold) continue
      const v = checkLayerTitleSafe(state, t.id, time)
      if (v) violations.push(v)
    }
  }

  // Check arc/ellipse layers from template data (not LayerState)
  violations.push(...checkArcEllipseSafe(t.layers, t.inEnd, t.outStart, t.id))

  return violations
}

// ---------------------------------------------------------------------------
// Rule S3.5: text box width check
// ---------------------------------------------------------------------------

function collectTextLayers(layers: Layer[]): TextLayer[] {
  const result: TextLayer[] = []
  for (const l of layers) {
    if (l.kind === 'text') result.push(l)
    if (l.kind === 'group') result.push(...collectTextLayers(l.children))
  }
  return result
}

export function checkTextBoxWidth(t: MotionTemplate): TimingViolation[] {
  const violations: TimingViolation[] = []
  for (const layer of collectTextLayers(t.layers)) {
    if (!layer.param) continue
    const paramDef = t.params[layer.param]
    if (!paramDef || paramDef.kind !== 'text') continue
    const maxLen = paramDef.maxLength
    const minWidth = maxLen * layer.font.size * 0.6
    const layerWidth = layer.width ?? Infinity
    if (layerWidth < minWidth) {
      violations.push({
        templateId: t.id,
        rule: 'S3.5',
        message: `layer "${layer.id}": width ${layerWidth} < maxLength(${maxLen}) x fontSize(${layer.font.size}) x 0.6 = ${minWidth}`
      })
    }
  }
  return violations
}

// ---------------------------------------------------------------------------
// Rule S3.6: ease direction enforcement
// ---------------------------------------------------------------------------

/** Check ease direction for entrance and exit segments. */
function checkLayerEaseDirection(
  layer: Layer,
  inEnd: number,
  outStart: number,
  templateId: string
): TimingViolation[] {
  const violations: TimingViolation[] = []

  function checkTrack<V>(track: Keyframe<V>[] | undefined, trackName: string) {
    if (!track || track.length < 2) return
    for (let i = 0; i < track.length - 1; i++) {
      const kf = track[i]
      const next = track[i + 1]
      const ease = kf.ease
      if (!ease) continue

      const [x1, y1] = ease as Ease

      // Segment ending at or before inEnd: must ease out (y1 >= x1)
      if (next.t <= inEnd + 1e-9) {
        if (y1 < x1 - 1e-9) {
          violations.push({
            templateId,
            rule: 'S3.6',
            message: `layer "${layer.id}" ${trackName}[${i}]: entrance ease y1(${y1}) < x1(${x1}) - must ease out`
          })
        }
      }

      // Segment starting at or after outStart: must ease in (y1 <= x1)
      if (kf.t >= outStart - 1e-9) {
        if (y1 > x1 + 1e-9) {
          violations.push({
            templateId,
            rule: 'S3.6',
            message: `layer "${layer.id}" ${trackName}[${i}]: exit ease y1(${y1}) > x1(${x1}) - must ease in`
          })
        }
      }
    }
  }

  checkTrack(layer.position, 'position')
  checkTrack(layer.scale, 'scale')
  checkTrack(layer.rotation, 'rotation')
  checkTrack(layer.opacity, 'opacity')

  if (layer.kind === 'text') {
    checkTrack(layer.fillAnimation, 'fillAnimation')
    checkTrack(layer.tracking, 'tracking')
    if (layer.counter) checkTrack(layer.counter.progress, 'counter.progress')
  }
  if (layer.kind === 'rect') {
    checkTrack(layer.fillAnimation, 'fillAnimation')
    checkTrack(layer.widthAnimation, 'widthAnimation')
    checkTrack(layer.heightAnimation, 'heightAnimation')
  }
  if (layer.kind === 'ellipse' || layer.kind === 'path') {
    checkTrack(
      (layer as { fillAnimation?: Keyframe<string>[] }).fillAnimation,
      'fillAnimation'
    )
  }
  if (layer.kind === 'arc') {
    checkTrack(layer.sweep, 'sweep')
    checkTrack(layer.startAngle, 'startAngle')
    checkTrack(layer.fillAnimation, 'fillAnimation')
  }

  if (layer.kind === 'group') {
    for (const child of layer.children) {
      violations.push(...checkLayerEaseDirection(child, inEnd, outStart, templateId))
    }
  }

  return violations
}

export function checkEaseDirection(t: MotionTemplate): TimingViolation[] {
  const violations: TimingViolation[] = []
  for (const layer of t.layers) {
    violations.push(...checkLayerEaseDirection(layer, t.inEnd, t.outStart, t.id))
  }
  return violations
}

// ---------------------------------------------------------------------------
// Rule S3.7: entrance quality - at least one position/scale animation
// ---------------------------------------------------------------------------

/** Check whether a layer has a position track whose value changes during entrance. */
function hasEntrancePositionChange(layer: Layer, inEnd: number): boolean {
  if (layer.position && layer.position.length >= 2) {
    const entranceKeys = layer.position.filter(k => k.t <= inEnd + 1e-9)
    if (entranceKeys.length >= 2) {
      const first = entranceKeys[0].value
      const last = entranceKeys[entranceKeys.length - 1].value
      if (Math.abs(first.x - last.x) > 1 || Math.abs(first.y - last.y) > 1) {
        return true
      }
    }
  }
  if (layer.kind === 'group') {
    for (const child of layer.children) {
      if (hasEntrancePositionChange(child, inEnd)) return true
    }
  }
  return false
}

/** Check whether a layer has a scale track whose value changes during entrance. */
function hasEntranceScaleChange(layer: Layer, inEnd: number): boolean {
  if (layer.scale && layer.scale.length >= 2) {
    const entranceKeys = layer.scale.filter(k => k.t <= inEnd + 1e-9)
    if (entranceKeys.length >= 2) {
      const first = entranceKeys[0].value
      const last = entranceKeys[entranceKeys.length - 1].value
      if (Math.abs(first.x - last.x) > 0.01 || Math.abs(first.y - last.y) > 0.01) {
        return true
      }
    }
  }
  if (layer.kind === 'group') {
    for (const child of layer.children) {
      if (hasEntranceScaleChange(child, inEnd)) return true
    }
  }
  return false
}

export function checkEntranceQuality(t: MotionTemplate): TimingViolation[] {
  if (t.category === 'transition') return []

  for (const layer of t.layers) {
    if (hasEntrancePositionChange(layer, t.inEnd)) return []
    if (hasEntranceScaleChange(layer, t.inEnd)) return []
  }

  return [
    {
      templateId: t.id,
      rule: 'S3.7',
      message: 'no position or scale animation changes during entrance'
    }
  ]
}

// ---------------------------------------------------------------------------
// Run all rules
// ---------------------------------------------------------------------------

/**
 * Run all timing rules against a template and return all violations.
 * An empty array means the template passes every rule.
 */
export function checkAllRules(t: MotionTemplate): TimingViolation[] {
  return [
    ...checkInDuration(t),
    ...checkOutInRatio(t),
    ...checkStaggerBudget(t),
    ...checkTitleSafe(t),
    ...checkTextBoxWidth(t),
    ...checkEaseDirection(t),
    ...checkEntranceQuality(t)
  ]
}
