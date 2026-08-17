/**
 * Kavanagh feature barrel (issue #180)
 *
 * Named re-exports only. Internal helpers under `internal/` stay unexported.
 */

// Components
/** Page for running QC checks on a render: watermark presence and closing sting */
export { default as KavanaghPage } from './components/KavanaghPage'

// Hooks
/** Hook resolving whether QC can run: ffmpeg toolchain plus both reference pools */
export { useKavanaghAvailability } from './hooks/useKavanaghAvailability'
export type { UseKavanaghAvailabilityResult } from './hooks/useKavanaghAvailability'
/** Hook owning one run: start, progress, cancel, and the report it produced */
export { useKavanaghCheck } from './hooks/useKavanaghCheck'
export type { UseKavanaghCheckResult } from './hooks/useKavanaghCheck'

// Types
/** Whether the ffmpeg toolchain was found, and where, or why not */
export type { FfmpegAvailability } from './types'
/** Everything one run concluded: the verdict, and both checks' own results */
export type { KavanaghCheckReport } from './types'
/** What the closing tail measured, and what is wrong with it */
export type { KavanaghTailAnalysis } from './types'
/** What the closing sting matched, and whether it was held steady */
export type { KavanaghStingReport } from './types'
/** Everything one watermark run concluded, including gaps and in-memory evidence */
export type { KavanaghWatermarkReport } from './types'
/** Why a QC run did not produce a report, tagged by cause */
export type { KavanaghError } from './types'
