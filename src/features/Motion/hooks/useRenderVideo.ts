/**
 * useRenderVideo - orchestrates the video render pipeline (issue #335).
 *
 * Drives #334's four Rust commands through api.ts wrappers:
 *   startRender -> sendRenderFrame (N times) -> finishRender
 * with progress events, cancel support and error handling.
 */
import { useCallback, useRef, useState } from 'react'
import {
  cancelRender,
  finishRender,
  onRenderProgress,
  sendRenderFrame,
  startRender
} from '../api'
import {
  buildFrameList,
  renderFrameToPng,
  type FontData
} from '../internal/frameRenderer'
import type { MotionFormat, ResolvedTemplate } from '../types'

export type RenderState = 'idle' | 'rendering' | 'cancelled' | 'error' | 'done'

export interface UseRenderVideoResult {
  state: RenderState
  progress: number
  error: string | null
  outputPath: string | null
  render: (opts: RenderOptions) => Promise<string | null>
  cancel: () => void
}

export interface RenderOptions {
  resolved: ResolvedTemplate
  format: MotionFormat
  outputPath: string
  fonts: FontData[]
  ffmpegDirectory: string | null
}

export function useRenderVideo(): UseRenderVideoResult {
  const [state, setState] = useState<RenderState>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [outputPath, setOutputPath] = useState<string | null>(null)

  const renderIdRef = useRef<string | null>(null)
  const cancelledRef = useRef(false)

  const render = useCallback(async (opts: RenderOptions): Promise<string | null> => {
    const { resolved, format, outputPath: outPath, fonts, ffmpegDirectory } = opts

    setState('rendering')
    setProgress(0)
    setError(null)
    setOutputPath(null)
    cancelledRef.current = false

    const frames = buildFrameList(resolved.duration, format.fps)
    const totalFrames = frames.length

    try {
      // Subscribe to progress events
      const unsubProgress = await onRenderProgress(p => {
        if (p.renderId === renderIdRef.current) {
          setProgress(p.framesWritten / p.totalFrames)
        }
      })

      try {
        // Start the render
        const renderId = await startRender({
          outputPath: outPath,
          width: format.width,
          height: format.height,
          fps: format.fps,
          totalFrames,
          ffmpegDirectory
        })
        renderIdRef.current = renderId

        // Send frames in order, each awaited before the next
        for (const frameTime of frames) {
          if (cancelledRef.current) break

          const png = await renderFrameToPng(resolved, frameTime, format, fonts)

          if (cancelledRef.current) break

          await sendRenderFrame(renderId, png)
        }

        if (cancelledRef.current) {
          return null
        }

        // Finish the render
        const result = await finishRender(renderId)
        setState('done')
        setOutputPath(result)
        setProgress(1)
        return result
      } finally {
        unsubProgress()
      }
    } catch (err: unknown) {
      if (cancelledRef.current) {
        return null
      }

      const message =
        err && typeof err === 'object' && 'kind' in err
          ? String((err as Record<string, unknown>).kind)
          : err instanceof Error
            ? err.message
            : String(err)

      setState('error')
      setError(message)
      return null
    }
  }, [])

  const cancel = useCallback(() => {
    cancelledRef.current = true
    setState('cancelled')
    if (renderIdRef.current) {
      void cancelRender(renderIdRef.current)
    }
  }, [])

  return {
    state,
    progress,
    error,
    outputPath,
    render,
    cancel
  }
}
