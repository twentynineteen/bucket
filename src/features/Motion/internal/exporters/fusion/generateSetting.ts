/**
 * DaVinci Resolve Fusion .setting exporter (issue #330)
 *
 * Generates a Fusion title macro (Lua table text) from a resolved template.
 * Values are baked in; text and colour params are exposed as InstanceInputs
 * so they stay editable in the Inspector.
 *
 * Tool chain per layer (in paint order):
 *   shape tools (sRectangle, sEllipse, sPolygon) -> sMerge -> sRender
 *   -> Merge with Text+ tools (and Background tools for hatch-band fallback layers).
 * Groups get their own sub-chain: children merged, then group Transform,
 * then group opacity Blend. The result is one output in the parent chain.
 *
 * Stagger delays arrive from resolveTemplate already quantised to whole frames.
 * A delay of 0 (budget exhausted) emits no Follower.
 *
 * StyledTextFollower type ID: UNVERIFIED. Flagged for manual verification in #339.
 *
 * Works in Resolve Free and Studio. No scripting API.
 */

import type {
  ArcLayer,
  EllipseLayer,
  ExportInput,
  ExportResult,
  GroupLayer,
  Keyframe,
  MotionFormat,
  MotionTemplate,
  ParamDef,
  PathLayer,
  PrimitiveLayer,
  RectLayer,
  TextLayer
} from '../../../types'
import { resolveBindPath } from '../../bindPath'
import { parseHexColour } from '../../colour'
import { hasParticles } from '../../layers'
import { toFusionKeyframes, type FusionKeyframe } from './bezierSpline'
import {
  toFusionRotation,
  toFusionSize,
  toImageCoords,
  toShapeCoords
} from './fusionCoords'
import { escapeLuaString } from './luaString'

// ---------------------------------------------------------------------------
// Exhaustiveness check
// ---------------------------------------------------------------------------

/** Exhaustiveness check: the compiler proves this is never called. */
function assertNever(x: never): never {
  throw new Error(`Unexpected layer kind: ${(x as { kind: string }).kind}`)
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/** Represents a named tool in the Fusion macro. */
interface FusionTool {
  name: string
  type: string
  entries: LuaEntry[]
}

type LuaValue = string | number | boolean | LuaEntry[] | { call: string; arg: LuaEntry[] }

interface LuaEntry {
  key: string | number | null
  value: LuaValue
}

// ---------------------------------------------------------------------------
// Lua serialisation
// ---------------------------------------------------------------------------

/**
 * Sanitise a name for use as a Lua identifier.
 * Hyphens and other non-alphanumeric characters become underscores.
 * Ensures the identifier doesn't start with a digit.
 */
function luaIdent(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9_]/g, '_')
  return /^\d/.test(cleaned) ? '_' + cleaned : cleaned
}

/** Build a sanitised tool name from a layer ID and suffix. */
function toolName(layerId: string, suffix: string): string {
  return luaIdent(`${layerId}_${suffix}`)
}

function indent(depth: number): string {
  return '    '.repeat(depth)
}

