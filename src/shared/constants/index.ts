/**
 * Shared Constants Barrel
 *
 * Re-exports timing, animation, and project constants.
 */

// Timing constants
export {
  /** Time unit conversions in milliseconds -- SECONDS.ONE, SECONDS.FIVE, etc. */
  SECONDS,
  /** Minute-scale durations in milliseconds */
  MINUTES,
  /** Hour-scale durations in milliseconds */
  HOURS,
  /** Timeout durations for network requests, file operations, and UI waits */
  TIMEOUTS,
  /** Retry count and backoff configuration for failed operations */
  RETRY,
  /** Cache TTL durations for queries and persisted data */
  CACHE,
  /** Auto-refresh intervals for polling-based data updates */
  REFRESH,
  /** Upper bounds for pagination, file sizes, and batch operations */
  LIMITS,
  /** Calculate exponential backoff delay for a given retry attempt */
  getBackoffDelay
} from './timing'

// Animation constants
export {
  /** Step card collapse and expand geometry and timing */
  STEP_CARD_ANIMATION,
  /** Staggered list animation for file selection displays */
  FILE_LIST_ANIMATION,
  /** Button hover, press, disabled, lift and glow animation values */
  BUTTON_ANIMATIONS,
  /** Baker project list stagger and stale-badge pulse variants */
  BAKER_ANIMATIONS
} from './animations'

// Project constants
/** Project creation limits -- max files, cameras, name length */
export { PROJECT_LIMITS } from './project'

// Video QC constants (issue #180)
export {
  /** Calibrated watermark match confidence default and override bounds */
  KAVANAGH_THRESHOLDS,
  /** Turns an override field into the value a run should use, or undefined for the default */
  resolveMatchConfidenceOverride,
  /** Why a match confidence override was refused, or null when it is usable */
  validateMatchConfidence
} from './kavanagh'
export type {
  /** Rejection reason for a match confidence override, or null */
  KavanaghThresholdProblem
} from './kavanagh'
