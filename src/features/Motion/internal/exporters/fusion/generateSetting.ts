/**
 * DaVinci Resolve Fusion .setting exporter (issue #330)
 *
 * Generates a Fusion title macro (Lua table text) from a resolved template.
 * Values are baked in; text and colour params are exposed as InstanceInputs
 * so they stay editable in the Inspector.
 *
 * Tool chain: shape tools (sRectangle, sEllipse, sPolygon) -> sMerge -> sRender
 * -> Merge with Text+ tools (and Background tools for fallback layers).
 * Group transforms become image Transform tools after the sRender, not sTransform.
 *
 * sPolygon bezier handles: UNVERIFIED. This exporter assumes sPolygon does NOT
 * accept explicit bezier handles (could not be confirmed in Resolve). Paths with
 * bezier curves and hatch bands fall back to a Polygon mask on a Background tool.
 * Flagged for manual verification in #339.
 *
 * Follower fractional delay: UNVERIFIED. This exporter rounds fractional frame
 * delays to the nearest integer >= 1 frame. Flagged for manual verification in #339.
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
import { toFusionKeyframes, type FusionKeyframe } from './bezierSpline'
import {
  toFusionRotation,
  toFusionSize,
  toImageCoords,
  toShapeCoords
} from './fusionCoords'
import { escapeLuaString } from './luaString'

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

function resetSplineCounter(): void {
  splineCounter = 0
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
// Hex colour helpers
// ---------------------------------------------------------------------------

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '')
  return {
    r: parseInt(clean.slice(0, 2), 16) / 255,
    g: parseInt(clean.slice(2, 4), 16) / 255,
    b: parseInt(clean.slice(4, 6), 16) / 255
  }
}

// ---------------------------------------------------------------------------
// SVG path parsing (minimal, for sPolygon points)
// ---------------------------------------------------------------------------

interface PathPoint {
  x: number
  y: number
}

/** Check whether an SVG path has bezier curve commands (C, c, S, s, Q, q, T, t, A, a). */
function pathHasBezierCurves(d: string): boolean {
  return /[CcSsQqTtAa]/.test(d)
}

/** Extract linear polygon points from an M/L/Z only SVG path. */
function parseLinearPath(d: string): PathPoint[] {
  const points: PathPoint[] = []
  const tokens = d.match(/[MLZmlz]|[-+]?\d*\.?\d+/g) || []
  let cmd = ''
  let cx = 0
  let cy = 0
  let i = 0

  while (i < tokens.length) {
    const t = tokens[i]
    if (/^[MLZmlz]$/.test(t)) {
      cmd = t
      i++
      if (cmd === 'Z' || cmd === 'z') continue
    }

    if (cmd === 'M' || cmd === 'L') {
      cx = parseFloat(tokens[i])
      cy = parseFloat(tokens[i + 1])
      points.push({ x: cx, y: cy })
      i += 2
      if (cmd === 'M') cmd = 'L' // implicit L after M
    } else if (cmd === 'm' || cmd === 'l') {
      cx += parseFloat(tokens[i])
      cy += parseFloat(tokens[i + 1])
      points.push({ x: cx, y: cy })
      i += 2
      if (cmd === 'm') cmd = 'l'
    } else {
      i++
    }
  }
  return points
}

// ---------------------------------------------------------------------------
// Tool builders for each layer kind
// ---------------------------------------------------------------------------

function buildShapeInputs(
  layer: PrimitiveLayer,
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
      return buildPolygonInputs(layer, w, h)
    default:
      return []
  }
}

function buildRectInputs(
  layer: RectLayer,
  w: number,
  h: number,
  fps: number,
  tools: FusionTool[]
): LuaEntry[] {
  const pos = toShapeCoords(
    layer.position?.[0]?.value.x ?? layer.anchor.x,
    layer.position?.[0]?.value.y ?? layer.anchor.y,
    w,
    h
  )
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

  return inputs
}