function serialiseLuaValue(value: LuaValue, depth: number): string {
  if (typeof value === 'string') return `"${escapeLuaString(value)}"`
  if (typeof value === 'number') return formatNumber(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (Array.isArray(value)) return serialiseTable(value, depth)
  // Call expression: Type { ... }
  return `${value.call} ${serialiseTable(value.arg, depth)}`
}

function formatNumber(n: number): string {
  // Use fixed notation when the number is a clean integer or short decimal
  if (Number.isInteger(n)) return String(n)
  // Cap at 10 decimal places to avoid floating-point noise
  const s = n.toFixed(10).replace(/0+$/, '').replace(/\.$/, '')
  return s
}

function serialiseTable(entries: LuaEntry[], depth: number): string {
  if (entries.length === 0) return '{ }'
  const lines: string[] = ['{']
  for (const entry of entries) {
    const val = serialiseLuaValue(entry.value, depth + 1)
    if (entry.key === null) {
      lines.push(`${indent(depth + 1)}${val},`)
    } else if (typeof entry.key === 'number') {
      lines.push(`${indent(depth + 1)}[${entry.key}] = ${val},`)
    } else {
      lines.push(`${indent(depth + 1)}${entry.key} = ${val},`)
    }
  }
  lines.push(`${indent(depth)}}`)
  return lines.join('\n')
}

function toolToEntry(tool: FusionTool): LuaEntry {
  return {
    key: luaIdent(tool.name),
    value: { call: tool.type, arg: tool.entries }
  }
}

// ---------------------------------------------------------------------------
// Spline generation
// ---------------------------------------------------------------------------

let splineCounter = 0
let shapeBatchCounter = 0

function resetCounters(): void {
  splineCounter = 0
  shapeBatchCounter = 0
}

function nextSplineName(baseName: string, property: string): string {
  splineCounter++
  return luaIdent(`${baseName}_${property}_${splineCounter}`)
}

/** Build a BezierSpline tool from fusion keyframes. */
function buildSplineTool(name: string, fusionKfs: FusionKeyframe[]): FusionTool {
  const keyframeEntries: LuaEntry[] = fusionKfs.map(kf => {
    const inner: LuaEntry[] = [{ key: null, value: kf.value }]
    if (kf.rh) {
      inner.push({
        key: 'RH',
        value: [
          { key: null, value: kf.rh.time },
          { key: null, value: kf.rh.value }
        ]
      })
    }
    if (kf.lh) {
      inner.push({
        key: 'LH',
        value: [
          { key: null, value: kf.lh.time },
          { key: null, value: kf.lh.value }
        ]
      })
    }
    return { key: kf.frame, value: inner }
  })

  return {
    name,
    type: 'BezierSpline',
    entries: [
      {
        key: 'SplineColor',
        value: [
          { key: 'Red', value: 0 },
          { key: 'Green', value: 0 },
          { key: 'Blue', value: 0 }
        ]
      },
      { key: 'KeyFrames', value: keyframeEntries }
    ]
  }
}

/**
 * Create a BezierSpline for an animated number track.
 * Returns the spline tool and a source-op input entry.
 */
function animatedNumberInput(
  baseName: string,
  property: string,
  keyframes: Keyframe<number>[],
  fps: number,
  tools: FusionTool[]
): LuaEntry {
  const splineName = nextSplineName(baseName, property)
  const fusionKfs = toFusionKeyframes(keyframes, fps)
  tools.push(buildSplineTool(splineName, fusionKfs))
  return {
    key: property,
    value: {
      call: 'Input',
      arg: [
        { key: 'SourceOp', value: splineName },
        { key: 'Source', value: 'Value' }
      ]
    }
  }
}

/** Create a static Input { Value = n } entry. */
function staticInput(key: string, value: number | string): LuaEntry {
  return {
    key,
    value: { call: 'Input', arg: [{ key: 'Value', value }] }
  }
}

// ---------------------------------------------------------------------------
// Animated base-property helpers (position, scale, rotation, opacity)
// ---------------------------------------------------------------------------

/**
 * Add animated position for a shape tool (XOffset / YOffset in shape coords).
 * Replaces any static XOffset/YOffset already in `inputs`.
 *
 * centreOffset converts position keyframes (anchor-aligned) to shape-centre
 * coordinates: centre = position + offset. Omit when the layer's position
 * already represents its centre (e.g. arc).
 */
function addShapePositionAnimation(
  inputs: LuaEntry[],
  layer: PrimitiveLayer,
  format: { w: number; h: number; fps: number },
  tools: FusionTool[],
  centreOffset = { x: 0, y: 0 }
): void {
  if (!layer.position || layer.position.length < 2) return
  const { w, h, fps } = format
  const xKfs = layer.position.map(kf => ({
    t: kf.t,
    value: toShapeCoords(kf.value.x + centreOffset.x, kf.value.y + centreOffset.y, w, h)
      .x,
    ease: kf.ease
  }))
  const yKfs = layer.position.map(kf => ({
    t: kf.t,
    value: toShapeCoords(kf.value.x + centreOffset.x, kf.value.y + centreOffset.y, w, h)
      .y,
    ease: kf.ease
  }))
  // Remove static offsets and replace with animated
  const keep = inputs.filter(e => e.key !== 'XOffset' && e.key !== 'YOffset')
  inputs.length = 0
  inputs.push(...keep)
  inputs.push(animatedNumberInput(layer.id, 'XOffset', xKfs, fps, tools))
  inputs.push(animatedNumberInput(layer.id, 'YOffset', yKfs, fps, tools))
}

/**
 * Build an image Transform for a shape's scale and/or rotation.
 *
 * The evaluator applies scale and rotation about the layer's anchor:
 *   world = position + R * S * (local - anchor)
 *
 * The Fusion Transform's Pivot is set to the anchor's world position
 * (= position) in image coords, so the scaling/rotation pivot matches
 * the evaluator's convention.
 *
 * Returns null when the layer has no scale or rotation.
 */
/** Create a Pivot input entry from a point in image coords. */
function pivotInput(pivot: { x: number; y: number }): LuaEntry {
  return {
    key: 'Pivot',
    value: {
      call: 'Input',
      arg: [
        {
          key: 'Value',
          value: [
            { key: null, value: pivot.x },
            { key: null, value: pivot.y }
          ]
        }
      ]
    }
  }
}

/** Add scale input(s) to a Transform's input list. */
function addTransformScale(
  inputs: LuaEntry[],
  layer: PrimitiveLayer,
  xfName: string,
  fps: number,
  tools: FusionTool[]
): void {
  if (!layer.scale) return
  if (layer.scale.length > 1) {
    const kfs = layer.scale.map(kf => ({ t: kf.t, value: kf.value.x, ease: kf.ease }))
    inputs.push(animatedNumberInput(xfName, 'Size', kfs, fps, tools))
  } else {
    inputs.push(staticInput('Size', layer.scale[0].value.x))
  }
}

/** Add rotation input(s) to a Transform's input list. */
function addTransformRotation(
  inputs: LuaEntry[],
  layer: PrimitiveLayer,
  xfName: string,
  fps: number,
  tools: FusionTool[]
): void {
  if (!layer.rotation) return
  if (layer.rotation.length > 1) {
    const kfs = layer.rotation.map(kf => ({
      t: kf.t,
      value: toFusionRotation(kf.value),
      ease: kf.ease
    }))
    inputs.push(animatedNumberInput(xfName, 'Angle', kfs, fps, tools))
  } else {
    inputs.push(staticInput('Angle', toFusionRotation(layer.rotation[0].value)))
  }
}

function buildShapeTransform(
  layer: PrimitiveLayer,
  format: { w: number; h: number; fps: number },
  tools: FusionTool[]
): FusionTool | null {
  const hasScale = layer.scale && (layer.scale.length > 1 || layer.scale[0].value.x !== 1)
  const hasRotation =
    layer.rotation && (layer.rotation.length > 1 || layer.rotation[0].value !== 0)
  if (!hasScale && !hasRotation) return null

  const name = toolName(layer.id, 'xf')
  const { w, h, fps } = format

  const xfInputs: LuaEntry[] = []

  // Pivot follows the animated position (the anchor's world position).
  // Evaluator: world_anchor = position (when anchor maps to the pivot).
  if (layer.position && layer.position.length > 1) {
    // Animated pivot via XYPath
    const xKfs = layer.position.map(kf => ({
      t: kf.t,
      value: toImageCoords(kf.value.x, kf.value.y, w, h).x,
      ease: kf.ease
    }))
    const yKfs = layer.position.map(kf => ({
      t: kf.t,
      value: toImageCoords(kf.value.x, kf.value.y, w, h).y,
      ease: kf.ease
    }))
    const pivotXYName = luaIdent(`${name}_pivot`)
    const { xyPathTool, sourceEntry } = buildXYPath(pivotXYName, xKfs, yKfs, fps, tools)
    tools.push(xyPathTool)
    // Rewrite sourceEntry key from 'Center' to 'Pivot'
    xfInputs.push({ ...sourceEntry, key: 'Pivot' })
  } else {
    const posX = layer.position?.[0]?.value.x ?? layer.anchor.x
    const posY = layer.position?.[0]?.value.y ?? layer.anchor.y
    const pivot = toImageCoords(posX, posY, w, h)
    xfInputs.push(pivotInput(pivot))
  }

  addTransformScale(xfInputs, layer, name, fps, tools)
  addTransformRotation(xfInputs, layer, name, fps, tools)

  return {
    name,
    type: 'Transform',
    entries: [{ key: 'Inputs', value: xfInputs }]
  }
}

/**
 * Add animated or static opacity for a shape tool.
 */
function addShapeOpacity(
  inputs: LuaEntry[],
  layer: PrimitiveLayer,
  shapeName: string,
  fps: number,
  tools: FusionTool[]
): void {
  if (layer.opacity && layer.opacity.length > 1) {
    inputs.push(animatedNumberInput(shapeName, 'Opacity', layer.opacity, fps, tools))
  } else if (layer.opacity && layer.opacity.length === 1) {
    inputs.push(staticInput('Opacity', layer.opacity[0].value))
  }
}

/**
 * Build an XYPath modifier for an animated point input.
 *
 * Fusion animates point inputs (Text+ Center, Transform Center) through
 * an XYPath modifier: the point input sources from the XYPath's Value
 * output, and the XYPath's X and Y each source from a BezierSpline.
 *
 * Source: Resolve 18.6 manual (XY Path modifier, steakunderwater.com);
 * forum.blackmagicdesign.com viewtopic.php?f=22&t=67065 (wiring pattern);
 * viewtopic.php?f=22&t=223637 (AddModifier for XYPath);
 * viewtopic.php?f=22&t=75019 (BezierSpline vs XYPath on Center).
 */
function buildXYPath(
  baseName: string,
  xKfs: Keyframe<number>[],
  yKfs: Keyframe<number>[],
  fps: number,
  tools: FusionTool[]
): { xyPathTool: FusionTool; sourceEntry: LuaEntry } {
  const xyPathName = luaIdent(`${baseName}_xypath`)

  // X spline
  const xSplineName = nextSplineName(xyPathName, 'X')
  const xFusionKfs = toFusionKeyframes(xKfs, fps)
  tools.push(buildSplineTool(xSplineName, xFusionKfs))

  // Y spline
  const ySplineName = nextSplineName(xyPathName, 'Y')
  const yFusionKfs = toFusionKeyframes(yKfs, fps)
  tools.push(buildSplineTool(ySplineName, yFusionKfs))

  // XYPath tool
  const xyPathTool: FusionTool = {
    name: xyPathName,
    type: 'XYPath',
    entries: [
      {
        key: 'X',
        value: {
          call: 'Input',
          arg: [
            { key: 'SourceOp', value: xSplineName },
            { key: 'Source', value: 'Value' }
          ]
        }
      },
      {
        key: 'Y',
        value: {
          call: 'Input',
          arg: [
            { key: 'SourceOp', value: ySplineName },
            { key: 'Source', value: 'Value' }
          ]
        }
      }
    ]
  }

  // Source entry for the parent input (e.g. Center)
  const sourceEntry: LuaEntry = {
    key: 'Center',
    value: {
      call: 'Input',
      arg: [
        { key: 'SourceOp', value: xyPathName },
        { key: 'Source', value: 'Value' }
      ]
    }
  }

  return { xyPathTool, sourceEntry }
}

/**
 * Add animated position for a Text+ tool (Center in image coords).
 * Uses an XYPath modifier with separate X/Y BezierSplines.
 */
function addTextPositionAnimation(
  inputs: LuaEntry[],
  layer: TextLayer,
  w: number,
  h: number,
  fps: number,
  tools: FusionTool[]
): void {
  if (!layer.position || layer.position.length < 2) return
  const xKfs = layer.position.map(kf => ({
    t: kf.t,
    value: toImageCoords(kf.value.x, kf.value.y, w, h).x,
    ease: kf.ease
  }))
  const yKfs = layer.position.map(kf => ({
    t: kf.t,
    value: toImageCoords(kf.value.x, kf.value.y, w, h).y,
    ease: kf.ease
  }))

  const { xyPathTool, sourceEntry } = buildXYPath(
    toolName(layer.id, 'text_center'),
    xKfs,
    yKfs,
    fps,
    tools
  )
  tools.push(xyPathTool)

  // Replace static Center with XYPath-driven Center
  const keep = inputs.filter(e => e.key !== 'Center')
  inputs.length = 0
  inputs.push(...keep)
  inputs.push(sourceEntry)
}

/**
 * Add animated scale for a Text+ tool (Size input).
 */
function addTextScaleAnimation(
  inputs: LuaEntry[],
  layer: TextLayer,
  fps: number,
  tools: FusionTool[]
): void {
  if (!layer.scale || layer.scale.length < 2) return
  const sizeKfs = layer.scale.map(kf => ({
    t: kf.t,
    value: kf.value.x,
    ease: kf.ease
  }))
  inputs.push(
    animatedNumberInput(toolName(layer.id, 'text'), 'Size', sizeKfs, fps, tools)
  )
}

/**
 * Add animated rotation for a Text+ tool (Angle input, negated).
 */
function addTextRotationAnimation(
  inputs: LuaEntry[],
  layer: TextLayer,
  fps: number,
  tools: FusionTool[]
): void {
  if (!layer.rotation || layer.rotation.length < 2) return
  const rotKfs = layer.rotation.map(kf => ({
    t: kf.t,
    value: toFusionRotation(kf.value),
    ease: kf.ease
  }))
  inputs.push(
    animatedNumberInput(toolName(layer.id, 'text'), 'Angle', rotKfs, fps, tools)
  )
}

/**
 * Add animated properties for a group's image Transform.
 *
 * Center is the image-centre translation: (0.5 + dx/w, 0.5 - dy/h)
 * where dx = pos.x - anchor.x, dy = pos.y - anchor.y.
 * Pivot sits at the anchor's world position for scale/rotation.
 */
function addGroupTransformAnimations(
  inputs: LuaEntry[],
  group: GroupLayer,
  format: { w: number; h: number; fps: number },
  tools: FusionTool[],
  transformName: string
): void {
  const { w, h, fps } = format
  const anchor = group.anchor

  // Animated position -> Center via XYPath
  if (group.position && group.position.length > 1) {
    const xKfs = group.position.map(kf => ({
      t: kf.t,
      value: 0.5 + (kf.value.x - anchor.x) / w,
      ease: kf.ease
    }))
    const yKfs = group.position.map(kf => ({
      t: kf.t,
      value: 0.5 - (kf.value.y - anchor.y) / h,
      ease: kf.ease
    }))
    const { xyPathTool, sourceEntry } = buildXYPath(
      luaIdent(`${transformName}_center`),
      xKfs,
      yKfs,
      fps,
      tools
    )
    tools.push(xyPathTool)
    const keep = inputs.filter(e => e.key !== 'Center')
    inputs.length = 0
    inputs.push(...keep)
    inputs.push(sourceEntry)

    // Animated Pivot follows the anchor's world position
    const pivXKfs = group.position.map(kf => ({
      t: kf.t,
      value: toImageCoords(kf.value.x, kf.value.y, w, h).x,
      ease: kf.ease
    }))
    const pivYKfs = group.position.map(kf => ({
      t: kf.t,
      value: toImageCoords(kf.value.x, kf.value.y, w, h).y,
      ease: kf.ease
    }))
    const pivotXYName = luaIdent(`${transformName}_pivot`)
    const { xyPathTool: pivotXY, sourceEntry: pivotSource } = buildXYPath(
      pivotXYName,
      pivXKfs,
      pivYKfs,
      fps,
      tools
    )
    tools.push(pivotXY)
    inputs.push({ ...pivotSource, key: 'Pivot' })
  }

  // Animated scale -> Size
  if (group.scale && group.scale.length > 1) {
    const sizeKfs = group.scale.map(kf => ({
      t: kf.t,
      value: kf.value.x,
      ease: kf.ease
    }))
    const keep = inputs.filter(e => e.key !== 'Size')
    inputs.length = 0
    inputs.push(...keep)
    inputs.push(animatedNumberInput(transformName, 'Size', sizeKfs, fps, tools))
  }

  // Animated rotation -> Angle
  if (group.rotation && group.rotation.length > 1) {
    const rotKfs = group.rotation.map(kf => ({
      t: kf.t,
      value: toFusionRotation(kf.value),
      ease: kf.ease
    }))
    const keep = inputs.filter(e => e.key !== 'Angle')
    inputs.length = 0
    inputs.push(...keep)
    inputs.push(animatedNumberInput(transformName, 'Angle', rotKfs, fps, tools))
  }
}

// ---------------------------------------------------------------------------
// Hex colour helpers
// ---------------------------------------------------------------------------

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const [r, g, b] = parseHexColour(hex)
  return { r: r / 255, g: g / 255, b: b / 255 }
}

