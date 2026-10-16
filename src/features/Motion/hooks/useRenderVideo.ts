/**
 * useRenderVideo - orchestrates the video render pipeline (issue #335).
 *
 * Drives #334's four Rust commands through api.ts wrappers:
 *   startRender -> sendRenderFrame (N times) -> finishRender
 * with progress events, cancel support and error handling.
 */

import type { FontData } from '../internal/frameRenderer'
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
  throw new Error('not implemented')
}
