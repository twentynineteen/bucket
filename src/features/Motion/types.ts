/**
 * Motion Marketplace shared types (issue #327)
 *
 * Every type consumed by more than one file in the module lives here.
 * Internal-only types that never leave a single file stay in that file.
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** Cubic-bezier control points [x1, y1, x2, y2]. x1 and x2 in [0, 1]. */
export type Ease = [number, number, number, number]

/**
 * One keyframe in an animated track.
 * `ease` governs the segment from this key to the next (k -> k+1).
 * The last keyframe in a track may omit `ease`; all others must provide it.
 */
export type Keyframe<V> = { t: number; value: V; ease?: Ease }

/**
 * 2D affine transform as a flat six-element array.
 * [a, b, c, d, tx, ty] - matches the SVG/Canvas matrix convention.
 */
export type Matrix2D = [number, number, number, number, number, number]

// ---------------------------------------------------------------------------
// Template categories and status
// ---------------------------------------------------------------------------

export type MotionCategory =
  'lower-third' | 'title-card' | 'transition' | 'data' | 'accent'

export type MotionStatus = 'stable' | 'experimental'

// ---------------------------------------------------------------------------
// Params
// ---------------------------------------------------------------------------

export interface TextParamDef {
  kind: 'text'
  label: string
  maxLength: number
  default: string
  required: boolean
}

export interface ColourParamDef {
  kind: 'colour'
  label: string
  default: string
  /** Layer paths whose fill this colour binds to. */
  binds: string[]
}

export interface HoldParamDef {
  kind: 'hold'
  label: string
  min: number
  max: number
  default: number
}

export interface NumberListItem {
  label: string
  value: number
}

export interface NumberListParamDef {
  kind: 'numberList'
  label: string
  default: NumberListItem[]
  valueMin: number
  valueMax: number
}

export interface NumberParamDef {
  kind: 'number'
  label: string
  default: number
  min: number
  max: number
}

export interface ImageParamDef {
  kind: 'image'
  label: string
}

export type ParamDef =
  | TextParamDef
  | ColourParamDef
  | HoldParamDef
  | NumberListParamDef
  | NumberParamDef
  | ImageParamDef

export type ImageValue = { sourceName: 'source.png' } | { pickedPath: string }

export type ParamValues = Record<string, string | number | NumberListItem[] | ImageValue>

// ---------------------------------------------------------------------------
// Layers
// ---------------------------------------------------------------------------

export interface Stagger {
  /** Seconds of delay per grapheme cluster. */
  delay: number
}

export interface FontSpec {
  family: string
  style: string
  size: number
}

/** Counter on a text layer - animates a number bound to a `number` param. */
export interface Counter {
  param: string
  decimals: number
  prefix: string
  suffix: string
  progress: Keyframe<number>[]
}

interface LayerBase {
  id: string
  anchor: { x: number; y: number }
  position?: Keyframe<{ x: number; y: number }>[]
  scale?: Keyframe<{ x: number; y: number }>[]
  rotation?: Keyframe<number>[]
  opacity?: Keyframe<number>[]
}

export interface TextLayer extends LayerBase {
  kind: 'text'
  text: string
  param?: string
  font: FontSpec
  align: 'left' | 'center' | 'right'
  lineHeight: number
  multiline: boolean
  fill: string
  fillAnimation?: Keyframe<string>[]
  tracking?: Keyframe<number>[]
  stagger?: Stagger
  counter?: Counter
  width?: number
  wrap?: boolean
  maxLines?: number
}

export interface RectLayer extends LayerBase {
  kind: 'rect'
  width: number
  height: number
  widthAnimation?: Keyframe<number>[]
  heightAnimation?: Keyframe<number>[]
  fill: string
  fillAnimation?: Keyframe<string>[]
  radius: number
}

export interface EllipseLayer extends LayerBase {
  kind: 'ellipse'
  radiusX: number
  radiusY: number
  fill: string
  fillAnimation?: Keyframe<string>[]
}

export interface PathLayer extends LayerBase {
  kind: 'path'
  /** SVG path data (closed, filled, no strokes). */
  d: string
  fill: string
  fillAnimation?: Keyframe<string>[]
}

export interface ArcLayer extends LayerBase {
  kind: 'arc'
  innerRadius: number
  outerRadius: number
  sweep: Keyframe<number>[]
  startAngle: Keyframe<number>[]
  sweepFromParam?: { param: string; max: number }
  fill: string
  fillAnimation?: Keyframe<string>[]
}

export interface GroupLayer extends LayerBase {
  kind: 'group'
  children: Layer[]
}

export interface ParticlesLayer extends LayerBase {
  kind: 'particles'
  points: { x: number; y: number; region?: string }[]
  seed: number
  assembleStart: number
  assembleEnd: number
  baseFill: string
  regionFills: Record<string, string>
  pointRadius: number
  imageParam?: string
}

