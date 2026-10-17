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
} from '../../types'
import { evaluate } from '../evaluate'
import { resolveTemplate } from '../resolve'

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
export const TITLE_SAFE = { left: 192, right: 3648, top: 108, bottom: 2052 }

/** 93% action-safe: 3.5% inset on each side. */
export const ACTION_SAFE = { left: 134.4, right: 3705.6, top: 75.6, bottom: 2084.4 }

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

/**
 * Check all layer positions directly from template data.
 * Avoids the matrix anchor/position conflation in LayerState.
 *
 * Text layers: checked at all keyframe times.
 * Shape layers (rect, arc, ellipse): checked at hold-phase times.
 * Arc/ellipse: position +/- outerRadius or max(radiusX, radiusY).
 * Particles: checked separately via the evaluator.
 */
function checkLayerPositionsSafe(
  layers: Layer[],
  inEnd: number,
  outStart: number,
  templateId: string
): TimingViolation[] {
  const violations: TimingViolation[] = []
  walkSafe(layers, { x: 0, y: 0 }, inEnd, outStart, templateId, violations)
  return violations
}

interface Point {
  x: number
  y: number
}

/** Extent of a leaf layer around its anchored origin: [left, top, right, bottom]. */
function layerExtent(layer: Layer): [number, number, number, number] {
  if (layer.kind === 'rect') return [0, 0, layer.width, layer.height]
  if (layer.kind === 'arc') {
    const r = layer.outerRadius
    return [-r, -r, r, r]
  }
  if (layer.kind === 'ellipse')
    return [-layer.radiusX, -layer.radiusY, layer.radiusX, layer.radiusY]
  return [0, 0, 0, 0]
}

/** Static offset a group adds to its children at hold: its position minus its anchor. */
function groupOffset(layer: Layer, inEnd: number, parent: Point): Point {
  const kf = layer.position?.find(k => k.t >= inEnd - 1e-9) ?? layer.position?.at(-1)
  const pos = kf?.value ?? { x: 0, y: 0 }
  return { x: parent.x + pos.x - layer.anchor.x, y: parent.y + pos.y - layer.anchor.y }
}

function isOutsideTitleSafe(box: [number, number, number, number]): boolean {
  const [l, t, r, b] = box
  return (
    l < TITLE_SAFE.left ||
    r > TITLE_SAFE.right ||
    t < TITLE_SAFE.top ||
    b > TITLE_SAFE.bottom
  )
}

/**
 * Position keys to test. Text is checked at every key. Other layers are checked
 * at the hold only: every key inside it, plus the value already in effect when
 * the hold starts (the last key at or before inEnd), which a static or
 * entrance-only track would otherwise never present.
 */
function positionsToCheck(layer: Layer, inEnd: number, outStart: number) {
  const keys = layer.position ?? []
  if (layer.kind === 'text') return keys
  const inHold = keys.filter(k => k.t >= inEnd - 1e-9 && k.t <= outStart + 1e-9)
  const atHoldStart = [...keys].reverse().find(k => k.t <= inEnd + 1e-9) ?? keys[0]
  return atHoldStart && !inHold.includes(atHoldStart) ? [atHoldStart, ...inHold] : inHold
}

function checkLeafSafe(
  layer: Layer,
  origin: Point,
  inEnd: number,
  outStart: number,
  templateId: string,
  violations: TimingViolation[]
): void {
  if (!layer.position) return
  const [ex0, ey0, ex1, ey1] = layerExtent(layer)
  for (const kf of positionsToCheck(layer, inEnd, outStart)) {
    const x = origin.x + kf.value.x - layer.anchor.x
    const y = origin.y + kf.value.y - layer.anchor.y
    if (!isOutsideTitleSafe([x + ex0, y + ey0, x + ex1, y + ey1])) continue
    violations.push({
      templateId,
      rule: 'S3.4',
      message: `layer "${layer.id}" bounds (${(x + ex0).toFixed(0)}, ${(y + ey0).toFixed(0)}) to (${(x + ex1).toFixed(0)}, ${(y + ey1).toFixed(0)}) outside 90% title-safe at t=${kf.t}`
    })
  }
}

function walkSafe(
  layers: Layer[],
  origin: Point,
  inEnd: number,
  outStart: number,
  templateId: string,
  violations: TimingViolation[]
): void {
  for (const layer of layers) {
    if (layer.kind === 'group') {
      walkSafe(
        layer.children,
        groupOffset(layer, inEnd, origin),
        inEnd,
        outStart,
        templateId,
        violations
      )
    } else if (layer.kind !== 'particles' && layer.kind !== 'series') {
      checkLeafSafe(layer, origin, inEnd, outStart, templateId, violations)
    }
  }
}

export function checkTitleSafe(t: MotionTemplate): TimingViolation[] {
  if (t.category === 'transition') return []

  // Check particles via the evaluator (need computed point positions)
  const format: MotionFormat = { width: 3840, height: 2160, fps: 25 }
  const resolved = resolveTemplate(t, {}, format)
  const kfTimes = collectKeyframeTimes(resolved.layers)
  const violations: TimingViolation[] = []

  for (const time of kfTimes) {
    const states = evaluate(resolved, time)
    const isHold = time >= resolved.inEnd && time <= resolved.outStart
    if (!isHold) continue

    for (const state of states) {
      if (state.kind !== 'particles') continue
      const v = checkParticlesActionSafe(state, t.id, time)
      if (v) return [v]
    }
  }

  // Check all other layers from template position data
  violations.push(...checkLayerPositionsSafe(t.layers, t.inEnd, t.outStart, t.id))

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
