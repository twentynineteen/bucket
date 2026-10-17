/**
 * useMotionMeasurer - shared measurer from font state (issue #348, F3)
 *
 * Returns createCanvasMeasurer() whenever the font state is not 'loading'.
 * While loading, returns undefined so the resolver uses the approximation.
 * When the font is 'missing', the canvas measurer falls back to the
 * browser's default font for that family - not the approximation.
 */
import { useMemo } from 'react'
import { createCanvasMeasurer, type TextMeasurer } from '../internal/textOverflow'
import type { useMotionFont } from './useMotionFont'

type FontState = ReturnType<typeof useMotionFont>

export function useMotionMeasurer(fontState: FontState): TextMeasurer | undefined {
  return useMemo(
    () => (fontState.status !== 'loading' ? createCanvasMeasurer() : undefined),
    [fontState.status]
  )
}
