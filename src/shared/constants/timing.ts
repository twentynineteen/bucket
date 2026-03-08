/**
 * Timing Constants
 *
 * Centralized timing values for consistency across the application.
 * All values are in milliseconds unless otherwise noted.
 */

// =============================================================================
// Time Unit Helpers
// =============================================================================

export const SECONDS = 1000
export const MINUTES = 60 * SECONDS
export const HOURS = 60 * MINUTES

// =============================================================================
// API Timeouts
// =============================================================================

export const TIMEOUTS = {
  /** Default timeout for most API calls (30 seconds) */
  DEFAULT: 30 * SECONDS,

  /** Short timeout for quick operations (10 seconds) */
  SHORT: 10 * SECONDS,

  /** Extended timeout for AI generation (5 minutes) */
  AI_GENERATION: 5 * MINUTES,

  /** Timeout for user feedback prompts (30 seconds) */
  USER_FEEDBACK: 30 * SECONDS,

  /** Timeout for embedding operations (30 seconds) */
  EMBEDDING: 30 * SECONDS
} as const

// =============================================================================
// Retry Configuration
// =============================================================================

export const RETRY = {
  /** Maximum delay for exponential backoff (30 seconds) */
  MAX_DELAY_DEFAULT: 30 * SECONDS,

  /** Maximum delay for mutation retries (10 seconds) */
  MAX_DELAY_MUTATION: 10 * SECONDS,

  /** Base delay multiplier for exponential backoff */
  BASE_DELAY: 1 * SECONDS,

  /** Default number of retry attempts */
  DEFAULT_ATTEMPTS: 3
} as const

// =============================================================================
// Cache/Query Timing
// =============================================================================

export const CACHE = {
  /** Real-time data - always fresh (0) */
  REALTIME: 0,

  /** Short-lived cache (30 seconds) */
  SHORT: 30 * SECONDS,

  /** Brief cache duration (1 minute) */
  BRIEF: 1 * MINUTES,

  /** Quick cache duration (2 minutes) */
  QUICK: 2 * MINUTES,

  /** Standard cache duration (5 minutes) */
  STANDARD: 5 * MINUTES,

  /** Medium cache duration (10 minutes) */
  MEDIUM: 10 * MINUTES,

  /** Long cache duration (30 minutes) */
  LONG: 30 * MINUTES,

  /** Extended cache duration (1 hour) */
  EXTENDED: 1 * HOURS,

  /** Persistent cache duration (24 hours) */
  PERSISTENT: 24 * HOURS,

  /** GC time for brief cache (1 minute) */
  GC_BRIEF: 1 * MINUTES,

  /** GC time for short cache (2 minutes) */
  GC_SHORT: 2 * MINUTES,

  /** GC time for standard cache (5 minutes) */
  GC_STANDARD: 5 * MINUTES,

  /** GC time for medium cache (10 minutes) */
  GC_MEDIUM: 10 * MINUTES,

  /** GC time for long cache (15 minutes) */
  GC_LONG: 15 * MINUTES,

  /** GC time for extended cache (30 minutes) */
  GC_EXTENDED: 30 * MINUTES
} as const

// =============================================================================
// Refresh Intervals
// =============================================================================

export const REFRESH = {
  /** Interval for polling real-time data (30 seconds) */
  REALTIME: 30 * SECONDS,

  /** Interval for AI model status checks (30 seconds) */
  AI_MODELS: 30 * SECONDS,

  /** Interval for upload events (1 minute) */
  UPLOADS: 1 * MINUTES
} as const

// =============================================================================
// Validation Limits
// =============================================================================

export const LIMITS = {
  /** Maximum URL length (2048 characters) */
  URL_MAX_LENGTH: 2048,

  /** Maximum file size for uploads (in bytes) - 100MB */
  FILE_MAX_SIZE: 100 * 1024 * 1024,

  /** Maximum number of files per batch */
  BATCH_MAX_FILES: 100
} as const

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Calculate exponential backoff delay
 * @param attempt - The current attempt number (0-based)
 * @param maxDelay - Maximum delay in milliseconds
 * @returns Delay in milliseconds
 */
export function getBackoffDelay(
  attempt: number,
  maxDelay: number = RETRY.MAX_DELAY_DEFAULT
): number {
  return Math.min(RETRY.BASE_DELAY * Math.pow(2, attempt), maxDelay)
}