// ---------------------------------------------------------------------------
// SVG path parsing (minimal, for sPolygon points)
// ---------------------------------------------------------------------------

interface PathPoint {
  x: number
  y: number
}

/** Extract linear polygon points from an M/L/Z only SVG path. */
function parseLinearPath(d: string): PathPoint[] {
  const points: PathPoint[] = []
  const tokens = d.match(/[MLZ]|[-+]?\d*\.?\d+/g) || []
  let cmd = ''
  let i = 0

  while (i < tokens.length) {
    const t = tokens[i]
    if (/^[MLZ]$/.test(t)) {
      cmd = t
      i++
      if (cmd === 'Z') continue
    }

    if (cmd === 'M' || cmd === 'L') {
      const px = parseFloat(tokens[i])
      const py = parseFloat(tokens[i + 1])
      points.push({ x: px, y: py })
      i += 2
      if (cmd === 'M') cmd = 'L' // implicit L after M
    } else {
      i++
    }
  }
  return points
}

// ---------------------------------------------------------------------------
// Tool builders for each layer kind
// ---------------------------------------------------------------------------

type ShapeLayer = RectLayer | EllipseLayer | ArcLayer | PathLayer

function buildShapeInputs(
  layer: ShapeLayer,
  format: MotionFormat,
  tools: FusionTool[]
): LuaEntry[] {
  const w = format.width
  const h = format.height

  switch (layer.kind) {
    case 'rect':
      return buildRectInputs(layer, w, h, format.fps, tools)
    case 'ellipse':
      return buildEllipseInputs(layer, w, h, format.fps, tools)
    case 'arc':
      return buildArcInputs(layer, w, h, format.fps, tools)
    case 'path':
      // Simple paths -> sPolygon, bezier paths handled in buildPathFallback
      return buildPolygonInputs(layer, w, h, format.fps, tools)
    default:
      assertNever(layer)
  }
}

function buildRectInputs(
  layer: RectLayer,
  w: number,
  h: number,
  fps: number,
  tools: FusionTool[]
): LuaEntry[] {
  // Evaluator convention: world = position - anchor + local.
  // Rect local origin is top-left, so local centre = (width/2, height/2).
  // Fusion sRectangle XOffset/YOffset is the shape centre.
  const rawX = layer.position?.[0]?.value.x ?? layer.anchor.x
  const rawY = layer.position?.[0]?.value.y ?? layer.anchor.y
  const centreX = rawX - layer.anchor.x + layer.width / 2
  const centreY = rawY - layer.anchor.y + layer.height / 2
  const pos = toShapeCoords(centreX, centreY, w, h)
  const inputs: LuaEntry[] = [
    staticInput('Width', toFusionSize(layer.width, w)),
    staticInput('Height', toFusionSize(layer.height, w)),
    staticInput('XOffset', pos.x),
    staticInput('YOffset', pos.y),
    staticInput('CornerRadius', toFusionSize(layer.radius, w))
  ]

  // Animated width
  if (layer.widthAnimation && layer.widthAnimation.length > 1) {
    const scaledKfs = layer.widthAnimation.map(kf => ({
      ...kf,
      value: toFusionSize(kf.value, w)
    }))
    inputs.push(animatedNumberInput(layer.id, 'Width', scaledKfs, fps, tools))
  }

  // Animated height
  if (layer.heightAnimation && layer.heightAnimation.length > 1) {
    const scaledKfs = layer.heightAnimation.map(kf => ({
      ...kf,
      value: toFusionSize(kf.value, w)
    }))
    inputs.push(animatedNumberInput(layer.id, 'Height', scaledKfs, fps, tools))
  }

  // Anchor-to-centre offset for animated position
  const centreOffset = {
    x: -layer.anchor.x + layer.width / 2,
    y: -layer.anchor.y + layer.height / 2
  }

  // Base animatable properties (rotation handled by per-layer Transform)
  addShapePositionAnimation(inputs, layer, { w, h, fps }, tools, centreOffset)

  return inputs
}

function buildEllipseInputs(
  layer: EllipseLayer,
  w: number,
  h: number,
  fps: number,
  tools: FusionTool[]
): LuaEntry[] {
  // Evaluator convention: world = position - anchor + local.
  // Ellipse local origin is the top-left of its bounding box,
  // so local centre = (radiusX, radiusY).
  // Fusion sEllipse XOffset/YOffset is the shape centre.
  const rawX = layer.position?.[0]?.value.x ?? layer.anchor.x
  const rawY = layer.position?.[0]?.value.y ?? layer.anchor.y
  const centreX = rawX - layer.anchor.x + layer.radiusX
  const centreY = rawY - layer.anchor.y + layer.radiusY
  const pos = toShapeCoords(centreX, centreY, w, h)
  const inputs: LuaEntry[] = [
    staticInput('Width', toFusionSize(layer.radiusX * 2, w)),
    staticInput('Height', toFusionSize(layer.radiusY * 2, w)),
    staticInput('XOffset', pos.x),
    staticInput('YOffset', pos.y)
  ]

  // Anchor-to-centre offset for animated position
  const centreOffset = {
    x: -layer.anchor.x + layer.radiusX,
    y: -layer.anchor.y + layer.radiusY
  }

  // Base animatable properties (rotation handled by per-layer Transform)
  addShapePositionAnimation(inputs, layer, { w, h, fps }, tools, centreOffset)

  return inputs
}