function buildEllipseInputs(
  layer: EllipseLayer,
  w: number,
  h: number,
  fps: number,
  tools: FusionTool[]
): LuaEntry[] {
  const pos = toShapeCoords(
    layer.position?.[0]?.value.x ?? layer.anchor.x,
    layer.position?.[0]?.value.y ?? layer.anchor.y,
    w,
    h
  )
  const inputs: LuaEntry[] = [
    staticInput('Width', toFusionSize(layer.radiusX * 2, w)),
    staticInput('Height', toFusionSize(layer.radiusY * 2, w)),
    staticInput('XOffset', pos.x),
    staticInput('YOffset', pos.y)
  ]

  // Animated position -> separate XOffset/YOffset BezierSplines
  if (layer.position && layer.position.length > 1) {
    const xKfs = layer.position.map(kf => ({
      t: kf.t,
      value: toShapeCoords(kf.value.x, kf.value.y, w, h).x,
      ease: kf.ease
    }))
    const yKfs = layer.position.map(kf => ({
      t: kf.t,
      value: toShapeCoords(kf.value.x, kf.value.y, w, h).y,
      ease: kf.ease
    }))
    // Replace static XOffset/YOffset with animated
    const filtered = inputs.filter(e => e.key !== 'XOffset' && e.key !== 'YOffset')
    filtered.push(animatedNumberInput(layer.id, 'XOffset', xKfs, fps, tools))
    filtered.push(animatedNumberInput(layer.id, 'YOffset', yKfs, fps, tools))
    return filtered
  }

  return inputs
}

function buildArcInputs(
  layer: ArcLayer,
  w: number,
  h: number,
  fps: number,
  tools: FusionTool[]
): LuaEntry[] {
  const pos = toShapeCoords(layer.anchor.x, layer.anchor.y, w, h)
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

  return inputs
}

