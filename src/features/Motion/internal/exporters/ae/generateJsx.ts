/**
 * After Effects .jsx exporter (issue #329)
 *
 * Pure function over ExportInput. Returns ES3 ASCII-only ExtendScript
 * that uses only documented AE scripting API calls.
 *
 * API references (ae-scripting.docsforadobe.dev):
 * - ItemCollection.addComp: /item/itemcollection/
 * - LayerCollection.addText, addShape, addBoxText, add: /layer/layercollection/
 * - Property.setValueAtTime, setTemporalEaseAtKey, setSpatialTangentsAtKey,
 *   expression: /property/property/
 * - PropertyGroup.addProperty, property: /property/propertygroup/
 * - TextDocument: /text/textdocument/
 * - KeyframeEase: /other/keyframeease/
 * - Shape: /other/shape/
 * - CompItem.openInEssentialGraphics, exportAsMotionGraphicsTemplate: /item/compitem/
 * - Property.addToMotionGraphicsTemplateAs: /property/property/
 * - app.fonts.getFontsByPostScriptName: /text/fontsobject/ (AE 24.0+)
 * - Shape matchNames: /matchnames/layer/shapelayer/
 * - Text matchNames: /matchnames/layer/textlayer/
 * - AV matchNames: /matchnames/layer/avlayer/
 * - Effects matchNames: /matchnames/effects/firstparty/
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
// Context
// ---------------------------------------------------------------------------

interface GenContext {
  width: number
  height: number
  duration: number
  fps: number
  mfVar: string
  mogrt: boolean
  compVar: string
  paramLabels: Record<string, { kind: string; label: string }>
  lines: string[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hexToAE4(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return '[' + r + ', ' + g + ', ' + b + ', 1]'
}

function hexToAE3(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return '[' + r + ', ' + g + ', ' + b + ']'
}

function emitVerts(arr: number[][]): string {
  return '[' + arr.map(p => '[' + p.join(', ') + ']').join(', ') + ']'
}

function lv(id: string, s?: string): string {
  const safe = id.replace(/[^a-zA-Z0-9_]/g, '_')
  return s ? safe + '_' + s : safe
}

let _u = 0
function uid(): string {
  return 'v' + _u++
}

// ---------------------------------------------------------------------------
// Ease
// ---------------------------------------------------------------------------

function emitEase(
  pe: string,
  kfs: Array<{
    t: number
    value: unknown
    ease?: [number, number, number, number]
  }>,
  mn: string,
  delta: (i: number) => number,
  lines: string[]
): void {
  const dims = EASE_DIMENSIONS[mn] ?? 1
  for (let i = 0; i < kfs.length - 1; i++) {
    const e = kfs[i].ease
    if (!e) continue
    const d = delta(i)
    const pair = mapEase(e, Math.abs(d), dims)
    const out = pair.outgoing
      .map(x => 'new KeyframeEase(' + x.speed + ', ' + x.influence + ')')
      .join(', ')
    const inc = pair.incoming
      .map(x => 'new KeyframeEase(' + x.speed + ', ' + x.influence + ')')
      .join(', ')
    lines.push(
      pe + '.setTemporalEaseAtKey(' + (i + 1) + ', [' + out + '], [' + out + ']);'
    )
    lines.push(
      pe + '.setTemporalEaseAtKey(' + (i + 2) + ', [' + inc + '], [' + inc + ']);'
    )
  }
}

function numD(kfs: Array<{ t: number; value: number }>, i: number): number {
  const dt = kfs[i + 1].t - kfs[i].t
  return dt === 0 ? 0 : (kfs[i + 1].value - kfs[i].value) / dt
}

function posD(
  kfs: Array<{ t: number; value: { x: number; y: number } }>,
  i: number
): number {
  const dt = kfs[i + 1].t - kfs[i].t
  if (dt === 0) return 0
  const dx = kfs[i + 1].value.x - kfs[i].value.x
  const dy = kfs[i + 1].value.y - kfs[i].value.y
  return Math.sqrt(dx * dx + dy * dy) / dt
}

function colD(kfs: Array<{ t: number; value: string }>, i: number): number {
  const dt = kfs[i + 1].t - kfs[i].t
  if (dt === 0) return 0
  function p(h: string): [number, number, number] {
    return [
      parseInt(h.slice(1, 3), 16) / 255,
      parseInt(h.slice(3, 5), 16) / 255,
      parseInt(h.slice(5, 7), 16) / 255
    ]
  }
  const a = p(kfs[i].value)
  const b = p(kfs[i + 1].value)
  return Math.sqrt((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2 + (b[2] - a[2]) ** 2) / dt
}

function scaleD(
  kfs: Array<{ t: number; value: { x: number; y: number } }>,
  i: number
): number {
  const dt = kfs[i + 1].t - kfs[i].t
  if (dt === 0) return 0
  const dx = (kfs[i + 1].value.x - kfs[i].value.x) * 100
  const dy = (kfs[i + 1].value.y - kfs[i].value.y) * 100
  return Math.sqrt(dx * dx + dy * dy) / dt
}

// ---------------------------------------------------------------------------
// Transform (avlayer matchnames: ADBE Position, ADBE Scale, ADBE Rotate Z, ADBE Opacity)
// ---------------------------------------------------------------------------

function emitTransform(layer: PrimitiveLayer, le: string, lines: string[]): void {
  const tg = le + '.property("ADBE Transform Group")'

  if (layer.position && layer.position.length > 0) {
    const pp = tg + '.property("ADBE Position")'
    for (const kf of layer.position) {
      lines.push(
        pp + '.setValueAtTime(' + kf.t + ', [' + kf.value.x + ', ' + kf.value.y + ']);'
      )
    }
    for (let j = 1; j <= layer.position.length; j++) {
      lines.push(pp + '.setSpatialTangentsAtKey(' + j + ', [0, 0], [0, 0]);')
    }
    emitEase(
      pp,
      layer.position as Array<{
        t: number
        value: unknown
        ease?: [number, number, number, number]
      }>,
      'ADBE Position',
      i => posD(layer.position!, i),
      lines
    )
  }

  if (layer.scale && layer.scale.length > 0) {
    const sp = tg + '.property("ADBE Scale")'
    for (const kf of layer.scale) {
      lines.push(
        sp +
          '.setValueAtTime(' +
          kf.t +
          ', [' +
          kf.value.x * 100 +
          ', ' +
          kf.value.y * 100 +
          ', 100]);'
      )
    }
    emitEase(
      sp,
      layer.scale as Array<{
        t: number
        value: unknown
        ease?: [number, number, number, number]
      }>,
      'ADBE Scale',
      i => scaleD(layer.scale!, i),
      lines
    )
  }

  if (layer.rotation && layer.rotation.length > 0) {
    const rp = tg + '.property("ADBE Rotate Z")'
    for (const kf of layer.rotation) {
      lines.push(rp + '.setValueAtTime(' + kf.t + ', ' + kf.value + ');')
    }
    emitEase(
      rp,
      layer.rotation as Array<{
        t: number
        value: unknown
        ease?: [number, number, number, number]
      }>,
      'ADBE Rotate Z',
      i => numD(layer.rotation!, i),
      lines
    )
  }

  if (layer.opacity && layer.opacity.length > 0) {
    const op = tg + '.property("ADBE Opacity")'
    const oKfs = layer.opacity.map(kf => ({
      ...kf,
      value: kf.value * 100
    }))
    for (const kf of oKfs) {
      lines.push(op + '.setValueAtTime(' + kf.t + ', ' + kf.value + ');')
    }
    emitEase(op, oKfs, 'ADBE Opacity', i => numD(oKfs, i), lines)
  }
}

// ---------------------------------------------------------------------------
// Font
// ---------------------------------------------------------------------------

function fontToPS(font: { family: string; style: string }): string {
  const fam = font.family.replace(/\s/g, '')
  const sty = font.style.replace(/\s/g, '')
  if (fam === 'CabritoSemi' && sty === 'NormBold') return 'CabritoSemi-NorBol'
  return fam + '-' + sty
}

// ---------------------------------------------------------------------------
// Text layer
// layercollection/ - addText([sourceText]) or addBoxText([w, h])
// textdocument/ - TextDocument attributes
// ---------------------------------------------------------------------------

function emitText(layer: TextLayer, compExpr: string, ctx: GenContext): string {
  const v = lv(layer.id, 'l')
  const L = ctx.lines
  const ps = fontToPS(layer.font)
  const fontE =
    '(' +
    ctx.mfVar +
    '.indexOf(' +
    jsStringLiteral(ps) +
    ') >= 0 ? "ArialMT" : ' +
    jsStringLiteral(ps) +
    ')'

  if (layer.multiline && layer.width) {
    const ld = layer.lineHeight * layer.font.size
    L.push(
      'var ' +
        v +
        ' = ' +
        compExpr +
        '.layers.addBoxText([' +
        layer.width +
        ', ' +
        ld * 10 +
        ']);'
    )
  } else {
    L.push('var ' + v + ' = ' + compExpr + '.layers.addText();')
  }
  L.push(v + '.name = ' + jsStringLiteral(layer.id) + ';')

  const txt = layer.text.replace(/\n/g, '\r')
  const td = lv(layer.id, 'td')
  L.push(
    'var ' +
      td +
      ' = ' +
      v +
      '.property("ADBE Text Properties").property("ADBE Text Document").value;'
  )
  L.push(td + '.text = ' + jsStringLiteral(txt) + ';')
  L.push(td + '.font = ' + fontE + ';')
  L.push(td + '.fontSize = ' + layer.font.size + ';')
  L.push(td + '.fillColor = ' + hexToAE3(layer.fill) + ';')
  L.push(td + '.applyFill = true;')

  const justMap: Record<string, string> = {
    left: 'ParagraphJustification.LEFT_JUSTIFY',
    center: 'ParagraphJustification.CENTER_JUSTIFY',
    right: 'ParagraphJustification.RIGHT_JUSTIFY'
  }
  L.push(td + '.justification = ' + justMap[layer.align] + ';')
  const ld = layer.lineHeight * layer.font.size
  L.push(td + '.leading = ' + ld + ';')

  L.push(
    v +
      '.property("ADBE Text Properties").property("ADBE Text Document").setValue(' +
      td +
      ');'
  )

  emitTransform(layer, v, L)

  // Tracking: own animator, never stagger-driven
  if (layer.tracking && layer.tracking.length > 0) {
    emitTrackingAnimator(layer, v, L)
  }

  // Stagger: separate opacity (+ optional fill) animator with Expression Selector
  if (layer.stagger) {
    emitStaggerAnimator(layer, v, L)
  }

  if (layer.counter) {
    emitCounter(layer, v, ctx)
  }

  if (ctx.mogrt && layer.param && ctx.paramLabels[layer.param]) {
    L.push(
      v +
        '.property("ADBE Text Properties").property("ADBE Text Document").addToMotionGraphicsTemplateAs(' +
        ctx.compVar +
        ', ' +
        jsStringLiteral(ctx.paramLabels[layer.param].label) +
        ');'
    )
  }

  return v
}

// ---------------------------------------------------------------------------
// Tracking animator (own animator, never stagger-driven)
// textlayer matchnames: ADBE Text Animators, ADBE Text Animator,
//   ADBE Text Animator Properties, ADBE Text Tracking Amount
// ---------------------------------------------------------------------------

function emitTrackingAnimator(layer: TextLayer, le: string, lines: string[]): void {
  const tracking = layer.tracking!
  const an = lv(layer.id, 'an')
  lines.push(
    'var ' +
      an +
      ' = ' +
      le +
      '.property("ADBE Text Properties").property("ADBE Text Animators").addProperty("ADBE Text Animator");'
  )

  const tk = lv(layer.id, 'tk')
  lines.push(
    'var ' +
      tk +
      ' = ' +
      an +
      '.property("ADBE Text Animator Properties").addProperty("ADBE Text Tracking Amount");'
  )

  for (const kf of tracking) {
    lines.push(tk + '.setValueAtTime(' + kf.t + ', ' + kf.value + ');')
  }
  emitEase(
    tk,
    tracking as Array<{
      t: number
      value: unknown
      ease?: [number, number, number, number]
    }>,
    'ADBE Text Tracking Amount',
    i => numD(tracking, i),
    lines
  )
}

// ---------------------------------------------------------------------------
// Stagger animator (opacity + optional fill, Expression Selector)
// Per-character stagger animates opacity and fill only (not position/scale/
// rotation). Layer transforms stay on the layer's Transform group.
// textlayer matchnames: ADBE Text Opacity, ADBE Text Fill Color,
//   ADBE Text Expressible Selector (flagged for #339),
//   ADBE Text Selector Max Amount
// ---------------------------------------------------------------------------

function emitStaggerAnimator(layer: TextLayer, le: string, lines: string[]): void {
  const delay = layer.stagger!.delay
  const san = lv(layer.id, 'sa')
  lines.push(
    'var ' +
      san +
      ' = ' +
      le +
      '.property("ADBE Text Properties").property("ADBE Text Animators").addProperty("ADBE Text Animator");'
  )

  // ADBE Text Opacity (textlayer matchnames, Animator Properties section)
  lines.push(
    san + '.property("ADBE Text Animator Properties").addProperty("ADBE Text Opacity");'
  )

  // ADBE Text Fill Color when the layer's fill animates
  if (layer.fillAnimation && layer.fillAnimation.length > 0) {
    lines.push(
      san +
        '.property("ADBE Text Animator Properties").addProperty("ADBE Text Fill Color");'
    )
  }

  // Expression Selector driving per-character delay
  const es = lv(layer.id, 'es')
  lines.push(
    'var ' +
      es +
      ' = ' +
      san +
      '.property("ADBE Text Selectors").addProperty("ADBE Text Expressible Selector");'
  )
  const expr =
    'var d = (textIndex - 1) * ' +
    delay +
    '; var t = time - d; if (t < 0) { 0; } else { 100; }'
  lines.push(
    es +
      '.property("ADBE Text Selector Max Amount").expression = ' +
      jsStringLiteral(expr) +
      ';'
  )
}

// ---------------------------------------------------------------------------
// Counter
// effects matchnames: ADBE Slider Control, ADBE Slider Control-0001
// ---------------------------------------------------------------------------

function emitCounter(layer: TextLayer, le: string, ctx: GenContext): void {
  const counter = layer.counter!
  const L = ctx.lines

  const sl = lv(layer.id, 'sl')
  L.push(
    'var ' +
      sl +
      ' = ' +
      le +
      '.property("ADBE Effect Parade").addProperty("ADBE Slider Control");'
  )
  L.push(sl + '.name = "Progress";')

  const sp = lv(layer.id, 'sp')
  L.push('var ' + sp + ' = ' + sl + '.property("ADBE Slider Control-0001");')

  for (const kf of counter.progress) {
    L.push(sp + '.setValueAtTime(' + kf.t + ', ' + kf.value * 100 + ');')
  }
  const pKfs = counter.progress.map(kf => ({
    ...kf,
    value: kf.value * 100
  }))
  emitEase(sp, pKfs, 'ADBE Slider Control-0001', i => numD(pKfs, i), L)

  // Second slider holds the baked max value (no placeholder in expression)
  const mv = lv(layer.id, 'mv')
  L.push(
    'var ' +
      mv +
      ' = ' +
      le +
      '.property("ADBE Effect Parade").addProperty("ADBE Slider Control");'
  )
  L.push(mv + '.name = "MaxVal";')

  const prefix = counter.prefix
  const suffix = counter.suffix
  const decimals = counter.decimals

  const parts = [
    'var progress = effect("Progress")("ADBE Slider Control-0001").value / 100',
    'var maxVal = effect("MaxVal")("ADBE Slider Control-0001").value',
    'var current = progress * maxVal'
  ]
  let res = ''
  if (prefix) res += jsStringLiteral(prefix) + ' + '
  res += 'current.toFixed(' + decimals + ')'
  if (suffix) res += ' + ' + jsStringLiteral(suffix)
  parts.push(res)

  const fullExpr = parts.join('; ') + ';'

  L.push(
    le +
      '.property("ADBE Text Properties").property("ADBE Text Document").expression = ' +
      jsStringLiteral(fullExpr) +
      ';'
  )
}

// ---------------------------------------------------------------------------
// Shape layers
// shapelayer matchnames: ADBE Root Vectors Group, ADBE Vector Group,
//   ADBE Vectors Group, ADBE Vector Shape - Rect, etc.
// ---------------------------------------------------------------------------

function emitShape(
  layer: RectLayer | EllipseLayer | PathLayer | ArcLayer,
  compExpr: string,
  lines: string[]
): string {
  const v = lv(layer.id, 'l')
  lines.push('var ' + v + ' = ' + compExpr + '.layers.addShape();')
  lines.push(v + '.name = ' + jsStringLiteral(layer.id) + ';')

  const rv = lv(layer.id, 'rv')
  lines.push('var ' + rv + ' = ' + v + '.property("ADBE Root Vectors Group");')

  const g = lv(layer.id, 'g')
  lines.push('var ' + g + ' = ' + rv + '.addProperty("ADBE Vector Group");')
  const cnt = g + '.property("ADBE Vectors Group")'

  switch (layer.kind) {
    case 'rect':
      emitRect(layer, cnt, lines)
      break
    case 'ellipse':
      emitEllipseS(layer, cnt, lines)
      break
    case 'path':
      emitPathS(layer, cnt, lines)
      break
    case 'arc':
      emitArcS(layer, cnt, lines)
      break
  }

  emitTransform(layer, v, lines)
  if (layer.fillAnimation && layer.fillAnimation.length > 0) {
    emitFillAnim(layer.fillAnimation, cnt, lines)
  }
  return v
}

function emitRect(layer: RectLayer, cnt: string, lines: string[]): void {
  const r = uid()
  lines.push('var ' + r + ' = ' + cnt + '.addProperty("ADBE Vector Shape - Rect");')
  if (layer.widthAnimation || layer.heightAnimation) {
    emitRectSizeAnim(layer, r, lines)
  } else {
    lines.push(
      r +
        '.property("ADBE Vector Rect Size").setValue([' +
        layer.width +
        ', ' +
        layer.height +
        ']);'
    )
  }
  lines.push(
    r + '.property("ADBE Vector Rect Roundness").setValue(' + layer.radius + ');'
  )
  const f = uid()
  lines.push('var ' + f + ' = ' + cnt + '.addProperty("ADBE Vector Graphic - Fill");')
  lines.push(
    f + '.property("ADBE Vector Fill Color").setValue(' + hexToAE4(layer.fill) + ');'
  )
}

function emitRectSizeAnim(layer: RectLayer, re: string, lines: string[]): void {
  const wKfs = layer.widthAnimation || [{ t: 0, value: layer.width }]
  const hKfs = layer.heightAnimation || [{ t: 0, value: layer.height }]
  const times = new Set<number>()
  for (const w of wKfs) times.add(w.t)
  for (const h of hKfs) times.add(h.t)
  const sorted = Array.from(times).sort((a, b) => a - b)

  function gv(kfs: Array<{ t: number; value: number }>, t: number): number {
    for (let k = kfs.length - 1; k >= 0; k--) {
      if (kfs[k].t <= t) return kfs[k].value
    }
    return kfs[0].value
  }

  const pe = re + '.property("ADBE Vector Rect Size")'
  for (const t of sorted) {
    lines.push(
      pe + '.setValueAtTime(' + t + ', [' + gv(wKfs, t) + ', ' + gv(hKfs, t) + ']);'
    )
  }

  if (layer.widthAnimation && layer.widthAnimation.length > 1) {
    emitEase(
      pe,
      layer.widthAnimation as Array<{
        t: number
        value: unknown
        ease?: [number, number, number, number]
      }>,
      'ADBE Vector Rect Size',
      i => {
        const dt = layer.widthAnimation![i + 1].t - layer.widthAnimation![i].t
        if (dt === 0) return 0
        const dw = layer.widthAnimation![i + 1].value - layer.widthAnimation![i].value
        let dh = 0
        if (
          layer.heightAnimation &&
          layer.heightAnimation[i] &&
          layer.heightAnimation[i + 1]
        ) {
          dh = layer.heightAnimation[i + 1].value - layer.heightAnimation[i].value
        }
        return Math.sqrt(dw * dw + dh * dh) / dt
      },
      lines
    )
  }
}

function emitEllipseS(layer: EllipseLayer, cnt: string, lines: string[]): void {
  const e = uid()
  lines.push('var ' + e + ' = ' + cnt + '.addProperty("ADBE Vector Shape - Ellipse");')
  lines.push(
    e +
      '.property("ADBE Vector Ellipse Size").setValue([' +
      layer.radiusX * 2 +
      ', ' +
      layer.radiusY * 2 +
      ']);'
  )
  const f = uid()
  lines.push('var ' + f + ' = ' + cnt + '.addProperty("ADBE Vector Graphic - Fill");')
  lines.push(
    f + '.property("ADBE Vector Fill Color").setValue(' + hexToAE4(layer.fill) + ');'
  )
}

function emitPathS(layer: PathLayer, cnt: string, lines: string[]): void {
  const pg = uid()
  lines.push('var ' + pg + ' = ' + cnt + '.addProperty("ADBE Vector Shape - Group");')
  const parsed = parsePathD(layer.d)
  const sv = uid()
  lines.push('var ' + sv + ' = new Shape();')
  lines.push(sv + '.vertices = ' + emitVerts(parsed.vertices) + ';')
  lines.push(sv + '.inTangents = ' + emitVerts(parsed.inTangents) + ';')
  lines.push(sv + '.outTangents = ' + emitVerts(parsed.outTangents) + ';')
  lines.push(sv + '.closed = ' + parsed.closed + ';')
  lines.push(pg + '.property("ADBE Vector Shape").setValue(' + sv + ');')
  const f = uid()
  lines.push('var ' + f + ' = ' + cnt + '.addProperty("ADBE Vector Graphic - Fill");')
  lines.push(
    f + '.property("ADBE Vector Fill Color").setValue(' + hexToAE4(layer.fill) + ');'
  )
}

function emitArcS(layer: ArcLayer, cnt: string, lines: string[]): void {
  const avgR = (layer.innerRadius + layer.outerRadius) / 2
  const sw = layer.outerRadius - layer.innerRadius
  const e = uid()
  lines.push('var ' + e + ' = ' + cnt + '.addProperty("ADBE Vector Shape - Ellipse");')
  lines.push(
    e +
      '.property("ADBE Vector Ellipse Size").setValue([' +
      avgR * 2 +
      ', ' +
      avgR * 2 +
      ']);'
  )
  const s = uid()
  lines.push('var ' + s + ' = ' + cnt + '.addProperty("ADBE Vector Graphic - Stroke");')
  lines.push(
    s + '.property("ADBE Vector Stroke Color").setValue(' + hexToAE4(layer.fill) + ');'
  )
  lines.push(s + '.property("ADBE Vector Stroke Width").setValue(' + sw + ');')
  const t = uid()
  lines.push('var ' + t + ' = ' + cnt + '.addProperty("ADBE Vector Filter - Trim");')

  const te = t + '.property("ADBE Vector Trim End")'
  const sKfs = layer.sweep.map(kf => ({
    ...kf,
    value: kf.value * 100
  }))
  for (const kf of sKfs) {
    lines.push(te + '.setValueAtTime(' + kf.t + ', ' + kf.value + ');')
  }
  emitEase(
    te,
    sKfs as Array<{
      t: number
      value: unknown
      ease?: [number, number, number, number]
    }>,
    'ADBE Vector Trim End',
    i => numD(sKfs, i),
    lines
  )

  if (layer.startAngle && layer.startAngle.length > 0) {
    const to = t + '.property("ADBE Vector Trim Offset")'
    for (const kf of layer.startAngle) {
      lines.push(to + '.setValueAtTime(' + kf.t + ', ' + kf.value + ');')
    }
    emitEase(
      to,
      layer.startAngle as Array<{
        t: number
        value: unknown
        ease?: [number, number, number, number]
      }>,
      'ADBE Vector Trim Offset',
      i => numD(layer.startAngle!, i),
      lines
    )
  }
}

function emitFillAnim(kfs: Keyframe<string>[], cnt: string, lines: string[]): void {
  const fc =
    cnt + '.property("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color")'
  for (const kf of kfs) {
    lines.push(fc + '.setValueAtTime(' + kf.t + ', ' + hexToAE4(kf.value) + ');')
  }
  emitEase(
    fc,
    kfs as Array<{
      t: number
      value: unknown
      ease?: [number, number, number, number]
    }>,
    'ADBE Vector Fill Color',
    i => colD(kfs, i),
    lines
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
    if (cmd[0] === 'Z' || cmd[0] === 'z') {
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
// itemcollection/ - addComp
// layercollection/ - add(item)
// ---------------------------------------------------------------------------

function emitGroup(
  layer: import('../../../types').GroupLayer,
  compExpr: string,
  ctx: GenContext
): string {
  const pc = 'c_' + layer.id.replace(/[^a-zA-Z0-9_]/g, '_')
  ctx.lines.push(
    'var ' +
      pc +
      ' = app.project.items.addComp(' +
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
    emitLayerDispatch(child as PrimitiveLayer, pc, ctx)
  }

  const lyr = lv(layer.id, 'pc')
  ctx.lines.push('var ' + lyr + ' = ' + compExpr + '.layers.add(' + pc + ');')
  ctx.lines.push(lyr + '.name = ' + jsStringLiteral(layer.id) + ';')

  emitTransform(layer, lyr, ctx.lines)
  return lyr
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

function emitLayerDispatch(
  layer: PrimitiveLayer,
  compExpr: string,
  ctx: GenContext
): void {
  switch (layer.kind) {
    case 'text':
      emitText(layer, compExpr, ctx)
      break
    case 'rect':
    case 'ellipse':
    case 'path':
    case 'arc':
      emitShape(layer, compExpr, ctx.lines)
      break
    case 'group':
      emitGroup(layer, compExpr, ctx)
      break
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function generateJsx(input: ExportInput): ExportResult {
  const resolved = input.resolved
  const template = input.template
  const format = input.format
  const mogrt = input.mogrt
  _u = 0

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

  // Font check: app.fonts (AE 24.0+), graceful fallback for older
  const mf = '__mf'
  lines.push('var ' + mf + ' = [];')
  lines.push('if (typeof app.fonts !== "undefined") {')
  for (const font of resolved.fonts) {
    lines.push(
      '  if (app.fonts.getFontsByPostScriptName(' +
        jsStringLiteral(font) +
        ').length === 0) { ' +
        mf +
        '.push(' +
        jsStringLiteral(font) +
        '); }'
    )
  }
  lines.push('}')
  lines.push(
    'if (' +
      mf +
      '.length > 0) { alert(' +
      jsStringLiteral('Missing fonts: ') +
      ' + ' +
      mf +
      '.join(", ")); }'
  )

  const mc = 'mc'
  lines.push(
    'var ' +
      mc +
      ' = app.project.items.addComp(' +
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
    mfVar: mf,
    mogrt,
    compVar: mc,
    paramLabels,
    lines
  }

  for (const rl of resolved.layers) {
    emitLayerDispatch(rl, mc, ctx)
  }

  if (mogrt) {
    lines.push(mc + '.openInEssentialGraphics();')
    lines.push('var scriptFile = new File($.fileName);')
    lines.push(
      'var mogrtPath = scriptFile.path + "/" + ' +
        jsStringLiteral(template.id + '.mogrt') +
        ';'
    )
    lines.push('var mogrtFile = new File(mogrtPath);')
    lines.push(mc + '.exportAsMotionGraphicsTemplate(false, mogrtFile);')
  }

  lines.push('app.endUndoGroup();')

  return {
    files: [
      {
        name: template.id + '.jsx',
        kind: 'text',
        contents: lines.join('\n')
      }
    ],
    notes
  }
}