function buildArcInputs(
  layer: ArcLayer,
  w: number,
  h: number,
  fps: number,
  tools: FusionTool[]
): LuaEntry[] {
  // Evaluator convention: world = position - anchor + local.
  // Arc local origin is its centre (0,0), so world_centre = position - anchor.
  const rawX = layer.position?.[0]?.value.x ?? layer.anchor.x
  const rawY = layer.position?.[0]?.value.y ?? layer.anchor.y
  const centreX = rawX - layer.anchor.x
  const centreY = rawY - layer.anchor.y
  const pos = toShapeCoords(centreX, centreY, w, h)
  const thickness = toFusionSize(layer.outerRadius - layer.innerRadius, w)
  const outerDiameter = toFusionSize(layer.outerRadius * 2, w)

  const inputs: LuaEntry[] = [
    staticInput('Width', outerDiameter),
    staticInput('Height', outerDiameter),
    staticInput('XOffset', pos.x),
    staticInput('YOffset', pos.y),
    staticInput('BorderWidth', thickness),
    staticInput('Solid', 0)
  ]

  // WriteLength from sweep keyframes
  if (layer.sweep.length > 1) {
    inputs.push(animatedNumberInput(layer.id, 'WriteLength', layer.sweep, fps, tools))
  } else {
    inputs.push(staticInput('WriteLength', layer.sweep[0].value))
  }

  // WritePosition from startAngle (normalised: degrees / 360)
  if (layer.startAngle.length > 1) {
    const normKfs = layer.startAngle.map(kf => ({
      ...kf,
      value: kf.value / 360
    }))
    inputs.push(animatedNumberInput(layer.id, 'WritePosition', normKfs, fps, tools))
  } else {
    inputs.push(staticInput('WritePosition', layer.startAngle[0].value / 360))
  }

  // Anchor-to-centre offset for animated position (arc centre = position - anchor)
  const centreOffset = {
    x: -layer.anchor.x,
    y: -layer.anchor.y
  }

  // Base animatable properties (rotation handled by per-layer Transform)
  addShapePositionAnimation(inputs, layer, { w, h, fps }, tools, centreOffset)

  return inputs
}

function buildPolygonInputs(
  layer: PathLayer,
  w: number,
  h: number,
  fps: number,
  tools: FusionTool[]
): LuaEntry[] {
  const points = parseLinearPath(layer.d)
  if (points.length === 0) return []

  const polylinePoints: LuaEntry[] = points.map(pt => {
    const shape = toShapeCoords(pt.x, pt.y, w, h)
    return {
      key: null,
      value: [
        { key: 'X', value: shape.x },
        { key: 'Y', value: shape.y },
        { key: 'Linear', value: true }
      ]
    }
  })

  const inputs: LuaEntry[] = [
    staticInput('Closed', 1),
    {
      key: 'Polyline',
      value: {
        call: 'Input',
        arg: [
          {
            key: 'Value',
            value: {
              call: 'Polyline',
              arg: [{ key: 'Points', value: polylinePoints }]
            }
          }
        ]
      }
    }
  ]

  // Base animatable properties (rotation handled by per-layer Transform)
  addShapePositionAnimation(inputs, layer, { w, h, fps }, tools)

  return inputs
}

// ---------------------------------------------------------------------------
// Path/hatch fallback: Polygon mask on Background
// ---------------------------------------------------------------------------

function buildPathFallback(
  layer: PathLayer,
  w: number,
  h: number,
  baseName: string
): FusionTool[] {
  const tools: FusionTool[] = []
  const maskName = luaIdent(`${baseName}_mask`)
  const bgName = luaIdent(`${baseName}_bg`)

  // Parse path points for the mask
  const points = parseLinearPath(layer.d)
  const polylinePoints: LuaEntry[] = points.map(pt => {
    const img = toImageCoords(pt.x, pt.y, w, h)
    return {
      key: null,
      value: [
        { key: 'X', value: img.x },
        { key: 'Y', value: img.y },
        { key: 'Linear', value: true }
      ]
    }
  })

  // Polygon mask
  tools.push({
    name: maskName,
    type: 'Polygon',
    entries: [
      {
        key: 'Inputs',
        value: [
          {
            key: 'Polyline',
            value: {
              call: 'Input',
              arg: [
                {
                  key: 'Value',
                  value: {
                    call: 'Polyline',
                    arg: [{ key: 'Points', value: polylinePoints }]
                  }
                }
              ]
            }
          }
        ]
      }
    ]
  })

  // Background with the mask and fill colour
  const rgb = hexToRgb(layer.fill)
  tools.push({
    name: bgName,
    type: 'Background',
    entries: [
      {
        key: 'Inputs',
        value: [
          staticInput('TopLeftRed', rgb.r),
          staticInput('TopLeftGreen', rgb.g),
          staticInput('TopLeftBlue', rgb.b),
          staticInput('TopLeftAlpha', 1),
          {
            key: 'EffectMask',
            value: {
              call: 'Input',
              arg: [
                { key: 'SourceOp', value: maskName },
                { key: 'Source', value: 'Mask' }
              ]
            }
          }
        ]
      }
    ]
  })

  return tools
}

// ---------------------------------------------------------------------------
// Fill colour animation
// ---------------------------------------------------------------------------

function buildFillColourAnimation(
  layer: { fillAnimation?: Keyframe<string>[]; fill: string; id: string },
  baseName: string,
  fps: number,
  tools: FusionTool[]
): { r: LuaEntry; g: LuaEntry; b: LuaEntry } | null {
  if (!layer.fillAnimation || layer.fillAnimation.length < 2) return null

  const rKfs = layer.fillAnimation.map(kf => ({
    t: kf.t,
    value: hexToRgb(kf.value).r,
    ease: kf.ease
  }))
  const gKfs = layer.fillAnimation.map(kf => ({
    t: kf.t,
    value: hexToRgb(kf.value).g,
    ease: kf.ease
  }))
  const bKfs = layer.fillAnimation.map(kf => ({
    t: kf.t,
    value: hexToRgb(kf.value).b,
    ease: kf.ease
  }))

  return {
    r: animatedNumberInput(baseName, 'Red', rKfs, fps, tools),
    g: animatedNumberInput(baseName, 'Green', gKfs, fps, tools),
    b: animatedNumberInput(baseName, 'Blue', bKfs, fps, tools)
  }
}

// ---------------------------------------------------------------------------
// Text+ builder
// ---------------------------------------------------------------------------

/** Build the static base inputs for a Text+ tool. */
function buildTextBaseInputs(layer: TextLayer, format: MotionFormat): LuaEntry[] {
  const pos = toImageCoords(
    layer.position?.[0]?.value.x ?? layer.anchor.x,
    layer.position?.[0]?.value.y ?? layer.anchor.y,
    format.width,
    format.height
  )

  const justification = layer.align === 'left' ? 0 : layer.align === 'right' ? 1 : 0.5

  return [
    staticInput('Width', 1),
    staticInput('Height', 1),
    staticInput('UseFrameFormatSettings', 0),
    staticInput('StyledText', layer.text),
    staticInput('Font', layer.font.family),
    staticInput('Style', layer.font.style),
    staticInput('Size', toFusionSize(layer.font.size, format.width)),
    {
      key: 'Center',
      value: {
        call: 'Input',
        arg: [
          {
            key: 'Value',
            value: [
              { key: null, value: pos.x },
              { key: null, value: pos.y }
            ]
          }
        ]
      }
    },
    staticInput('HorizontalJustification', justification),
    staticInput('LineSpacing', layer.lineHeight)
  ]
}

/** Add animated tracks for Text+ (opacity, tracking, position, scale, rotation). */
function addTextAnimations(
  inputs: LuaEntry[],
  layer: TextLayer,
  format: MotionFormat,
  fps: number,
  tools: FusionTool[]
): void {
  const name = toolName(layer.id, 'text')

  if (layer.opacity && layer.opacity.length > 1) {
    inputs.push(animatedNumberInput(name, 'Opacity', layer.opacity, fps, tools))
  } else if (layer.opacity && layer.opacity.length === 1) {
    inputs.push(staticInput('Opacity', layer.opacity[0].value))
  }

  if (layer.tracking && layer.tracking.length > 1) {
    inputs.push(animatedNumberInput(name, 'Tracking', layer.tracking, fps, tools))
  } else if (layer.tracking && layer.tracking.length === 1) {
    inputs.push(staticInput('Tracking', layer.tracking[0].value))
  }

  addTextPositionAnimation(inputs, layer, format.width, format.height, fps, tools)
  addTextScaleAnimation(inputs, layer, fps, tools)
  addTextRotationAnimation(inputs, layer, fps, tools)
}

/** Add fill colour (static or animated) to a Text+ inputs list. */
function addTextFillColour(
  inputs: LuaEntry[],
  layer: TextLayer,
  fps: number,
  tools: FusionTool[]
): void {
  const rgb = hexToRgb(layer.fill)
  const fillAnim = buildFillColourAnimation(layer, toolName(layer.id, 'text'), fps, tools)
  if (fillAnim) {
    inputs.push(fillAnim.r)
    inputs.push(fillAnim.g)
    inputs.push(fillAnim.b)
  } else {
    inputs.push(staticInput('Red1', rgb.r))
    inputs.push(staticInput('Green1', rgb.g))
    inputs.push(staticInput('Blue1', rgb.b))
  }
}