export interface SeriesSpec {
  param: string
  area: { x: number; y: number; w: number; h: number }
  valueRange: [number, number]
  dot: { radiusX: number; radiusY: number; fill: string }
  connector: { dotSpacing: number; radius: number; fill: string }
  label: {
    font: FontSpec
    fill: string
    align: 'left' | 'center' | 'right'
    offsetY: number
  }
  marker: {
    ellipse: { radiusX: number; radiusY: number; fill: string }
    segmentDuration: number
    ease: Ease
  }
  band?: {
    fromIndex?: number
    toIndex?: number
    hatch: { spacing: number; angle: number; fill: string }
  }
}

export interface SeriesLayer extends LayerBase {
  kind: 'series'
  series: SeriesSpec
}

export type Layer =
  | TextLayer
  | RectLayer
  | EllipseLayer
  | PathLayer
  | ArcLayer
  | GroupLayer
  | ParticlesLayer
  | SeriesLayer

/** A layer after macro expansion - no series remain. Groups are preserved for transform composition. */
export type PrimitiveLayer = Exclude<Layer, SeriesLayer>

/** A leaf layer (no groups, no series). */
export type LeafLayer = Exclude<Layer, GroupLayer | SeriesLayer>

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

export interface MotionTemplate {
  schemaVersion: 1
  id: string
  version: string
  name: string
  description: string
  category: MotionCategory
  status: MotionStatus
  tags: string[]
  fonts: string[]
  primaryTextParam?: string
  credits?: { title: string; author: string; url: string; licence: string }[]
  duration: number
  inEnd: number
  outStart: number
  params: Record<string, ParamDef>
  layers: Layer[]
}

// ---------------------------------------------------------------------------
// Resolved template (after values, expansion, hold shift, scaling, snap)
// ---------------------------------------------------------------------------

export interface ResolvedTemplate {
  id: string
  name: string
  description: string
  category: MotionCategory
  status: MotionStatus
  fonts: string[]
  duration: number
  inEnd: number
  outStart: number
  hasHold: boolean
  layers: PrimitiveLayer[]
  /** The original (unexpanded) template, for the prompt exporter. */
  originalTemplate: MotionTemplate
  /** The resolved param values. */
  values: ParamValues
}

// ---------------------------------------------------------------------------
// Evaluate output
// ---------------------------------------------------------------------------

export interface ShapeLayerState {
  kind: 'rect' | 'ellipse' | 'path' | 'arc'
  id: string
  matrix: Matrix2D
  opacity: number
  fill: string
  size?: { w: number; h: number }
  radius?: number
  /** Ellipse radii in output pixels. */
  radii?: { rx: number; ry: number }
  d?: string
  arc?: {
    innerRadius: number
    outerRadius: number
    sweep: number
    startAngle: number
  }
}

export interface StaggerUnit {
  text: string
  matrix: Matrix2D
  opacity: number
  fill: string
}

export interface TextLayerState {
  kind: 'text'
  id: string
  matrix: Matrix2D
  opacity: number
  fill: string
  text: string
  font: { family: string; style: string; size: number }
  align: 'left' | 'center' | 'right'
  lineHeight: number
  multiline: boolean
  tracking: number
  units?: StaggerUnit[]
}

export interface ParticlesLayerState {
  kind: 'particles'
  id: string
  matrix: Matrix2D
  opacity: number
  points: { x: number; y: number; fill: string; opacity: number }[]
  pointRadius: number
}

export type LayerState = ShapeLayerState | TextLayerState | ParticlesLayerState

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export type MotionTarget = 'ae' | 'resolve' | 'mogrt-via-ae' | 'video' | 'prompt'

export interface MotionFormat {
  width: 3840 | 1920
  height: 2160 | 1080
  fps: 24 | 25 | 30 | 50 | 60
}

export interface ExportInput {
  template: MotionTemplate
  values: ParamValues
  format: MotionFormat
  resolved: ResolvedTemplate
  targets: MotionTarget[]
  mogrt: boolean
}

export type ExportFile =
  | { name: string; kind: 'text'; contents: string }
  | { name: string; kind: 'binary'; bytes: Uint8Array }

export interface ExportResult {
  files: ExportFile[]
  notes: string[]
}

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

export interface CatalogueEntry {
  template: MotionTemplate
  source: 'builtin' | 'library'
  path?: string
}

export interface CatalogueIssue {
  path: string
  message: string
}

// ---------------------------------------------------------------------------
// Render IPC
// ---------------------------------------------------------------------------

export interface MotionRenderRequest {
  outputPath: string
  width: number
  height: number
  fps: number
  totalFrames: number
  ffmpegDirectory: string | null
}

export interface MotionRenderProgress {
  renderId: string
  framesWritten: number
  totalFrames: number
}
