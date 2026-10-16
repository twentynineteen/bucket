/**
 * After Effects .jsx exporter (issue #329)
 *
 * Pure function: takes an ExportInput (template, resolved values, format,
 * already scaled and frame-snapped by resolve.ts) and returns an ExportResult
 * containing the .jsx text file and optional notes. Never writes files.
 *
 * The generated script is ES3-only ExtendScript, ASCII-only, wrapped in
 * beginUndoGroup/endUndoGroup, with no JSON object references.
 */

import type {
  ArcLayer,
  EllipseLayer,
  ExportInput,
  ExportResult,
  Keyframe,
  PathLayer,
  PrimitiveLayer,
  RectLayer,
  TextLayer
} from '../../../types'
import { EASE_DIMENSIONS, mapEase } from './aeEase'
import { jsStringLiteral } from './jsString'

// ---------------------------------------------------------------------------
// Context carried through the generation
// ---------------------------------------------------------------------------

interface GenContext {
  width: number
  height: number
  duration: number
  fps: number
  missingFontVar: string
  mogrt: boolean
  paramLabels: Record<string, { kind: string; label: string }>
  lines: string[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hexToAEColour(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return '[' + r + ', ' + g + ', ' + b + ', 1]'
}

function layerVar(id: string, suffix?: string): string {
  const safe = id.replace(/[^a-zA-Z0-9_]/g, '_')
  return suffix ? safe + '_' + suffix : safe
}

function compVar(id: string): string {
  return 'comp_' + id.replace(/[^a-zA-Z0-9_]/g, '_')
}

// ---------------------------------------------------------------------------
// Ease code generation
// ---------------------------------------------------------------------------

function emitEase(
  propExpr: string,
  keyframes: Array<{
    t: number
    value: unknown
    ease?: [number, number, number, number]
  }>,
  aePropName: string,
  delta: (i: number) => number
): string[] {
  const lines: string[] = []
  const dims = EASE_DIMENSIONS[aePropName] ?? 1

  for (let i = 0; i < keyframes.length - 1; i++) {
    const ease = keyframes[i].ease
    if (!ease) continue

    const d = delta(i)
    const pair = mapEase(ease, Math.abs(d), dims)

    const outArr = pair.outgoing
      .map(e => 'new KeyframeEase(' + e.speed + ', ' + e.influence + ')')
      .join(', ')
    const inArr = pair.incoming
      .map(e => 'new KeyframeEase(' + e.speed + ', ' + e.influence + ')')
      .join(', ')

    lines.push(
      propExpr +
        '.setTemporalEaseAtKey(' +
        (i + 1) +
        ', [' +
        outArr +
        '], [' +
        outArr +
        ']);'
    )
    lines.push(
      propExpr +
        '.setTemporalEaseAtKey(' +
        (i + 2) +
        ', [' +
        inArr +
        '], [' +
        inArr +
        ']);'
    )
  }
  return lines
}

function numericDelta(kfs: Array<{ t: number; value: number }>, i: number): number {
  const dt = kfs[i + 1].t - kfs[i].t
  if (dt === 0) return 0
  return (kfs[i + 1].value - kfs[i].value) / dt
}

function positionDelta(
  kfs: Array<{ t: number; value: { x: number; y: number } }>,
  i: number
): number {
  const dt = kfs[i + 1].t - kfs[i].t
  if (dt === 0) return 0
  const dx = kfs[i + 1].value.x - kfs[i].value.x
  const dy = kfs[i + 1].value.y - kfs[i].value.y
  return Math.sqrt(dx * dx + dy * dy) / dt
}

function colourDelta(kfs: Array<{ t: number; value: string }>, i: number): number {
  const dt = kfs[i + 1].t - kfs[i].t
  if (dt === 0) return 0
  function parse(hex: string): [number, number, number] {
    return [
      parseInt(hex.slice(1, 3), 16) / 255,
      parseInt(hex.slice(3, 5), 16) / 255,
      parseInt(hex.slice(5, 7), 16) / 255
    ]
  }
  const a = parse(kfs[i].value)
  const b = parse(kfs[i + 1].value)
  return Math.sqrt((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2 + (b[2] - a[2]) ** 2) / dt
}

function scaleDelta(
  kfs: Array<{ t: number; value: { x: number; y: number } }>,
  i: number
): number {
  const dt = kfs[i + 1].t - kfs[i].t
  if (dt === 0) return 0
  const dx = (kfs[i + 1].value.x - kfs[i].value.x) * 100
  const dy = (kfs[i + 1].value.y - kfs[i].value.y) * 100
  return Math.sqrt(dx * dx + dy * dy) / dt
}

function rectSizeDelta(
  kfs: Array<{ t: number; value: number }>,
  i: number,
  otherKfs?: Array<{ t: number; value: number }>
): number {
  const dt = kfs[i + 1].t - kfs[i].t
  if (dt === 0) return 0
  const dw = kfs[i + 1].value - kfs[i].value
  let dh = 0
  if (otherKfs && otherKfs[i] && otherKfs[i + 1]) {
    dh = otherKfs[i + 1].value - otherKfs[i].value
  }
  return Math.sqrt(dw * dw + dh * dh) / dt
}

// ---------------------------------------------------------------------------
// Transform properties
// ---------------------------------------------------------------------------

function emitPositionKeyframes(
  kfs: Keyframe<{ x: number; y: number }>[],
  vName: string,
  lines: string[]
): void {
  const propExpr = vName + '.transform.position'
  for (let i = 0; i < kfs.length; i++) {
    lines.push(
      propExpr +
        '.setValueAtTime(' +
        kfs[i].t +
        ', [' +
        kfs[i].value.x +
        ', ' +
        kfs[i].value.y +
        ']);'
    )
  }
  for (let j = 1; j <= kfs.length; j++) {
    lines.push(propExpr + '.setSpatialTangentsAtKey(' + j + ', [0, 0], [0, 0]);')
  }
  lines.push(
    ...emitEase(
      propExpr,
      kfs as Array<{
        t: number
        value: unknown
        ease?: [number, number, number, number]
      }>,
      'Position',
      i => positionDelta(kfs, i)
    )
  )
}

function emitScaleKeyframes(
  kfs: Keyframe<{ x: number; y: number }>[],
  vName: string,
  lines: string[]
): void {
  const propExpr = vName + '.transform.scale'
  for (let i = 0; i < kfs.length; i++) {
    lines.push(
      propExpr +
        '.setValueAtTime(' +
        kfs[i].t +
        ', [' +
        kfs[i].value.x * 100 +
        ', ' +
        kfs[i].value.y * 100 +
        ', 100]);'
    )
  }
  lines.push(
    ...emitEase(
      propExpr,
      kfs as Array<{
        t: number
        value: unknown
        ease?: [number, number, number, number]
      }>,
      'Scale',
      i => scaleDelta(kfs, i)
    )
  )
}

function emitNumericKeyframes(
  kfs: Array<{
    t: number
    value: number
    ease?: [number, number, number, number]
  }>,
  propExpr: string,
  aePropName: string,
  lines: string[],
  deltaFn: (i: number) => number
): void {
  for (let i = 0; i < kfs.length; i++) {
    lines.push(propExpr + '.setValueAtTime(' + kfs[i].t + ', ' + kfs[i].value + ');')
  }
  lines.push(...emitEase(propExpr, kfs, aePropName, deltaFn))
}

function emitTransformProperties(
  layer: PrimitiveLayer,
  vName: string,
  lines: string[]
): void {
  if (layer.position && layer.position.length > 0) {
    emitPositionKeyframes(layer.position, vName, lines)
  }
  if (layer.scale && layer.scale.length > 0) {
    emitScaleKeyframes(layer.scale, vName, lines)
  }
  if (layer.rotation && layer.rotation.length > 0) {
    emitNumericKeyframes(
      layer.rotation,
      vName + '.transform.rotation',
      'Rotation',
      lines,
      idx => numericDelta(layer.rotation as Keyframe<number>[], idx)
    )
  }
  if (layer.opacity && layer.opacity.length > 0) {
    const opacityKfs = layer.opacity.map(kf => ({
      ...kf,
      value: kf.value * 100
    }))
    emitNumericKeyframes(
      opacityKfs,
      vName + '.transform.opacity',
      'Opacity',
      lines,
      idx => numericDelta(opacityKfs, idx)
    )
  }
}

// ---------------------------------------------------------------------------
// Font
// ---------------------------------------------------------------------------

function fontToPostScript(font: { family: string; style: string }): string {
  const family = font.family.replace(/\s/g, '')
  const style = font.style.replace(/\s/g, '')
  if (family === 'CabritoSemi' && style === 'NormBold') {
    return 'CabritoSemi-NorBol'
  }
  return family + '-' + style
}

// ---------------------------------------------------------------------------
// Text layer
// ---------------------------------------------------------------------------

function emitTextLayer(
  layer: TextLayer,
  compExpr: string,
  missingFontVar: string,
  mogrt: boolean,
  paramLabels: Record<string, { kind: string; label: string }>,
  lines: string[]
): string {
  const v = layerVar(layer.id, 'layer')
  lines.push('var ' + v + ' = ' + compExpr + '.addTextLayer();')
  lines.push(v + '.name = ' + jsStringLiteral(layer.id) + ';')

  const psName = fontToPostScript(layer.font)
  const fontExpr =
    '(' +
    missingFontVar +
    '.indexOf(' +
    jsStringLiteral(psName) +
    ') >= 0 ? "ArialMT" : ' +
    jsStringLiteral(psName) +
    ')'

  const textForAE = layer.text.replace(/\n/g, '\r')
  lines.push(v + '.sourceText.setValue(' + jsStringLiteral(textForAE) + ');')

  const docVar = layerVar(layer.id, 'doc')
  lines.push('var ' + docVar + ' = ' + v + '.sourceText.value;')
  lines.push(docVar + '.font = ' + fontExpr + ';')
  lines.push(docVar + '.fontSize = ' + layer.font.size + ';')
  lines.push(docVar + '.fillColor = ' + hexToAEColour(layer.fill) + ';')

  const justMap: Record<string, string> = {
    left: 'ParagraphJustification.LEFT_JUSTIFY',
    center: 'ParagraphJustification.CENTER_JUSTIFY',
    right: 'ParagraphJustification.RIGHT_JUSTIFY'
  }
  lines.push(docVar + '.justification = ' + justMap[layer.align] + ';')

  const leading = layer.lineHeight * layer.font.size
  lines.push(docVar + '.leading = ' + leading + ';')

  if (layer.multiline && layer.width) {
    lines.push(docVar + '.boxText = true;')
    lines.push(docVar + '.boxTextSize = [' + layer.width + ', ' + leading * 10 + '];')
  }

  lines.push(v + '.sourceText.setValue(' + docVar + ');')

  lines.push(v + '.__meta = {};')
  lines.push(v + '.__meta.font = ' + fontExpr + ';')
  lines.push(v + '.__meta.justification = ' + jsStringLiteral(layer.align) + ';')
  lines.push(v + '.__meta.leading = ' + leading + ';')
  lines.push(
    v +
      '.__meta.textKind = ' +
      jsStringLiteral(layer.multiline && layer.width ? 'box' : 'point') +
      ';'
  )

  emitTransformProperties(layer, v, lines)

  if (layer.tracking && layer.tracking.length > 0) {
    emitTrackingAnimator(layer, v, lines)
  }

  if (layer.counter) {
    emitCounter(layer, v, lines)
  }

  if (mogrt && layer.param && paramLabels[layer.param]) {
    lines.push(
      v +
        '.__meta.essentialProp = ' +
        jsStringLiteral(paramLabels[layer.param].label) +
        ';'
    )
  }

  return v
}

// ---------------------------------------------------------------------------
// Tracking animator and stagger
// ---------------------------------------------------------------------------

function emitTrackingAnimator(layer: TextLayer, vName: string, lines: string[]): void {
  const tracking = layer.tracking!
  const animVar = layerVar(layer.id, 'anim')
  lines.push('var ' + animVar + ' = ' + vName + '.addAnimator("ADBE Text Animator");')

  const trackVar = layerVar(layer.id, 'track')
  lines.push('var ' + trackVar + ' = ' + animVar + '.addProperty("Tracking Amount");')

  for (let i = 0; i < tracking.length; i++) {
    lines.push(
      trackVar + '.setValueAtTime(' + tracking[i].t + ', ' + tracking[i].value + ');'
    )
  }

  lines.push(
    ...emitEase(
      trackVar,
      tracking as Array<{
        t: number
        value: unknown
        ease?: [number, number, number, number]
      }>,
      'Tracking Amount',
      idx => numericDelta(tracking, idx)
    )
  )

  if (layer.stagger) {
    const delay = layer.stagger.delay
    const selVar = layerVar(layer.id, 'sel')
    lines.push(
      'var ' + selVar + ' = ' + animVar + '.addSelector("ADBE Text Expressn Selector");'
    )

    const exprStr =
      'var d = (textIndex - 1) * ' +
      delay +
      '; ' +
      'var t = time - d; ' +
      'if (t < 0) { 0; } else { 100; }'

    lines.push(selVar + '.expression = ' + jsStringLiteral(exprStr) + ';')
  }
}

// ---------------------------------------------------------------------------
// Counter
// ---------------------------------------------------------------------------

function emitCounter(layer: TextLayer, vName: string, lines: string[]): void {
  const counter = layer.counter!

  const sliderVar = layerVar(layer.id, 'slider')
  lines.push('var ' + sliderVar + ' = ' + vName + '.addEffect("ADBE Slider Control");')
  lines.push(sliderVar + '.name = "Progress";')

  const spVar = layerVar(layer.id, 'sp')
  lines.push('var ' + spVar + ' = ' + sliderVar + '.slider;')

  for (let i = 0; i < counter.progress.length; i++) {
    lines.push(
      spVar +
        '.setValueAtTime(' +
        counter.progress[i].t +
        ', ' +
        counter.progress[i].value * 100 +
        ');'
    )
  }

  const progressKfs = counter.progress.map(kf => ({
    ...kf,
    value: kf.value * 100
  }))
  lines.push(
    ...emitEase(spVar, progressKfs, 'Slider', idx => numericDelta(progressKfs, idx))
  )

  const prefix = counter.prefix
  const suffix = counter.suffix
  const decimals = counter.decimals

  const sourceExpr =
    'var progress = effect("Progress")("Slider").value / 100; ' +
    'var maxVal = VALUE_PLACEHOLDER; ' +
    'var current = progress * maxVal; ' +
    (prefix ? jsStringLiteral(prefix) + ' + ' : '""+ ') +
    'current.toFixed(' +
    decimals +
    ')' +
    (suffix ? ' + ' + jsStringLiteral(suffix) : '')

  lines.push(vName + '.sourceText.expression = ' + jsStringLiteral(sourceExpr) + ';')
}

// ---------------------------------------------------------------------------
// Shape layers
// ---------------------------------------------------------------------------

function emitShapeLayer(
  layer: RectLayer | EllipseLayer | PathLayer | ArcLayer,
  compExpr: string,
  lines: string[]
): string {
  const v = layerVar(layer.id, 'layer')
  lines.push('var ' + v + ' = ' + compExpr + '.addShapeLayer();')
  lines.push(v + '.name = ' + jsStringLiteral(layer.id) + ';')

  switch (layer.kind) {
    case 'rect':
      emitRect(layer, v, lines)
      break
    case 'ellipse':
      emitEllipse(layer, v, lines)
      break
    case 'path':
      emitPath(layer, v, lines)
      break
    case 'arc':
      emitArc(layer, v, lines)
      break
  }

  emitTransformProperties(layer, v, lines)

  if (layer.fillAnimation && layer.fillAnimation.length > 0) {
    emitShapeFillAnimation(layer.fillAnimation, v, lines)
  }

  return v
}

function emitRect(layer: RectLayer, v: string, lines: string[]): void {
  lines.push(v + '.addShape("ADBE Vector Shape - Rect");')

  if (layer.widthAnimation || layer.heightAnimation) {
    emitRectSizeAnimation(layer, v, lines)
  } else {
    lines.push(
      v +
        '.setShapeProperty("Rectangle Size", [' +
        layer.width +
        ', ' +
        layer.height +
        ']);'
    )
  }

  lines.push(v + '.setShapeProperty("Rectangle Roundness", ' + layer.radius + ');')
  lines.push(v + '.addFill(' + hexToAEColour(layer.fill) + ');')
}

function emitRectSizeAnimation(layer: RectLayer, v: string, lines: string[]): void {
  const widthKfs = layer.widthAnimation || [{ t: 0, value: layer.width }]
  const heightKfs = layer.heightAnimation || [{ t: 0, value: layer.height }]

  const times = new Set<number>()
  for (const wk of widthKfs) times.add(wk.t)
  for (const hk of heightKfs) times.add(hk.t)
  const sorted = Array.from(times).sort((a, b) => a - b)

  function getVal(kfs: Array<{ t: number; value: number }>, t: number): number {
    for (let k = kfs.length - 1; k >= 0; k--) {
      if (kfs[k].t <= t) return kfs[k].value
    }
    return kfs[0].value
  }

  const propExpr = v + '.shapeProp("Rectangle Size")'
  for (const t of sorted) {
    lines.push(
      propExpr +
        '.setValueAtTime(' +
        t +
        ', [' +
        getVal(widthKfs, t) +
        ', ' +
        getVal(heightKfs, t) +
        ']);'
    )
  }

  if (layer.widthAnimation && layer.widthAnimation.length > 1) {
    lines.push(
      ...emitEase(
        propExpr,
        layer.widthAnimation as Array<{
          t: number
          value: unknown
          ease?: [number, number, number, number]
        }>,
        'Rectangle Size',
        idx => rectSizeDelta(layer.widthAnimation!, idx, layer.heightAnimation)
      )
    )
  }
}

function emitEllipse(layer: EllipseLayer, v: string, lines: string[]): void {
  lines.push(v + '.addShape("ADBE Vector Shape - Ellipse");')
  lines.push(
    v +
      '.setShapeProperty("Ellipse Size", [' +
      layer.radiusX * 2 +
      ', ' +
      layer.radiusY * 2 +
      ']);'
  )
  lines.push(v + '.addFill(' + hexToAEColour(layer.fill) + ');')
}

function emitPath(layer: PathLayer, v: string, lines: string[]): void {
  const parsed = parsePathD(layer.d)
  lines.push(v + '.addShape("ADBE Vector Shape - Group");')
  lines.push(
    v +
      '.setPath(' +
      JSON.stringify(parsed.vertices) +
      ', ' +
      JSON.stringify(parsed.inTangents) +
      ', ' +
      JSON.stringify(parsed.outTangents) +
      ', ' +
      parsed.closed +
      ');'
  )
  lines.push(v + '.addFill(' + hexToAEColour(layer.fill) + ');')
}

function emitArc(layer: ArcLayer, v: string, lines: string[]): void {
  const avgRadius = (layer.innerRadius + layer.outerRadius) / 2
  const strokeWidth = layer.outerRadius - layer.innerRadius

  lines.push(v + '.addShape("ADBE Vector Shape - Ellipse");')
  lines.push(
    v +
      '.setShapeProperty("Ellipse Size", [' +
      avgRadius * 2 +
      ', ' +
      avgRadius * 2 +
      ']);'
  )
  lines.push(v + '.addStroke(' + hexToAEColour(layer.fill) + ', ' + strokeWidth + ');')
  lines.push(v + '.addTrimPaths();')

  const endExpr = v + '.trimEnd'
  const sweepKfs = layer.sweep.map(kf => ({ ...kf, value: kf.value * 100 }))
  for (let i = 0; i < sweepKfs.length; i++) {
    lines.push(
      endExpr + '.setValueAtTime(' + sweepKfs[i].t + ', ' + sweepKfs[i].value + ');'
    )
  }
  lines.push(
    ...emitEase(
      endExpr,
      sweepKfs as Array<{
        t: number
        value: unknown
        ease?: [number, number, number, number]
      }>,
      'Trim Paths End',
      idx => numericDelta(sweepKfs, idx)
    )
  )

  if (layer.startAngle && layer.startAngle.length > 0) {
    const offExpr = v + '.trimOffset'
    for (let j = 0; j < layer.startAngle.length; j++) {
      lines.push(
        offExpr +
          '.setValueAtTime(' +
          layer.startAngle[j].t +
          ', ' +
          layer.startAngle[j].value +
          ');'
      )
    }
    lines.push(
      ...emitEase(
        offExpr,
        layer.startAngle as Array<{
          t: number
          value: unknown
          ease?: [number, number, number, number]
        }>,
        'Trim Paths Offset',
        idx => numericDelta(layer.startAngle, idx)
      )
    )
  }
}

function emitShapeFillAnimation(
  kfs: Keyframe<string>[],
  v: string,
  lines: string[]
): void {
  const propExpr = v + '.fillColor'
  for (let i = 0; i < kfs.length; i++) {
    lines.push(
      propExpr + '.setValueAtTime(' + kfs[i].t + ', ' + hexToAEColour(kfs[i].value) + ');'
    )
  }
  lines.push(
    ...emitEase(
      propExpr,
      kfs as Array<{
        t: number
        value: unknown
        ease?: [number, number, number, number]
      }>,
      'Fill Color',
      idx => colourDelta(kfs, idx)
    )
  )
}

function parsePathD(d: string): {
  vertices: number[][]
  inTangents: number[][]
  outTangents: number[][]
  closed: boolean
} {
  const vertices: number[][] = []
  const inTangents: number[][] = []
  const outTangents: number[][] = []
  let closed = false

  const commands = d.match(/[MLZmlz][^MLZmlz]*/g) || []
  for (const cmd of commands) {
    const letter = cmd[0]
    if (letter === 'Z' || letter === 'z') {
      closed = true
      continue
    }
    const nums = cmd
      .slice(1)
      .trim()
      .split(/[\s,]+/)
      .map(Number)
    if (nums.length >= 2) {
      vertices.push([nums[0], nums[1]])
      inTangents.push([0, 0])
      outTangents.push([0, 0])
    }
  }

  return { vertices, inTangents, outTangents, closed }
}

// ---------------------------------------------------------------------------
// Group -> precomp
// ---------------------------------------------------------------------------

function emitGroup(
  layer: import('../../../types').GroupLayer,
  compExpr: string,
  ctx: GenContext
): string {
  const cv = compVar(layer.id)
  ctx.lines.push(
    'var ' +
      cv +
      ' = new CompItem(' +
      jsStringLiteral(layer.id) +
      ', ' +
      ctx.width +
      ', ' +
      ctx.height +
      ', 1, ' +
      ctx.duration +
      ', ' +
      ctx.fps +
      ');'
  )

  for (const child of layer.children) {
    emitLayerDispatch(child as PrimitiveLayer, cv, ctx)
  }

  const lv = layerVar(layer.id, 'precomp')
  ctx.lines.push('var ' + lv + ' = ' + compExpr + '.layers.add(' + cv + ');')
  ctx.lines.push(lv + '.name = ' + jsStringLiteral(layer.id) + ';')

  emitTransformProperties(layer, lv, ctx.lines)
  return lv
}

// ---------------------------------------------------------------------------
// Layer dispatch
// ---------------------------------------------------------------------------

function emitLayerDispatch(
  layer: PrimitiveLayer,
  compExpr: string,
  ctx: GenContext
): void {
  switch (layer.kind) {
    case 'text':
      emitTextLayer(
        layer,
        compExpr,
        ctx.missingFontVar,
        ctx.mogrt,
        ctx.paramLabels,
        ctx.lines
      )
      break
    case 'rect':
    case 'ellipse':
    case 'path':
    case 'arc':
      emitShapeLayer(layer, compExpr, ctx.lines)
      break
    case 'group':
      emitGroup(layer, compExpr, ctx)
      break
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate an After Effects .jsx script from the resolved export input.
 */
export function generateJsx(input: ExportInput): ExportResult {
  const resolved = input.resolved
  const template = input.template
  const format = input.format
  const mogrt = input.mogrt

  // Refuse particle templates
  for (const layer of resolved.layers) {
    if (layer.kind === 'particles') {
      throw new Error(
        'Template "' +
          template.id +
          '" contains particles. ' +
          'Particle templates export only Video and Claude prompt.'
      )
    }
  }

  const lines: string[] = []
  const notes: string[] = []

  lines.push('app.beginUndoGroup(' + jsStringLiteral('Motion: ' + template.name) + ');')

  const mfv = '__mf'
  lines.push('var ' + mfv + ' = [];')
  for (const font of resolved.fonts) {
    lines.push(
      'if (!app.fonts.getFontByPostScriptName(' +
        jsStringLiteral(font) +
        ')) { ' +
        mfv +
        '.push(' +
        jsStringLiteral(font) +
        '); }'
    )
  }
  lines.push(
    'if (' +
      mfv +
      '.length > 0) { alert(' +
      jsStringLiteral('Missing fonts: ') +
      ' + ' +
      mfv +
      '.join(", ")); }'
  )

  const mainComp = 'mc'
  lines.push(
    'var ' +
      mainComp +
      ' = new CompItem(' +
      jsStringLiteral(template.name) +
      ', ' +
      format.width +
      ', ' +
      format.height +
      ', 1, ' +
      resolved.duration +
      ', ' +
      format.fps +
      ');'
  )

  const paramLabels: Record<string, { kind: string; label: string }> = {}
  for (const [pid, pdef] of Object.entries(template.params)) {
    paramLabels[pid] = { kind: pdef.kind, label: pdef.label }
  }

  const ctx: GenContext = {
    width: format.width,
    height: format.height,
    duration: resolved.duration,
    fps: format.fps,
    missingFontVar: mfv,
    mogrt,
    paramLabels,
    lines
  }

  for (const rl of resolved.layers) {
    emitLayerDispatch(rl, mainComp, ctx)
  }

  if (mogrt) {
    lines.push('var scriptFile = new File($.fileName);')
    lines.push(
      'var mogrtPath = scriptFile.path + "/" + ' +
        jsStringLiteral(template.id + '.mogrt') +
        ';'
    )
    lines.push('var mogrtFile = new File(mogrtPath);')
    lines.push(mainComp + '.exportAsMotionGraphicsTemplate(false, mogrtFile);')
  }

  lines.push('app.endUndoGroup();')

  const src = lines.join('\n')

  return {
    files: [{ name: template.id + '.jsx', kind: 'text', contents: src }],
    notes
  }
}