function buildTextTool(
  layer: TextLayer,
  format: MotionFormat,
  fps: number,
  tools: FusionTool[]
): FusionTool {
  const textInputs = buildTextBaseInputs(layer, format)
  addTextAnimations(textInputs, layer, format, fps, tools)
  addTextFillColour(textInputs, layer, fps, tools)

  return {
    name: toolName(layer.id, 'text'),
    type: 'TextPlus',
    entries: [{ key: 'Inputs', value: textInputs }]
  }
}

// ---------------------------------------------------------------------------
// Counter expression
// ---------------------------------------------------------------------------

function buildCounterTextTool(
  layer: TextLayer,
  format: MotionFormat,
  fps: number,
  tools: FusionTool[],
  values: Record<string, unknown>
): FusionTool {
  const counter = layer.counter!
  const paramValue =
    typeof values[counter.param] === 'number' ? (values[counter.param] as number) : 0

  // Build the base Text+ tool
  const textTool = buildTextTool(layer, format, fps, tools)

  // Create a progress spline
  const progressSplineName = nextSplineName(layer.id, 'progress')
  const progressKfs = toFusionKeyframes(counter.progress, fps)
  tools.push(buildSplineTool(progressSplineName, progressKfs))

  // Build expression: Text(string.format("%<format>", progress * value))
  // The expression reads the progress value and multiplies by the target number
  const fmtStr = counter.decimals === 0 ? '%d' : `%.${counter.decimals}f`
  const expression = [
    `local progress = self.Comp:FindTool("${progressSplineName}")`,
    `if progress then`,
    `    local p = progress:GetInput("Value", self.Comp.CurrentTime)`,
    `    local val = p * ${paramValue}`,
    `    return "${escapeLuaString(counter.prefix)}" .. string.format("${fmtStr}", val) .. "${escapeLuaString(counter.suffix)}"`,
    `else`,
    `    return "${escapeLuaString(counter.prefix)}0${escapeLuaString(counter.suffix)}"`,
    `end`
  ].join('\n')

  // Add the expression to the StyledText input
  const inputs = textTool.entries.find(e => e.key === 'Inputs')
  if (inputs && Array.isArray(inputs.value)) {
    // Replace the static StyledText with an expression-driven one
    const filtered = (inputs.value as LuaEntry[]).filter(e => e.key !== 'StyledText')
    filtered.push({
      key: 'StyledText',
      value: {
        call: 'Input',
        arg: [
          { key: 'Value', value: layer.text },
          { key: 'Expression', value: expression }
        ]
      }
    })
    inputs.value = filtered
  }

  return textTool
}

// ---------------------------------------------------------------------------
// Stagger / Follower
// ---------------------------------------------------------------------------

/** Convert a stagger delay (already quantised by resolveTemplate) to frames. */
function computeStaggerFrames(delaySeconds: number, fps: number): number {
  return Math.round(delaySeconds * fps)
}

function buildFollowerModifier(textToolName: string, delayFrames: number): FusionTool {
  return {
    name: luaIdent(textToolName + '_follower'),
    type: 'StyledTextFollower',
    entries: [
      {
        key: 'Inputs',
        value: [
          staticInput('Delay', delayFrames),
          staticInput('DelayType', 0), // Between Each Character
          staticInput('Order', 0), // Left to Right
          {
            key: 'SourceOp',
            value: {
              call: 'Input',
              arg: [
                { key: 'SourceOp', value: textToolName },
                { key: 'Source', value: 'StyledText' }
              ]
            }
          }
        ]
      }
    ]
  }
}

// ---------------------------------------------------------------------------
// Shape fill (for s* tools, colour goes into sMerge or sRender)
// ---------------------------------------------------------------------------

function buildShapeFillInputs(
  layer: PrimitiveLayer,
  baseName: string,
  fps: number,
  tools: FusionTool[]
): LuaEntry[] {
  if (!('fill' in layer)) return []
  const fill = (layer as { fill: string }).fill
  const rgb = hexToRgb(fill)
  const inputs: LuaEntry[] = [
    staticInput('Red', rgb.r),
    staticInput('Green', rgb.g),
    staticInput('Blue', rgb.b)
  ]

  // Fill animation
  const fillAnim = buildFillColourAnimation(
    layer as { fillAnimation?: Keyframe<string>[]; fill: string; id: string },
    baseName,
    fps,
    tools
  )
  if (fillAnim) {
    return [fillAnim.r, fillAnim.g, fillAnim.b]
  }

  return inputs
}

// ---------------------------------------------------------------------------
// Layer processing
// ---------------------------------------------------------------------------

/** A shape that has its own per-layer Transform (scale/rotation). */
interface TransformedShape {
  shapeTool: FusionTool
  transformTool: FusionTool
}

/**
 * One entry in the ordered layer output list.
 *
 * Each leaf layer produces one of these; a group builds its own sub-chain
 * and produces a single 'group' entry. The final merge chains these in
 * paint order.
 */
type LayerOutput =
  | { type: 'untransformedShape'; tool: FusionTool }
  | { type: 'transformedShape'; ts: TransformedShape }
  | { type: 'fallback'; tools: FusionTool[] }
  | { type: 'text'; tool: FusionTool }
  | { type: 'group'; outputName: string }

interface ProcessedLayers {
  /** Layer outputs in paint order (resolved layer array order). */
  outputs: LayerOutput[]
  /** All spline tools (BezierSpline, XYPath, Follower). */
  splineTools: FusionTool[]
  /** Merge-chain tools generated during sub-chain building. */
  chainTools: FusionTool[]
}

/** Check if a path layer is a hatch band (from expand.ts series expansion). */
function isHatchBand(layer: PrimitiveLayer): boolean {
  return layer.kind === 'path' && layer.id.includes('-hatch-')
}

/** Process a text layer: build Text+, optional counter expression, optional Follower. */
function processTextLayer(
  layer: TextLayer,
  format: MotionFormat,
  result: ProcessedLayers,
  _notes: string[],
  values: Record<string, unknown>
): void {
  const fps = format.fps
  let textTool: FusionTool
  if (layer.counter) {
    textTool = buildCounterTextTool(layer, format, fps, result.splineTools, values)
  } else {
    textTool = buildTextTool(layer, format, fps, result.splineTools)
  }

  if (layer.stagger) {
    const delayFrames = computeStaggerFrames(layer.stagger.delay, fps)
    if (delayFrames > 0) {
      result.splineTools.push(buildFollowerModifier(textTool.name, delayFrames))
    }
  }

  result.outputs.push({ type: 'text', tool: textTool })
}

/** Process a shape layer (rect, ellipse, arc) into an s* tool. */
function processShapeLayer(
  layer: RectLayer | EllipseLayer | ArcLayer,
  format: MotionFormat,
  result: ProcessedLayers
): void {
  const shapeName = toolName(layer.id, 'shape')
  const shapeType = layer.kind === 'rect' ? 'sRectangle' : 'sEllipse'
  const fps = format.fps

  const inputs = buildShapeInputs(layer, format, result.splineTools)
  addShapeOpacity(inputs, layer, shapeName, fps, result.splineTools)
  const fillInputs = buildShapeFillInputs(layer, shapeName, fps, result.splineTools)

  const shapeTool: FusionTool = {
    name: shapeName,
    type: shapeType,
    entries: [{ key: 'Inputs', value: [...inputs, ...fillInputs] }]
  }

  const xf = buildShapeTransform(
    layer,
    { w: format.width, h: format.height, fps },
    result.splineTools
  )
  if (xf) {
    result.outputs.push({
      type: 'transformedShape',
      ts: { shapeTool, transformTool: xf }
    })
  } else {
    result.outputs.push({ type: 'untransformedShape', tool: shapeTool })
  }
}

/** Process a path layer into sPolygon or Background fallback. */
function processPathLayer(
  layer: PathLayer,
  format: MotionFormat,
  result: ProcessedLayers
): void {
  if (isHatchBand(layer)) {
    const fallback = buildPathFallback(
      layer,
      format.width,
      format.height,
      luaIdent(layer.id)
    )
    result.outputs.push({ type: 'fallback', tools: fallback })
    return
  }

  const shapeName = toolName(layer.id, 'shape')
  const fps = format.fps
  const inputs = buildShapeInputs(layer, format, result.splineTools)
  addShapeOpacity(inputs, layer, shapeName, fps, result.splineTools)
  const fillInputs = buildShapeFillInputs(layer, shapeName, fps, result.splineTools)

  const shapeTool: FusionTool = {
    name: shapeName,
    type: 'sPolygon',
    entries: [{ key: 'Inputs', value: [...inputs, ...fillInputs] }]
  }

  const xf = buildShapeTransform(
    layer,
    { w: format.width, h: format.height, fps },
    result.splineTools
  )
  if (xf) {
    result.outputs.push({
      type: 'transformedShape',
      ts: { shapeTool, transformTool: xf }
    })
  } else {
    result.outputs.push({ type: 'untransformedShape', tool: shapeTool })
  }
}

