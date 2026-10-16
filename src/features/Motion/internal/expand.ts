/**
 * Macro layer expansion (issue #327)
 *
 * Expands `series`, `sweepFromParam` and `counter` macro layers into ordinary
 * primitives so the evaluator and exporters only ever see flat, primitive layers.
 *
 * Called by `resolve.ts` after param values are applied and before scaling/snap.
 */
import type {
  ArcLayer,
  EllipseLayer,
  Keyframe,
  Layer,
  NumberListItem,
  ParamDef,
  ParamValues,
  PathLayer,
  PrimitiveLayer,
  SeriesSpec,
  TextLayer
} from '../types'

// ---------------------------------------------------------------------------
// Counter formatting
// ---------------------------------------------------------------------------

/**
 * Format a counter value at a given progress.
 *
 * @param progress - 0 to 1 interpolation progress
 * @param value - the param's numeric value
 * @param decimals - decimal places in the output
 * @param prefix - string before the number
 * @param suffix - string after the number
 */
export function formatCounter(
  progress: number,
  value: number,
  decimals: number,
  prefix: string,
  suffix: string
): string {
  const current = progress * value
  return `${prefix}${current.toFixed(decimals)}${suffix}`
}

// ---------------------------------------------------------------------------
// Series expansion
// ---------------------------------------------------------------------------

/** Map a data value to a y coordinate within the area. */
function valueToY(
  value: number,
  valueRange: [number, number],
  area: { y: number; h: number }
): number {
  const [vMin, vMax] = valueRange
  const ratio = vMax === vMin ? 0 : (value - vMin) / (vMax - vMin)
  // y increases downward in template space, so high values map to lower y
  return area.y + area.h * (1 - ratio)
}

/** Distribute N points evenly across the area width. */
function pointX(index: number, count: number, area: { x: number; w: number }): number {
  if (count <= 1) return area.x + area.w / 2
  return area.x + (index / (count - 1)) * area.w
}

/**
 * Compute the distance between two 2D points.
 */
function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2)
}

/** Point computed during series layout. */
interface SeriesPoint {
  x: number
  y: number
  label: string
}

/** Generate connector dot ellipses between adjacent series points. */
function buildConnectorDots(
  pts: SeriesPoint[],
  connector: SeriesSpec['connector'],
  layerId: string,
  anchor: { x: number; y: number }
): EllipseLayer[] {
  const layers: EllipseLayer[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const ax = pts[i].x
    const ay = pts[i].y
    const bx = pts[i + 1].x
    const by = pts[i + 1].y
    const segDist = dist(ax, ay, bx, by)
    if (segDist <= 0) continue
    const count = Math.max(1, Math.floor(segDist / connector.dotSpacing))
    for (let j = 1; j <= count; j++) {
      const t = j / (count + 1)
      layers.push({
        kind: 'ellipse',
        id: `${layerId}-conn-${i}-${j}`,
        anchor,
        position: [{ t: 0, value: { x: ax + t * (bx - ax), y: ay + t * (by - ay) } }],
        radiusX: connector.radius,
        radiusY: connector.radius,
        fill: connector.fill
      } as EllipseLayer)
    }
  }
  return layers
}

/** Generate hatch-band parallelogram paths between two series points. */
function buildHatchBand(
  pts: SeriesPoint[],
  band: NonNullable<SeriesSpec['band']>,
  area: SeriesSpec['area'],
  layerId: string,
  anchor: { x: number; y: number }
): PathLayer[] {
  const fromIdx = band.fromIndex !== undefined ? band.fromIndex : pts.length - 2
  const toIdx = band.toIndex !== undefined ? band.toIndex : pts.length - 1

  if (fromIdx < 0 || toIdx >= pts.length || fromIdx >= toIdx) return []

  const leftX = pts[fromIdx].x
  const rightX = pts[toIdx].x
  const bandTop = Math.min(pts[fromIdx].y, pts[toIdx].y)
  const bandBottom = Math.max(pts[fromIdx].y, pts[toIdx].y)
  const bandHeight = bandBottom - bandTop || area.h * 0.1

  const { spacing, angle, fill: hatchFill } = band.hatch
  const radians = (angle * Math.PI) / 180
  const dx = Math.cos(radians)
  const dy = Math.sin(radians)

  const bandW = rightX - leftX
  if (bandW <= 0 || spacing <= 0) return []

  const layers: PathLayer[] = []
  const lineCount = Math.ceil((bandW + bandHeight) / spacing)
  const clampX = (x: number) => Math.max(leftX, Math.min(rightX, x))
  const clampY = (y: number) => Math.max(bandTop, Math.min(bandBottom, y))

  for (let i = 0; i < lineCount; i++) {
    const offset = i * spacing - bandHeight
    const thickness = spacing * 0.15
    const x0 = leftX + offset * dx
    const x1 = x0 + bandHeight * dy
    const d = [
      `M ${clampX(x0)} ${clampY(bandTop)}`,
      `L ${clampX(x1)} ${clampY(bandBottom)}`,
      `L ${clampX(x1 + thickness * dx)} ${clampY(bandBottom)}`,
      `L ${clampX(x0 + thickness * dx)} ${clampY(bandTop)}`,
      'Z'
    ].join(' ')
    layers.push({
      kind: 'path',
      id: `${layerId}-hatch-${i}`,
      anchor,
      d,
      fill: hatchFill
    } as PathLayer)
  }
  return layers
}

