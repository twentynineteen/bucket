/**
 * MotionPreview - SVG + particle canvas for one template at one time (issue #335).
 *
 * Renders the evaluator output as:
 *   - An SVG with viewBox 0 0 3840 2160 for vector layers
 *   - A canvas overlay for particle layers
 *
 * The SVG content comes from the shared buildSvgTree (issue #341), mapped
 * to React elements by svgNodesToReact. Adding a new layer kind only
 * touches buildSvgTree - this file stays unchanged.
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
import { svgNodesToReact } from '../internal/svgToReact'
import { buildSvgTree } from '../internal/svgTree'
import type { TextMeasurer } from '../internal/textOverflow'
import type {
  MotionFormat,
  MotionTemplate,
  ParamValues,
  ParticlesLayerState
} from '../types'

export interface MotionPreviewProps {
  template: MotionTemplate
  values: ParamValues
  format: MotionFormat
  time: number | null
  name: string
  /** When provided, the resolver uses this for line wrapping instead of the approximation. */
  measurer?: TextMeasurer
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
  name,
  measurer
}) => {
  // Resolve the template once when template/values/format/measurer change.
  // The preview always resolves at the native 3840x2160 space.
  const previewFormat = useMemo<MotionFormat>(
    () => ({ width: 3840, height: 2160, fps: format.fps }),
    [format.fps]
  )

  const resolved = useMemo(
    () => resolveTemplate(template, values, previewFormat, measurer),
    [template, values, previewFormat, measurer]
  )

  // Determine the effective time (test clock overrides prop)
  const testClock = readTestClock()
  const effectiveTime = testClock !== null ? testClock : time

  // Evaluate the layer states
  const states = useMemo(() => {
    if (effectiveTime === null) return []
    return evaluate(resolved, effectiveTime)
  }, [resolved, effectiveTime])

  // Build the shared SVG tree and convert to React elements
  const svgChildren = useMemo(() => {
    const tree = buildSvgTree(states)
    return svgNodesToReact(tree)
  }, [states])

  // Extract particle states for the canvas overlay
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
        {svgChildren}
      </svg>
      {hasParticles && <ParticleCanvas states={particleStates} />}
    </div>
  )
}

export default MotionPreview