function processLayer(
  layer: PrimitiveLayer,
  format: MotionFormat,
  result: ProcessedLayers,
  notes: string[],
  values: Record<string, unknown>
): void {
  switch (layer.kind) {
    case 'text':
      processTextLayer(layer, format, result, notes, values)
      break
    case 'rect':
    case 'ellipse':
    case 'arc':
      processShapeLayer(layer, format, result)
      break
    case 'path':
      processPathLayer(layer, format, result)
      break
    case 'group':
      processGroup(layer as GroupLayer, format, result, notes, values)
      break
    case 'particles':
      break
    default:
      assertNever(layer)
  }
}

/**
 * Build the group's image Transform tool if it has position, scale or rotation.
 *
 * Center is the image-centre translation: (0.5 + dx/w, 0.5 - dy/h)
 * where dx = pos.x - anchor.x, dy = pos.y - anchor.y. This means a group
 * at {0,0} with no anchor gives Center (0.5, 0.5) - no translation.
 *
 * Pivot sits at the anchor's world position (= position) in image coords
 * for scale/rotation.
 */
function buildGroupTransform(
  group: GroupLayer,
  format: MotionFormat,
  splineTools: FusionTool[]
): FusionTool | null {
  const hasTransform =
    (group.position && group.position.length > 0) ||
    (group.scale && group.scale.length > 0) ||
    (group.rotation && group.rotation.length > 0)

  if (!hasTransform) return null

  const transformName = toolName(group.id, 'transform')
  const { width: w, height: h } = format
  const anchor = group.anchor

  // Translation: position - anchor, mapped to image-centre offset
  const posVal = group.position?.[0]?.value ?? { x: anchor.x, y: anchor.y }
  const dx = posVal.x - anchor.x
  const dy = posVal.y - anchor.y
  const center = { x: 0.5 + dx / w, y: 0.5 - dy / h }

  const inputs: LuaEntry[] = [
    {
      key: 'Center',
      value: {
        call: 'Input',
        arg: [
          {
            key: 'Value',
            value: [
              { key: null, value: center.x },
              { key: null, value: center.y }
            ]
          }
        ]
      }
    }
  ]

  // Pivot at the anchor's world position for scale/rotation
  const pivotPos = toImageCoords(posVal.x, posVal.y, w, h)
  inputs.push(pivotInput(pivotPos))

  if (group.scale && group.scale.length > 0) {
    inputs.push(staticInput('Size', group.scale[0].value.x))
  }
  if (group.rotation && group.rotation.length > 0) {
    inputs.push(staticInput('Angle', toFusionRotation(group.rotation[0].value)))
  }

  addGroupTransformAnimations(
    inputs,
    group,
    { w, h, fps: format.fps },
    splineTools,
    transformName
  )

  return {
    name: transformName,
    type: 'Transform',
    entries: [{ key: 'Inputs', value: inputs }]
  }
}

/**
 * Build a transparent Background tool for use as the empty base in an opacity
 * blend. The group content goes in the Foreground, and Blend scales how much
 * of it is visible.
 */
function buildTransparentBackground(baseName: string): FusionTool {
  return {
    name: luaIdent(`${baseName}_alpha_bg`),
    type: 'Background',
    entries: [
      {
        key: 'Inputs',
        value: [
          staticInput('TopLeftRed', 0),
          staticInput('TopLeftGreen', 0),
          staticInput('TopLeftBlue', 0),
          staticInput('TopLeftAlpha', 0)
        ]
      }
    ]
  }
}

/**
 * Build a Merge with Blend for group opacity.
 *
 * The group content is wired to Foreground over a transparent Background,
 * so Blend actually fades the content in/out.
 */
function buildGroupOpacityMerge(
  group: GroupLayer,
  format: MotionFormat,
  splineTools: FusionTool[],
  mergeTools: FusionTool[]
): FusionTool | null {
  if (!group.opacity || group.opacity.length === 0) return null

  const name = toolName(group.id, 'blend')

  // Add the transparent background tool
  const alphaBg = buildTransparentBackground(group.id)
  mergeTools.push(alphaBg)

  const inputs: LuaEntry[] = [
    // Background is the transparent base
    sourceOpInput('Background', alphaBg.name)
  ]
  if (group.opacity.length > 1) {
    inputs.push(
      animatedNumberInput(name, 'Blend', group.opacity, format.fps, splineTools)
    )
  } else {
    inputs.push(staticInput('Blend', group.opacity[0].value))
  }

  return { name, type: 'Merge', entries: [{ key: 'Inputs', value: inputs }] }
}

/**
 * Process a group layer: build its children into their own sub-chain,
 * apply the group's Transform and opacity Blend, and produce a single
 * output entry in the parent's layer list.
 */
function processGroup(
  group: GroupLayer,
  format: MotionFormat,
  parentResult: ProcessedLayers,
  notes: string[],
  values: Record<string, unknown>
): void {
  // Process children into a separate result
  const childResult: ProcessedLayers = {
    outputs: [],
    splineTools: [],
    chainTools: []
  }
  for (const child of group.children as PrimitiveLayer[]) {
    processLayer(child, format, childResult, notes, values)
  }

  // Collect all leaf tools from children so they appear in the final tool list
  const childLeafTools: FusionTool[] = []
  for (const entry of childResult.outputs) {
    switch (entry.type) {
      case 'untransformedShape':
        childLeafTools.push(entry.tool)
        break
      case 'transformedShape':
        childLeafTools.push(entry.ts.shapeTool)
        break
      case 'text':
        childLeafTools.push(entry.tool)
        break
      case 'fallback':
        childLeafTools.push(...entry.tools)
        break
    }
  }

  // Build the children's merge chain
  const childMergeTools: FusionTool[] = []
  const childImageOutputs = collectImageOutputs(childResult, childMergeTools)
  buildImageMergeChain(childImageOutputs, childMergeTools)

  // Gather all tools from the children into the parent
  parentResult.splineTools.push(...childResult.splineTools)
  parentResult.chainTools.push(...childResult.chainTools)
  parentResult.chainTools.push(...childLeafTools)

  // The last tool in the sub-chain is the input for the group Transform/Blend
  let lastOutput =
    childMergeTools.length > 0
      ? childMergeTools[childMergeTools.length - 1].name
      : (childImageOutputs[childImageOutputs.length - 1] ?? null)

  // Apply group transform
  const transform = buildGroupTransform(group, format, parentResult.splineTools)
  if (transform && lastOutput) {
    wireAndPush(transform, 'Input', lastOutput, childMergeTools)
    lastOutput = transform.name
  }

  // Apply group opacity blend
  const blendMerge = buildGroupOpacityMerge(
    group,
    format,
    parentResult.splineTools,
    childMergeTools
  )
  if (blendMerge && lastOutput) {
    // Wire the content to Foreground (the Blend scales Foreground over Background)
    wireAndPush(blendMerge, 'Foreground', lastOutput, childMergeTools)
    lastOutput = blendMerge.name
  }

  // Push all child merge tools into the parent's chain
  parentResult.chainTools.push(...childMergeTools)

  if (lastOutput) {
    parentResult.outputs.push({ type: 'group', outputName: lastOutput })
  }
}

// ---------------------------------------------------------------------------
// Instance inputs (exposed params)
// ---------------------------------------------------------------------------

interface InstanceInputDef {
  entry: LuaEntry
  targetTool: string
  targetSource: string
}

/** Deferred expression link: wire a secondary tool's fill input to a primary. */
interface ExpressionLink {
  toolName: string
  inputName: string
  sourceToolName: string
  sourceInputName: string
}

function buildInstanceInputs(
  template: MotionTemplate,
  layers: PrimitiveLayer[],
  textTools: FusionTool[],
  shapeTools: FusionTool[],
  expressionLinks: ExpressionLink[],
  notes: string[]
): InstanceInputDef[] {
  const inputs: InstanceInputDef[] = []

  for (const [paramId, paramDef] of Object.entries(template.params)) {
    if (paramDef.kind === 'text') {
      // Find the Text+ tool that corresponds to this param
      const textLayer = findTextLayerForParam(paramId, layers)
      if (textLayer) {
        const textToolName = luaIdent(textLayer.id + '_text')
        const tool = textTools.find(t => t.name === textToolName)
        if (tool) {
          inputs.push({
            entry: {
              key: paramId,
              value: {
                call: 'InstanceInput',
                arg: [
                  { key: 'SourceOp', value: textToolName },
                  { key: 'Source', value: 'StyledText' },
                  { key: 'Name', value: paramDef.label },
                  { key: 'Default', value: paramDef.default }
                ]
              }
            },
            targetTool: textToolName,
            targetSource: 'StyledText'
          })
        }
      }
    } else if (paramDef.kind === 'colour') {
      // Expose R, G, B channels on the bound shape/text tool's fill inputs
      buildColourInstanceInputs(paramId, paramDef, {
        layers: template.layers as PrimitiveLayer[],
        emittedTools: [...textTools, ...shapeTools],
        inputs,
        expressionLinks,
        notes
      })
    }
    // hold, number, numberList, image: not exposed
  }

  return inputs
}

