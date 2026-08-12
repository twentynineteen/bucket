/**
 * Quality Control feature barrel (issue #180)
 *
 * Named re-exports only. Internal helpers under `internal/` stay unexported.
 */

// Components
/** Page for running QC checks on a render: watermark presence and closing sting */
export { default as QualityControlPage } from './components/QualityControlPage'

// Hooks
/** Hook resolving whether QC can run: ffmpeg toolchain plus both reference pools */
export { useQcAvailability } from './hooks/useQcAvailability'
export type { UseQcAvailabilityResult } from './hooks/useQcAvailability'

// Types
/** Whether the ffmpeg toolchain was found, and where, or why not */
export type { FfmpegAvailability } from './types'
