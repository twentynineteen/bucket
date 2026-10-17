/**
 * MotionPreview - SVG + particle canvas for one template at one time (issue #335).
 *
 * Renders the evaluator output as:
 *   - An SVG with viewBox 0 0 3840 2160 for vector layers
 *   - A canvas overlay for particle layers
 *
 * Props:
 *   - template: MotionTemplate
 *   - values: ParamValues (current param values)
 *   - format: MotionFormat (for resolveTemplate)
 *   - time: number | null (null = hide, e.g. during loop gap)
 *   - name: string (accessible name)
 */
import React, { useEffect, useMemo, useRef } from 'react'
import { readTestClock } from '../internal/clock'
import { evaluate } from '../internal/evaluate'
import { resolveTemplate } from '../internal/resolve'
import { arcPath, matrixStr } from '../internal/svgGeometry'
import type {
  MotionFormat,
  MotionTemplate,
  ParamValues,
  ParticlesLayerState,
  ShapeLayerState,
  TextLayerState
} from '../types'

/** Exhaustiveness check: the compiler proves this is never called. */
function assertNever(x: never): never {
  throw new Error(`Unexpected layer kind: ${(x as { kind: string }).kind}`)
}

export interface MotionPreviewProps {
  template: MotionTemplate
  values: ParamValues
  format: MotionFormat
  time: number | null
  name: string
}

// ---------------------------------------------------------------------------
// Layer renderers
// ---------------------------------------------------------------------------

function ShapeElement({ state }: { state: ShapeLayerState }) {
  const transform = matrixStr(state.matrix)

  if (state.kind === 'rect' && state.size) {
    return (
      <rect
        x="0"
        y="0"
        width={state.size.w}
        height={state.size.h}
        rx={state.radius ?? 0}
        fill={state.fill}
        opacity={state.opacity}
        transform={transform}
      />
    )
  }

  if (state.kind === 'ellipse') {
    return (
      <ellipse
        cx="0"
        cy="0"
        rx={state.radii?.rx ?? 0}
        ry={state.radii?.ry ?? 0}
        fill={state.fill}
        opacity={state.opacity}
        transform={transform}
      />
    )
  }

  if (state.kind === 'path' && state.d) {
    return (
      <path d={state.d} fill={state.fill} opacity={state.opacity} transform={transform} />
    )
  }

  if (state.kind === 'arc' && state.arc) {
    const { innerRadius, outerRadius, sweep, startAngle } = state.arc
    const d = arcPath(0, 0, innerRadius, outerRadius, startAngle, sweep)
    if (!d) return null
    return <path d={d} fill={state.fill} opacity={state.opacity} transform={transform} />
  }

  assertNever(state.kind as never)
}

function alignToAnchor(align: 'left' | 'center' | 'right'): 'start' | 'middle' | 'end' {
  switch (align) {
    case 'center':
      return 'middle'
    case 'right':
      return 'end'
    default:
      return 'start'
  }
}

function TextElement({ state }: { state: TextLayerState }) {
  const transform = matrixStr(state.matrix)
  const fontFamily = `"${state.font.family}"`
  const textAnchor = alignToAnchor(state.align)

  // Staggered text: each unit is its own tspan.
  // xml:space="preserve" prevents SVG from collapsing a lone space tspan.
  // When the text contains \n (multiline + stagger), the \n unit becomes a
  // line break: the next visible tspan gets x="0" and dy to advance the line.
  if (state.units && state.units.length > 0) {
    const lineAdvance = state.lineHeight * state.font.size
    // Build the set of indices that follow a \n unit and need line-break attrs
    const breakAfter = new Set<number>()
    for (let j = 0; j < state.units.length; j++) {
      if (state.units[j].text === '\n') {
        // Mark the next non-\n unit as needing a line break
        for (let k = j + 1; k < state.units.length; k++) {
          if (state.units[k].text !== '\n') {
            breakAfter.add(k)
            break
          }
        }
      }
    }

    return (
      <text
        fontFamily={fontFamily}
        fontSize={state.font.size}
        fill={state.fill}
        opacity={state.opacity}
        textAnchor={textAnchor}
        transform={transform}
        xmlSpace="preserve"
      >
        {state.units.map((u, i) => {
          if (u.text === '\n') return null
          return (
            <tspan
              key={i}
              opacity={u.opacity}
              fill={u.fill}
              x={breakAfter.has(i) ? '0' : undefined}
              dy={breakAfter.has(i) ? String(lineAdvance) : undefined}
            >
              {u.text}
            </tspan>
          )
        })}
      </text>
    )
  }

  // Multiline text: one tspan per line
  if (state.multiline && state.text.includes('\n')) {
    const lines = state.text.split('\n')
    const lineAdvance = state.lineHeight * state.font.size
    return (
      <text
        fontFamily={fontFamily}
        fontSize={state.font.size}
        fill={state.fill}
        opacity={state.opacity}
        textAnchor={textAnchor}
        transform={transform}
      >
        {lines.map((line, i) => (
          <tspan key={i} x="0" dy={i === 0 ? undefined : String(lineAdvance)}>
            {line}
          </tspan>
        ))}
      </text>
    )
  }

  // Plain text
  return (
    <text
      fontFamily={fontFamily}
      fontSize={state.font.size}
      fill={state.fill}
      opacity={state.opacity}
      textAnchor={textAnchor}
      transform={transform}
    >
      {state.text}
    </text>
  )
}