function findTextLayerForParam(
  paramId: string,
  layers: PrimitiveLayer[]
): TextLayer | null {
  for (const layer of layers) {
    if (layer.kind === 'text' && layer.param === paramId) return layer
    if (layer.kind === 'group') {
      const found = findTextLayerForParam(
        paramId,
        (layer as GroupLayer).children as PrimitiveLayer[]
      )
      if (found) return found
    }
  }
  return null
}

/**
 * Resolve a binds path (e.g. 'layers[0]', 'layers[1].children[2]',
 * 'layers[0].children[0].children[0]') to a layer from the template's
 * original layer tree. Uses the shared resolveBindPath resolver so any
 * path the schema validates is also resolvable here, at any depth.
 *
 * Returns the layer and its kind-based tool name, or null when the path
 * is invalid or the target is not a fill-bearing primitive.
 */
function resolveBind(
  bindPath: string,
  templateLayers: PrimitiveLayer[]
): { layer: PrimitiveLayer; toolName: string; fillInputs: readonly string[] } | null {
  const node = resolveBindPath(
    templateLayers as (PrimitiveLayer & { children?: unknown })[],
    bindPath
  )
  if (!node) return null
  const layer = node as PrimitiveLayer

  if (layer.kind === 'text') {
    return {
      layer,
      toolName: luaIdent(`${layer.id}_text`),
      fillInputs: ['Red1', 'Green1', 'Blue1'] as const
    }
  }
  if (
    layer.kind === 'rect' ||
    layer.kind === 'ellipse' ||
    layer.kind === 'arc' ||
    layer.kind === 'path'
  ) {
    return {
      layer,
      toolName: luaIdent(`${layer.id}_shape`),
      fillInputs: ['Red', 'Green', 'Blue'] as const
    }
  }
  // Groups and particles are not fill-bearing primitives
  return null
}

interface ColourBindContext {
  layers: PrimitiveLayer[]
  emittedTools: FusionTool[]
  inputs: InstanceInputDef[]
  expressionLinks: ExpressionLink[]
  notes: string[]
}

