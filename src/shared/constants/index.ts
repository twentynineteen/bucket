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
  /** Base duration values for animations in milliseconds */
  DURATION,
  /** CSS easing function presets for smooth transitions */
  EASING,
  /** Spring physics configuration for framer-motion animations */
  SPRING,
  /** Step card entrance and exit animation variants */
  STEP_CARD_ANIMATION,
  /** Success state animation with checkmark and scale effect */
  SUCCESS_ANIMATION,
  /** Staggered list animation for file selection displays */
  FILE_LIST_ANIMATION,
  /** Button hover, tap, and loading animation variants */
  BUTTON_ANIMATIONS,
  /** Card expand, collapse, and hover animation variants */
  CARD_ANIMATIONS,
  /** Modal open, close, and backdrop animation variants */
  MODAL_ANIMATIONS,
  /** Progress bar fill and pulse animation variants */
  PROGRESS_ANIMATIONS,
  /** Toast notification slide-in and fade animation variants */
  TOAST_ANIMATIONS,
  /** Input focus and validation animation variants */
  INPUT_ANIMATIONS,
  /** Skeleton loading shimmer animation variants */
  SKELETON_ANIMATIONS,
  /** Scroll-triggered reveal animation variants */
  SCROLL_ANIMATIONS,
  /** Drag-and-drop reorder animation variants */
  DRAG_ANIMATIONS,
  /** Baker-specific scan and folder animation variants */
  BAKER_ANIMATIONS
} from './animations'

// Project constants
/** Project creation limits -- max files, cameras, name length */
export { PROJECT_LIMITS } from './project'