// ---------------------------------------------------------------------------
// Particle canvas
// ---------------------------------------------------------------------------

/** Cap the device pixel ratio to avoid giant canvas backing stores. */
const MAX_DPR = 2

/**
 * Template-space dimensions the evaluator works in.
 * The canvas scales its context so drawing code stays in this coordinate space.
 */
const TEMPLATE_W = 3840
const TEMPLATE_H = 2160

function ParticleCanvas({ states }: { states: ParticlesLayerState[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Size the backing store to the CSS box at a capped device-pixel ratio
    const rect = canvas.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio ?? 1, MAX_DPR)
    const pxW = Math.round(rect.width * dpr)
    const pxH = Math.round(rect.height * dpr)

    // Only resize when the dimensions change (avoids clearing on every tick)
    if (canvas.width !== pxW || canvas.height !== pxH) {
      canvas.width = pxW
      canvas.height = pxH
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, pxW, pxH)

    // Scale from template space (3840x2160) to the canvas backing store
    ctx.save()
    ctx.scale(pxW / TEMPLATE_W, pxH / TEMPLATE_H)

    for (const state of states) {
      const [a, b, c, d, tx, ty] = state.matrix
      ctx.save()
      ctx.transform(a, b, c, d, tx, ty)

      for (const pt of state.points) {
        if (pt.opacity <= 0) continue
        ctx.globalAlpha = state.opacity * pt.opacity
        ctx.fillStyle = pt.fill
        ctx.beginPath()
        ctx.arc(pt.x, pt.y, state.pointRadius, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.restore()
    }

    ctx.restore()
  }, [states])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none'
      }}
    />
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const MotionPreview: React.FC<MotionPreviewProps> = ({
  template,
  values,
  format,
  time,
  name
}) => {
  // Resolve the template once when template/values/format change.
  // The preview always resolves at the native 3840x2160 space.
  const previewFormat = useMemo<MotionFormat>(
    () => ({ width: 3840, height: 2160, fps: format.fps }),
    [format.fps]
  )

  const resolved = useMemo(
    () => resolveTemplate(template, values, previewFormat),
    [template, values, previewFormat]
  )

  // Determine the effective time (test clock overrides prop)
  const testClock = readTestClock()
  const effectiveTime = testClock !== null ? testClock : time

  // Evaluate the layer states
  const states = useMemo(() => {
    if (effectiveTime === null) return []
    return evaluate(resolved, effectiveTime)
  }, [resolved, effectiveTime])

  // Split states by kind
  const vectorStates = useMemo(
    () =>
      states.filter((s): s is ShapeLayerState | TextLayerState => s.kind !== 'particles'),
    [states]
  )
  const particleStates = useMemo(
    () => states.filter((s): s is ParticlesLayerState => s.kind === 'particles'),
    [states]
  )

  const hasParticles = particleStates.length > 0

  return (
    <div
      role="img"
      aria-label={`${name} preview`}
      style={{ position: 'relative', width: '100%', aspectRatio: '16/9' }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 3840 2160"
        // Text is drawn at 3840 wide and scaled into a small card. Without exact
        // glyph advances, Chromium on Linux and Windows rounds each one to whole
        // pixels at that size and the letter spacing breaks.
        textRendering="geometricPrecision"
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        {vectorStates.map(state => {
          switch (state.kind) {
            case 'text':
              return <TextElement key={state.id} state={state} />
            case 'rect':
            case 'ellipse':
            case 'path':
            case 'arc':
              return <ShapeElement key={state.id} state={state} />
            default:
              assertNever(state)
          }
        })}
      </svg>
      {hasParticles && <ParticleCanvas states={particleStates} />}
    </div>
  )
}

export default MotionPreview