function buildColourInstanceInputs(
  paramId: string,
  paramDef: ParamDef & { kind: 'colour' },
  ctx: ColourBindContext
): void {
  const { layers, emittedTools, inputs, expressionLinks, notes } = ctx
  if (paramDef.binds.length === 0) return

  // Resolve the bound layers and their tool names, verifying each exists
  const resolved = paramDef.binds
    .map(path => {
      const r = resolveBind(path, layers)
      if (!r) {
        notes.push(
          `Colour bind "${paramId}" target "${path}" is not a fill-bearing primitive - skipped`
        )
        return null
      }
      // Verify the tool was actually emitted
      if (!emittedTools.find(t => t.name === r.toolName)) {
        notes.push(
          `Colour bind "${paramId}" target "${path}" has no emitted tool "${r.toolName}" - skipped`
        )
        return null
      }
      return r
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)

  if (resolved.length === 0) return

  const primary = resolved[0]

  // Create InstanceInputs pointing at the first bound tool's fill channels
  const channelLabels = ['Red', 'Green', 'Blue'] as const
  for (let ci = 0; ci < 3; ci++) {
    inputs.push({
      entry: {
        key: `${paramId}_${channelLabels[ci]}`,
        value: {
          call: 'InstanceInput',
          arg: [
            { key: 'SourceOp', value: primary.toolName },
            { key: 'Source', value: primary.fillInputs[ci] },
            { key: 'Name', value: `${paramDef.label} ${channelLabels[ci]}` }
          ]
        }
      },
      targetTool: primary.toolName,
      targetSource: primary.fillInputs[ci]
    })
  }

  // Expression-link subsequent bound tools' fills to the primary
  for (let i = 1; i < resolved.length; i++) {
    const secondary = resolved[i]
    for (let ci = 0; ci < 3; ci++) {
      expressionLinks.push({
        toolName: secondary.toolName,
        inputName: secondary.fillInputs[ci],
        sourceToolName: primary.toolName,
        sourceInputName: primary.fillInputs[ci]
      })
    }
  }
}

// ---------------------------------------------------------------------------
// Expression link application
// ---------------------------------------------------------------------------

/**
 * Apply deferred expression links to the tool list. Each link replaces the
 * static fill input on the secondary tool with an expression that reads
 * the primary tool's input at the current time.
 */
function applyExpressionLinks(tools: FusionTool[], links: ExpressionLink[]): void {
  for (const link of links) {
    const tool = tools.find(t => t.name === link.toolName)
    if (!tool) continue
    const inputsEntry = tool.entries.find(e => e.key === 'Inputs')
    if (!inputsEntry || !Array.isArray(inputsEntry.value)) continue
    const inputs = inputsEntry.value as LuaEntry[]

    // Replace the static input with an expression-driven one
    const idx = inputs.findIndex(e => e.key === link.inputName)
    const expr =
      `self.Comp:FindTool("${link.sourceToolName}")` +
      `:GetInput("${link.sourceInputName}", self.Comp.CurrentTime)`
    const exprInput: LuaEntry = {
      key: link.inputName,
      value: {
        call: 'Input',
        arg: [
          { key: 'Value', value: 0 },
          { key: 'Expression', value: expr }
        ]
      }
    }
    if (idx >= 0) {
      inputs[idx] = exprInput
    } else {
      inputs.push(exprInput)
    }
  }
}

// ---------------------------------------------------------------------------
// Merge chain
// ---------------------------------------------------------------------------

/** Create a SourceOp connection input. */
function sourceOpInput(key: string, sourceOp: string): LuaEntry {
  return {
    key,
    value: {
      call: 'Input',
      arg: [
        { key: 'SourceOp', value: sourceOp },
        { key: 'Source', value: 'Output' }
      ]
    }
  }
}

/** Chain shape tools through sMerge nodes and an sRender, returning the output name. */
function buildShapeMergeChain(
  shapeTools: FusionTool[],
  mergeTools: FusionTool[]
): string | null {
  if (shapeTools.length === 0) return null

  const batchId = shapeBatchCounter++
  const suffix = batchId === 0 ? '' : `_${batchId}`

  // Build sMerge chain
  let prevOutput = shapeTools[0].name
  for (let i = 1; i < shapeTools.length; i++) {
    const smergeName = `shape_smerge${suffix}_${i}`
    const inputs: LuaEntry[] = [
      sourceOpInput('Background', prevOutput),
      sourceOpInput('Foreground', shapeTools[i].name)
    ]
    mergeTools.push({
      name: smergeName,
      type: 'sMerge',
      entries: [{ key: 'Inputs', value: inputs }]
    })
    prevOutput = smergeName
  }

  // Single shape still needs sMerge for the sRender chain
  if (shapeTools.length === 1) {
    const smergeName = `shape_smerge${suffix}`
    mergeTools.push({
      name: smergeName,
      type: 'sMerge',
      entries: [{ key: 'Inputs', value: [sourceOpInput('Background', prevOutput)] }]
    })
    prevOutput = smergeName
  }

  // sRender
  const sRenderName = `shape_srender${suffix}`
  mergeTools.push({
    name: sRenderName,
    type: 'sRender',
    entries: [{ key: 'Inputs', value: [sourceOpInput('Background', prevOutput)] }]
  })
  return sRenderName
}

/** Chain multiple image outputs through Merge nodes. */
function buildImageMergeChain(outputs: string[], mergeTools: FusionTool[]): void {
  if (outputs.length <= 1) return
  let prevOutput = outputs[0]
  for (let i = 1; i < outputs.length; i++) {
    const mergeName = `merge_${i}`
    mergeTools.push({
      name: mergeName,
      type: 'Merge',
      entries: [
        {
          key: 'Inputs',
          value: [
            sourceOpInput('Background', prevOutput),
            sourceOpInput('Foreground', outputs[i])
          ]
        }
      ]
    })
    prevOutput = mergeName
  }
}

/**
 * Build an sRender+Transform pair for a single transformed shape.
 * Returns the Transform name as the image output.
 */
function buildPerShapeTransform(ts: TransformedShape, mergeTools: FusionTool[]): string {
  // sMerge (single shape needs it for sRender)
  const smergeName = luaIdent(`${ts.shapeTool.name}_smerge`)
  mergeTools.push({
    name: smergeName,
    type: 'sMerge',
    entries: [{ key: 'Inputs', value: [sourceOpInput('Background', ts.shapeTool.name)] }]
  })

  // sRender
  const srenderName = luaIdent(`${ts.shapeTool.name}_srender`)
  mergeTools.push({
    name: srenderName,
    type: 'sRender',
    entries: [{ key: 'Inputs', value: [sourceOpInput('Background', smergeName)] }]
  })

  // Wire the Transform's Input to the sRender output
  const transformInputs = ts.transformTool.entries.find(e => e.key === 'Inputs')
  if (transformInputs && Array.isArray(transformInputs.value)) {
    ;(transformInputs.value as LuaEntry[]).unshift(sourceOpInput('Input', srenderName))
  }
  mergeTools.push(ts.transformTool)

  return ts.transformTool.name
}

/** Wire a tool's first Input entry to a source, then push it into the chain. */
function wireAndPush(
  tool: FusionTool,
  inputKey: string,
  sourceOp: string,
  mergeTools: FusionTool[]
): void {
  const inputs = tool.entries.find(e => e.key === 'Inputs')
  if (inputs && Array.isArray(inputs.value)) {
    ;(inputs.value as LuaEntry[]).unshift(sourceOpInput(inputKey, sourceOp))
  }
  mergeTools.push(tool)
}

/**
 * Collect image outputs in resolved layer order.
 *
 * Each output entry produces one image-domain tool name:
 * - untransformedShape: goes through a shared sMerge+sRender batch
 *   (consecutive untransformed shapes share the same batch)
 * - transformedShape: gets its own sMerge+sRender+Transform
 * - fallback: Background tools from hatch bands
 * - text: Text+ tool
 * - group: already built sub-chain output
 */
function collectImageOutputs(
  processed: ProcessedLayers,
  mergeTools: FusionTool[]
): string[] {
  const outputs: string[] = []

  // Batch consecutive untransformed shapes into a single sMerge+sRender
  let shapeBatch: FusionTool[] = []

  function flushShapeBatch(): void {
    if (shapeBatch.length === 0) return
    const batchMergeTools: FusionTool[] = []
    const batchOutput = buildShapeMergeChain(shapeBatch, batchMergeTools)
    if (batchOutput) {
      mergeTools.push(...batchMergeTools)
      outputs.push(batchOutput)
    }
    shapeBatch = []
  }

  for (const entry of processed.outputs) {
    switch (entry.type) {
      case 'untransformedShape':
        shapeBatch.push(entry.tool)
        break
      case 'transformedShape':
        flushShapeBatch()
        outputs.push(buildPerShapeTransform(entry.ts, mergeTools))
        break
      case 'fallback':
        flushShapeBatch()
        mergeTools.push(...entry.tools)
        for (const ft of entry.tools) {
          if (ft.type === 'Background') outputs.push(ft.name)
        }
        break
      case 'text':
        flushShapeBatch()
        outputs.push(entry.tool.name)
        break
      case 'group':
        flushShapeBatch()
        outputs.push(entry.outputName)
        break
    }
  }
  flushShapeBatch()

  return outputs
}

/** Build the final merge chain from processed layers. */
function buildMergeChain(processed: ProcessedLayers): FusionTool[] {
  const mergeTools: FusionTool[] = [...processed.chainTools]
  const imageOutputs = collectImageOutputs(processed, mergeTools)
  buildImageMergeChain(imageOutputs, mergeTools)
  return mergeTools
}

// ---------------------------------------------------------------------------
// Tool collection helpers
// ---------------------------------------------------------------------------

/** Collect shape, text and fallback tools from outputs and child chain tools. */
function collectAllLeafTools(processed: ProcessedLayers): {
  shapeTools: FusionTool[]
  textTools: FusionTool[]
  fallbackTools: FusionTool[]
} {
  const shapeTools: FusionTool[] = []
  const textTools: FusionTool[] = []
  const fallbackTools: FusionTool[] = []
  for (const entry of processed.outputs) {
    if (entry.type === 'untransformedShape') shapeTools.push(entry.tool)
    else if (entry.type === 'transformedShape') shapeTools.push(entry.ts.shapeTool)
    else if (entry.type === 'text') textTools.push(entry.tool)
    else if (entry.type === 'fallback') fallbackTools.push(...entry.tools)
  }
  for (const tool of processed.chainTools) {
    if (tool.type === 'TextPlus') textTools.push(tool)
    else if (['sRectangle', 'sEllipse', 'sPolygon'].includes(tool.type))
      shapeTools.push(tool)
    else if (tool.type === 'Background') fallbackTools.push(tool)
  }
  return { shapeTools, textTools, fallbackTools }
}

/** Collect leaf tools from the top-level outputs only (for the internal tools list). */
function collectTopLevelLeafTools(processed: ProcessedLayers): FusionTool[] {
  const tools: FusionTool[] = []
  for (const entry of processed.outputs) {
    if (entry.type === 'untransformedShape') tools.push(entry.tool)
    else if (entry.type === 'transformedShape') tools.push(entry.ts.shapeTool)
    else if (entry.type === 'text') tools.push(entry.tool)
    else if (entry.type === 'fallback') tools.push(...entry.tools)
  }
  return tools
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a DaVinci Resolve Fusion .setting file from the resolved template.
 *
 * @param input - The export input with resolved template, values and format
 * @returns The export result with one .setting file and any notes
 * @throws If the template contains particles layers
 */
export function generateSetting(input: ExportInput): ExportResult {
  const { template, resolved, format } = input
  const notes: string[] = []

  // Reject particle templates
  if (hasParticles(resolved.layers)) {
    throw new Error(
      'Particle templates export only Video and Claude prompt, not Resolve .setting'
    )
  }

  resetCounters()

  // Process layers
  const processed: ProcessedLayers = {
    outputs: [],
    splineTools: [],
    chainTools: []
  }

  for (const layer of resolved.layers) {
    processLayer(layer, format, processed, notes, resolved.values)
  }

  // Collect all shape and text tools for instance input wiring
  const {
    shapeTools: allShapeTools,
    textTools: allTextTools,
    fallbackTools: allFallbackTools
  } = collectAllLeafTools(processed)

  // Build instance inputs (colour params bind to shape/text fills directly)
  const expressionLinks: ExpressionLink[] = []
  const instanceInputs = buildInstanceInputs(
    template,
    resolved.layers,
    allTextTools,
    allShapeTools,
    expressionLinks,
    notes
  )

  // Apply expression links for multi-bound colour params
  const allProcessedTools = [...allShapeTools, ...allTextTools, ...allFallbackTools]
  applyExpressionLinks(allProcessedTools, expressionLinks)

  // Build merge chain
  const mergeTools = buildMergeChain(processed)

  // Find the final output tool - the last tool in the merge chain, or the
  // last emitted tool if no merges exist
  const leafTools = collectTopLevelLeafTools(processed)

  const allToolNames = [...leafTools.map(t => t.name), ...mergeTools.map(t => t.name)]
  const finalOutput =
    mergeTools.length > 0
      ? mergeTools[mergeTools.length - 1].name
      : (allToolNames[allToolNames.length - 1] ?? template.id)

  // Build the macro
  const macroName = luaIdent(template.id)

  // Instance inputs
  const instanceInputEntries = instanceInputs.map(ii => ii.entry)

  // Output
  const outputEntries: LuaEntry[] = [
    {
      key: 'MainOutput1',
      value: {
        call: 'InstanceOutput',
        arg: [
          { key: 'SourceOp', value: finalOutput },
          { key: 'Source', value: 'Output' }
        ]
      }
    }
  ]

  // Collect all internal tools
  const internalTools: FusionTool[] = [
    ...leafTools,
    ...processed.splineTools,
    ...mergeTools
  ]

  const toolEntries: LuaEntry[] = internalTools.map(toolToEntry)

  // Build the macro tool
  const macroEntries: LuaEntry[] = []
  if (instanceInputEntries.length > 0) {
    macroEntries.push({ key: 'Inputs', value: instanceInputEntries })
  }
  macroEntries.push({ key: 'Outputs', value: outputEntries })
  macroEntries.push({
    key: 'ViewInfo',
    value: {
      call: 'OperatorInfo',
      arg: [
        {
          key: 'Pos',
          value: [
            { key: null, value: 0 },
            { key: null, value: 0 }
          ]
        }
      ]
    }
  })
  macroEntries.push({ key: 'Tools', value: toolEntries })

  // Build the top-level structure
  const topLevel: LuaEntry[] = [
    {
      key: 'Tools',
      value: [
        {
          key: macroName,
          value: { call: 'MacroOperator', arg: macroEntries }
        }
      ]
    },
    { key: 'ActiveTool', value: macroName }
  ]

  const settingText = serialiseTable(topLevel, 0)

  return {
    files: [
      {
        name: `${template.id}.setting`,
        kind: 'text',
        contents: settingText
      }
    ],
    notes
  }
}