function buildPolygonInputs(layer: PathLayer, w: number, h: number): LuaEntry[] {
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

  return [
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

function buildTextTool(
  layer: TextLayer,
  format: MotionFormat,
  fps: number,
  tools: FusionTool[]
): FusionTool {
  const pos = toImageCoords(
    layer.position?.[0]?.value.x ?? layer.anchor.x,
    layer.position?.[0]?.value.y ?? layer.anchor.y,
    format.width,
    format.height
  )

  // Alignment: Fusion Text+ uses 0 = center, -1 = left, 1 = right
  const justification = layer.align === 'left' ? 0 : layer.align === 'right' ? 1 : 0.5

  const textInputs: LuaEntry[] = [
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

  // Opacity
  if (layer.opacity && layer.opacity.length > 1) {
    textInputs.push(
      animatedNumberInput(
        toolName(layer.id, 'text'),
        'Opacity',
        layer.opacity,
        fps,
        tools
      )
    )
  } else if (layer.opacity && layer.opacity.length === 1) {
    textInputs.push(staticInput('Opacity', layer.opacity[0].value))
  }

  // Tracking
  if (layer.tracking && layer.tracking.length > 1) {
    textInputs.push(
      animatedNumberInput(
        toolName(layer.id, 'text'),
        'Tracking',
        layer.tracking,
        fps,
        tools
      )
    )
  } else if (layer.tracking && layer.tracking.length === 1) {
    textInputs.push(staticInput('Tracking', layer.tracking[0].value))
  }

  // Fill colour
  const rgb = hexToRgb(layer.fill)
  textInputs.push(staticInput('Red1', rgb.r))
  textInputs.push(staticInput('Green1', rgb.g))
  textInputs.push(staticInput('Blue1', rgb.b))

  // Fill colour animation
  const fillAnim = buildFillColourAnimation(layer, toolName(layer.id, 'text'), fps, tools)
  if (fillAnim) {
    // Replace static RGB with animated
    const filtered = textInputs.filter(
      e => e.key !== 'Red1' && e.key !== 'Green1' && e.key !== 'Blue1'
    )
    filtered.push(fillAnim.r)
    filtered.push(fillAnim.g)
    filtered.push(fillAnim.b)
    return {
      name: toolName(layer.id, 'text'),
      type: 'TextPlus',
      entries: [{ key: 'Inputs', value: filtered }]
    }
  }

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

interface StaggerResult {
  delayFrames: number
  rounded: boolean
  originalFrames: number
}

function computeStaggerDelay(delaySeconds: number, fps: number): StaggerResult {
  const raw = delaySeconds * fps
  if (Number.isInteger(raw) && raw >= 1) {
    return { delayFrames: raw, rounded: false, originalFrames: raw }
  }
  const rounded = Math.max(1, Math.round(raw))
  return { delayFrames: rounded, rounded: raw !== rounded, originalFrames: raw }
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

interface ProcessedLayers {
  shapeTools: FusionTool[]
  textTools: FusionTool[]
  fallbackTools: FusionTool[]
  splineTools: FusionTool[]
}

/** Determine if a path layer needs the Background fallback. */
function pathNeedsFallback(layer: PathLayer): boolean {
  return pathHasBezierCurves(layer.d)
}

/** Check if a path layer is a hatch band (from expand.ts series expansion). */
function isHatchBand(layer: PrimitiveLayer): boolean {
  return layer.kind === 'path' && layer.id.includes('-hatch-')
}

function processLayer(
  layer: PrimitiveLayer,
  format: MotionFormat,
  result: ProcessedLayers,
  notes: string[],
  values: Record<string, unknown>
): void {
  const w = format.width
  const h = format.height
  const fps = format.fps

  switch (layer.kind) {
    case 'text': {
      let textTool: FusionTool
      if (layer.counter) {
        textTool = buildCounterTextTool(layer, format, fps, result.splineTools, values)
      } else {
        textTool = buildTextTool(layer, format, fps, result.splineTools)
      }

      // Stagger / Follower
      if (layer.stagger) {
        const stagger = computeStaggerDelay(layer.stagger.delay, fps)
        if (stagger.rounded) {
          notes.push(
            `Stagger delay was rounded from ${stagger.originalFrames.toFixed(2)} ` +
              `to ${stagger.delayFrames} frame(s) for Resolve Follower compatibility`
          )
        }
        result.splineTools.push(buildFollowerModifier(textTool.name, stagger.delayFrames))
      }

      result.textTools.push(textTool)
      break
    }

    case 'rect':
    case 'ellipse':
    case 'arc': {
      const shapeName = toolName(layer.id, 'shape')
      const shapeType = layer.kind === 'rect' ? 'sRectangle' : 'sEllipse'

      const inputs = buildShapeInputs(layer, format, result.splineTools)

      // Opacity animation on shape
      if (layer.opacity && layer.opacity.length > 1) {
        inputs.push(
          animatedNumberInput(
            shapeName,
            'Opacity',
            layer.opacity,
            fps,
            result.splineTools
          )
        )
      } else if (layer.opacity && layer.opacity.length === 1) {
        inputs.push(staticInput('Opacity', layer.opacity[0].value))
      }

      const fillInputs = buildShapeFillInputs(layer, shapeName, fps, result.splineTools)

      result.shapeTools.push({
        name: shapeName,
        type: shapeType,
        entries: [
          {
            key: 'Inputs',
            value: [...inputs, ...fillInputs]
          }
        ]
      })
      break
    }

    case 'path': {
      if (isHatchBand(layer) || pathNeedsFallback(layer)) {
        // Fallback: Polygon mask on Background
        const fallback = buildPathFallback(layer, w, h, luaIdent(layer.id))
        result.fallbackTools.push(...fallback)
      } else {
        // Simple polygon -> sPolygon
        const shapeName = toolName(layer.id, 'shape')
        const inputs = buildShapeInputs(layer, format, result.splineTools)
        const fillInputs = buildShapeFillInputs(layer, shapeName, fps, result.splineTools)
        result.shapeTools.push({
          name: shapeName,
          type: 'sPolygon',
          entries: [
            {
              key: 'Inputs',
              value: [...inputs, ...fillInputs]
            }
          ]
        })
      }
      break
    }

    case 'group':
      processGroup(layer as GroupLayer, format, result, notes, values)
      break

    case 'particles':
      // Should have been rejected earlier
      break
  }
}

function processGroup(
  group: GroupLayer,
  format: MotionFormat,
  result: ProcessedLayers,
  notes: string[],
  values: Record<string, unknown>
): void {
  // Process children
  for (const child of group.children as PrimitiveLayer[]) {
    processLayer(child, format, result, notes, values)
  }

  // If the group has a transform, add an image Transform tool
  const hasTransform =
    (group.position && group.position.length > 0) ||
    (group.scale && group.scale.length > 0) ||
    (group.rotation && group.rotation.length > 0)

  if (hasTransform) {
    const transformName = toolName(group.id, 'transform')
    const pos = group.position?.[0]
      ? toImageCoords(
          group.position[0].value.x,
          group.position[0].value.y,
          format.width,
          format.height
        )
      : { x: 0.5, y: 0.5 }

    const transformInputs: LuaEntry[] = [
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
      }
    ]

    if (group.scale && group.scale.length > 0) {
      transformInputs.push(staticInput('Size', group.scale[0].value.x))
    }

    if (group.rotation && group.rotation.length > 0) {
      transformInputs.push(
        staticInput('Angle', toFusionRotation(group.rotation[0].value))
      )
    }

    result.splineTools.push({
      name: transformName,
      type: 'Transform',
      entries: [{ key: 'Inputs', value: transformInputs }]
    })
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

function buildInstanceInputs(
  template: MotionTemplate,
  layers: PrimitiveLayer[],
  textTools: FusionTool[]
): InstanceInputDef[] {
  const inputs: InstanceInputDef[] = []

  for (const [paramId, paramDef] of Object.entries(template.params)) {
    if (paramDef.kind === 'text') {
      // Find the Text+ tool that corresponds to this param
      const textLayer = findTextLayerForParam(paramId, layers)
      if (textLayer) {
        const toolName = textLayer.id + '_text'
        const tool = textTools.find(t => t.name === toolName)
        if (tool) {
          inputs.push({
            entry: {
              key: paramId,
              value: {
                call: 'InstanceInput',
                arg: [
                  { key: 'SourceOp', value: toolName },
                  { key: 'Source', value: 'StyledText' },
                  { key: 'Name', value: paramDef.label },
                  { key: 'Default', value: paramDef.default }
                ]
              }
            },
            targetTool: toolName,
            targetSource: 'StyledText'
          })
        }
      }
    } else if (paramDef.kind === 'colour') {
      // Expose R, G, B channels
      buildColourInstanceInputs(paramId, paramDef, layers, textTools, inputs)
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

function buildColourInstanceInputs(
  paramId: string,
  paramDef: ParamDef & { kind: 'colour' },
  _layers: PrimitiveLayer[],
  _textTools: FusionTool[],
  inputs: InstanceInputDef[]
): void {
  // Colour params bind to fills. We expose the background's RGB.
  // For simplicity, use the first bound layer's shape tool.
  const channels = ['Red', 'Green', 'Blue'] as const
  for (const channel of channels) {
    inputs.push({
      entry: {
        key: `${paramId}_${channel}`,
        value: {
          call: 'InstanceInput',
          arg: [
            { key: 'SourceOp', value: luaIdent(`${paramId}_colour_bg`) },
            { key: 'Source', value: `TopLeft${channel}` },
            { key: 'Name', value: `${paramDef.label} ${channel}` }
          ]
        }
      },
      targetTool: luaIdent(`${paramId}_colour_bg`),
      targetSource: `TopLeft${channel}`
    })
  }
}

// ---------------------------------------------------------------------------
// Build colour Background tools for exposed colour params
// ---------------------------------------------------------------------------

function buildColourBackgrounds(
  template: MotionTemplate,
  values: Record<string, unknown>
): FusionTool[] {
  const tools: FusionTool[] = []
  for (const [paramId, paramDef] of Object.entries(template.params)) {
    if (paramDef.kind === 'colour') {
      const colourVal =
        typeof values[paramId] === 'string'
          ? (values[paramId] as string)
          : paramDef.default
      const rgb = hexToRgb(colourVal)
      tools.push({
        name: luaIdent(`${paramId}_colour_bg`),
        type: 'Background',
        entries: [
          {
            key: 'Inputs',
            value: [
              staticInput('TopLeftRed', rgb.r),
              staticInput('TopLeftGreen', rgb.g),
              staticInput('TopLeftBlue', rgb.b),
              staticInput('TopLeftAlpha', 1)
            ]
          }
        ]
      })
    }
  }
  return tools
}

// ---------------------------------------------------------------------------
// Merge chain
// ---------------------------------------------------------------------------

function buildMergeChain(
  shapeTools: FusionTool[],
  textTools: FusionTool[],
  fallbackTools: FusionTool[],
  transformTools: FusionTool[],
  colourBgTools: FusionTool[]
): FusionTool[] {
  const mergeTools: FusionTool[] = []

  // 1. Chain shapes through sMerge
  let shapeMergeOutput: string | null = null
  if (shapeTools.length > 0) {
    if (shapeTools.length === 1) {
      // Single shape -> sMerge -> sRender
      const smergeName = 'shape_smerge'
      mergeTools.push({
        name: smergeName,
        type: 'sMerge',
        entries: [
          {
            key: 'Inputs',
            value: [
              {
                key: 'Background',
                value: {
                  call: 'Input',
                  arg: [
                    { key: 'SourceOp', value: shapeTools[0].name },
                    { key: 'Source', value: 'Output' }
                  ]
                }
              }
            ]
          }
        ]
      })
      shapeMergeOutput = smergeName
    } else {
      // Chain multiple shapes through sMerges
      let prevMerge = ''
      for (let i = 0; i < shapeTools.length; i++) {
        const smergeName = `shape_smerge_${i + 1}`
        const inputs: LuaEntry[] = []

        if (i === 0) {
          inputs.push({
            key: 'Background',
            value: {
              call: 'Input',
              arg: [
                { key: 'SourceOp', value: shapeTools[0].name },
                { key: 'Source', value: 'Output' }
              ]
            }
          })
          if (shapeTools.length > 1) {
            inputs.push({
              key: 'Foreground',
              value: {
                call: 'Input',
                arg: [
                  { key: 'SourceOp', value: shapeTools[1].name },
                  { key: 'Source', value: 'Output' }
                ]
              }
            })
          }
          mergeTools.push({
            name: smergeName,
            type: 'sMerge',
            entries: [{ key: 'Inputs', value: inputs }]
          })
          prevMerge = smergeName
          i++ // consumed two shapes
        } else {
          inputs.push({
            key: 'Background',
            value: {
              call: 'Input',
              arg: [
                { key: 'SourceOp', value: prevMerge },
                { key: 'Source', value: 'Output' }
              ]
            }
          })
          inputs.push({
            key: 'Foreground',
            value: {
              call: 'Input',
              arg: [
                { key: 'SourceOp', value: shapeTools[i].name },
                { key: 'Source', value: 'Output' }
              ]
            }
          })
          mergeTools.push({
            name: smergeName,
            type: 'sMerge',
            entries: [{ key: 'Inputs', value: inputs }]
          })
          prevMerge = smergeName
        }
      }
      shapeMergeOutput = prevMerge
    }

    // sRender
    const sRenderName = 'shape_srender'
    mergeTools.push({
      name: sRenderName,
      type: 'sRender',
      entries: [
        {
          key: 'Inputs',
          value: [
            {
              key: 'Background',
              value: {
                call: 'Input',
                arg: [
                  { key: 'SourceOp', value: shapeMergeOutput },
                  { key: 'Source', value: 'Output' }
                ]
              }
            }
          ]
        }
      ]
    })

    shapeMergeOutput = sRenderName
  }

  // Apply group transform if present
  const transform = transformTools.find(t => t.type === 'Transform')
  if (transform && shapeMergeOutput) {
    // Connect transform input to shape render output
    const transformInputs = transform.entries.find(e => e.key === 'Inputs')
    if (transformInputs && Array.isArray(transformInputs.value)) {
      ;(transformInputs.value as LuaEntry[]).unshift({
        key: 'Input',
        value: {
          call: 'Input',
          arg: [
            { key: 'SourceOp', value: shapeMergeOutput },
            { key: 'Source', value: 'Output' }
          ]
        }
      })
    }
    mergeTools.push(transform)
    shapeMergeOutput = transform.name
  }

  // 2. Build the image-level Merge chain
  // Collect all image outputs to merge: shape render, text tools, fallback backgrounds, colour bgs
  const imageOutputs: string[] = []
  if (shapeMergeOutput) imageOutputs.push(shapeMergeOutput)
  for (const ft of fallbackTools) {
    if (ft.type === 'Background') imageOutputs.push(ft.name)
  }
  for (const cb of colourBgTools) {
    imageOutputs.push(cb.name)
  }
  for (const tt of textTools) {
    imageOutputs.push(tt.name)
  }

  if (imageOutputs.length <= 1) {
    // No merging needed
    return mergeTools
  }

  // Chain image outputs through Merge nodes
  let prevOutput = imageOutputs[0]
  for (let i = 1; i < imageOutputs.length; i++) {
    const mergeName = `merge_${i}`
    mergeTools.push({
      name: mergeName,
      type: 'Merge',
      entries: [
        {
          key: 'Inputs',
          value: [
            {
              key: 'Background',
              value: {
                call: 'Input',
                arg: [
                  { key: 'SourceOp', value: prevOutput },
                  { key: 'Source', value: 'Output' }
                ]
              }
            },
            {
              key: 'Foreground',
              value: {
                call: 'Input',
                arg: [
                  { key: 'SourceOp', value: imageOutputs[i] },
                  { key: 'Source', value: 'Output' }
                ]
              }
            }
          ]
        }
      ]
    })
    prevOutput = mergeName
  }

  return mergeTools
}

// ---------------------------------------------------------------------------
// Check for particles
// ---------------------------------------------------------------------------

function hasParticlesLayer(layers: PrimitiveLayer[]): boolean {
  for (const layer of layers) {
    if (layer.kind === 'particles') return true
    if (layer.kind === 'group') {
      if (hasParticlesLayer((layer as GroupLayer).children as PrimitiveLayer[])) {
        return true
      }
    }
  }
  return false
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
  if (hasParticlesLayer(resolved.layers)) {
    throw new Error(
      'Particle templates export only Video and Claude prompt, not Resolve .setting'
    )
  }

  resetSplineCounter()

  // Process layers
  const processed: ProcessedLayers = {
    shapeTools: [],
    textTools: [],
    fallbackTools: [],
    splineTools: []
  }

  for (const layer of resolved.layers) {
    processLayer(layer, format, processed, notes, resolved.values)
  }

  // Build colour background tools for exposed colour params
  const colourBgTools = buildColourBackgrounds(template, resolved.values)

  // Build instance inputs
  const instanceInputs = buildInstanceInputs(
    template,
    resolved.layers,
    processed.textTools
  )

  // Build merge chain
  const mergeTools = buildMergeChain(
    processed.shapeTools,
    processed.textTools,
    processed.fallbackTools,
    processed.splineTools.filter(t => t.type === 'Transform'),
    colourBgTools
  )

  // Find the final output tool
  const allToolNames = [
    ...processed.shapeTools.map(t => t.name),
    ...processed.textTools.map(t => t.name),
    ...processed.fallbackTools.map(t => t.name),
    ...mergeTools.map(t => t.name),
    ...colourBgTools.map(t => t.name)
  ]
  const lastMerge = mergeTools.filter(t => t.type === 'Merge').pop()
  const finalOutput =
    lastMerge?.name ?? allToolNames[allToolNames.length - 1] ?? template.id

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
    ...processed.shapeTools,
    ...processed.textTools,
    ...processed.fallbackTools,
    ...colourBgTools,
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