/**
 * Expand a `series` macro layer into primitives: dot ellipses, connector dots,
 * labels, a walking marker and optional hatch-band paths.
 */
function expandSeries(
  series: SeriesSpec,
  items: NumberListItem[],
  layerId: string,
  anchor: { x: number; y: number }
): PrimitiveLayer[] {
  const { area, valueRange, dot, label, marker, band } = series
  const layers: PrimitiveLayer[] = []

  // Compute point positions
  const pts: SeriesPoint[] = items.map((item, i) => ({
    x: pointX(i, items.length, area),
    y: valueToY(item.value, valueRange, area),
    label: item.label
  }))

  // Dot ellipses
  for (let i = 0; i < pts.length; i++) {
    layers.push({
      kind: 'ellipse',
      id: `${layerId}-dot-${i}`,
      anchor,
      position: [{ t: 0, value: { x: pts[i].x, y: pts[i].y } }],
      radiusX: dot.radiusX,
      radiusY: dot.radiusY,
      fill: dot.fill
    } as EllipseLayer)
  }

  // Connector dots between adjacent points
  layers.push(...buildConnectorDots(pts, series.connector, layerId, anchor))

  // Labels
  for (let i = 0; i < pts.length; i++) {
    layers.push({
      kind: 'text',
      id: `${layerId}-label-${i}`,
      anchor,
      position: [{ t: 0, value: { x: pts[i].x, y: pts[i].y + label.offsetY } }],
      text: pts[i].label,
      font: label.font,
      align: label.align,
      lineHeight: 1.2,
      multiline: false,
      fill: label.fill
    } as TextLayer)
  }

  // Walking marker
  if (pts.length > 0) {
    const markerKeyframes: Keyframe<{ x: number; y: number }>[] = pts.map((pt, i) => ({
      t: i * marker.segmentDuration,
      value: { x: pt.x, y: pt.y },
      ...(i < pts.length - 1 ? { ease: marker.ease } : {})
    }))
    layers.push({
      kind: 'ellipse',
      id: `${layerId}-marker`,
      anchor,
      position: markerKeyframes,
      radiusX: marker.ellipse.radiusX,
      radiusY: marker.ellipse.radiusY,
      fill: marker.ellipse.fill
    } as EllipseLayer)
  }

  // Hatch band (closed filled parallelogram paths)
  if (band && pts.length >= 2) {
    layers.push(...buildHatchBand(pts, band, area, layerId, anchor))
  }

  return layers
}

// ---------------------------------------------------------------------------
// Arc sweepFromParam expansion
// ---------------------------------------------------------------------------

/**
 * Expand an arc's `sweepFromParam` binding: sets the final sweep keyframe's
 * value to `paramValue / max`.
 */
function expandArcSweep(
  layer: ArcLayer,
  params: Record<string, ParamDef>,
  values: ParamValues
): ArcLayer {
  if (!layer.sweepFromParam) return layer
  const { param, max } = layer.sweepFromParam
  const paramDef = params[param]
  if (!paramDef || paramDef.kind !== 'number') return layer

  const rawValue = values[param]
  const paramValue = typeof rawValue === 'number' ? rawValue : paramDef.default
  const finalSweep = paramValue / max

  const sweep = [...layer.sweep]
  if (sweep.length > 0) {
    const last = { ...sweep[sweep.length - 1], value: finalSweep }
    sweep[sweep.length - 1] = last
  }

  return { ...layer, sweep, sweepFromParam: undefined }
}

// ---------------------------------------------------------------------------
// Recursive layer expansion
// ---------------------------------------------------------------------------

/**
 * Expand a single layer, returning the primitives it becomes.
 * Groups are preserved (they carry transforms); their children are expanded
 * recursively. Series is fully expanded. Other layers pass through.
 */
function expandLayer(
  layer: Layer,
  params: Record<string, ParamDef>,
  values: ParamValues
): Layer[] {
  switch (layer.kind) {
    case 'series': {
      const paramId = layer.series.param
      const paramDef = params[paramId]
      if (!paramDef || paramDef.kind !== 'numberList') return []
      const rawValue = values[paramId]
      const items: NumberListItem[] = Array.isArray(rawValue)
        ? rawValue
        : paramDef.default
      return expandSeries(layer.series, items, layer.id, layer.anchor)
    }
    case 'arc':
      return [expandArcSweep(layer, params, values)]
    case 'group': {
      const expandedChildren = layer.children.flatMap(child =>
        expandLayer(child, params, values)
      )
      return [{ ...layer, children: expandedChildren }]
    }
    default:
      return [layer]
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Expand all macro layers in a template into primitives.
 *
 * After expansion, the layers contain no `series` layers. `arc` layers with
 * `sweepFromParam` have their final sweep keyframe bound. Groups are preserved
 * (they carry transforms for the evaluator). Counters remain on text layers -
 * the evaluator reads them at runtime.
 */
export function expandTemplate(
  layers: Layer[],
  params: Record<string, ParamDef>,
  values: ParamValues
): Layer[] {
  return layers.flatMap(layer => expandLayer(layer, params, values))
}
