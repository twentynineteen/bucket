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

/** Extract an error message from a Tauri error or plain Error.
 *  Rust rejects with { kind, message } objects - prefer the human-readable
 *  message field and fall back to the kind when message is absent. */
function extractErrorMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    const obj = err as Record<string, unknown>
    if ('message' in obj && typeof obj.message === 'string') return obj.message
    if ('kind' in obj && typeof obj.kind === 'string') return obj.kind
  }
  if (err instanceof Error) return err.message
  return String(err)
}

/** Cancel a render, swallowing any errors during cleanup. */
async function safeCancelRender(renderId: string): Promise<void> {
  try {
    await cancelRender(renderId)
  } catch {
    // Ignore cancel errors during cleanup
  }
}

export function useRenderVideo(): UseRenderVideoResult {
  const [state, setState] = useState<RenderState>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [outputPath, setOutputPath] = useState<string | null>(null)

  const renderIdRef = useRef<string | null>(null)
  const cancelledRef = useRef(false)
  const finishedRef = useRef(false)

  const render = useCallback(async (opts: RenderOptions): Promise<string | null> => {
    const { resolved, format, outputPath: outPath, fonts, ffmpegDirectory } = opts

    setState('rendering')
    setProgress(0)
    setError(null)
    setOutputPath(null)
    cancelledRef.current = false
    finishedRef.current = false
    renderIdRef.current = null

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

        // If cancel arrived while startRender was awaiting, cancel
        // the newly started render immediately.
        if (cancelledRef.current) {
          await safeCancelRender(renderId)
          renderIdRef.current = null
          return null
        }

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
        finishedRef.current = true
        setState('done')
        setOutputPath(result)
        setProgress(1)
        return result
      } finally {
        unsubProgress()
      }
    } catch (err: unknown) {
      // Always cancel the render on error to clean up the ffmpeg process.
      if (renderIdRef.current && !finishedRef.current) {
        await safeCancelRender(renderIdRef.current)
        renderIdRef.current = null
      }

      if (cancelledRef.current) return null

      setState('error')
      setError(extractErrorMessage(err))
      throw err
    }
  }, [])

  const cancel = useCallback(() => {
    cancelledRef.current = true
    // If the render has already finished, treat this as a no-op rather than
    // flipping the state to 'cancelled' while the output is being committed.
    if (finishedRef.current) return
    setState('cancelled')
    if (renderIdRef.current) {
      void safeCancelRender(renderIdRef.current)
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
