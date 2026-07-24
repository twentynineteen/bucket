/**
 * Project-related constants for BuildProject workflow
 */

export const PROJECT_LIMITS = {
  // 0 cameras is a legitimate project (podcast/audio-only) — see issue #138
  MIN_CAMERAS: 0,
  MAX_CAMERAS: 10,
  DEFAULT_CAMERAS: 2
} as const
