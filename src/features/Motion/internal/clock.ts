/**
 * Test clock for Motion preview (issue #328)
 *
 * When `window.__BUCKET_MOTION_CLOCK__` is set to a finite number (by
 * Playwright `addInitScript` or in unit tests), every preview renders at
 * that fixed time. Otherwise returns null and the preview uses the real clock.
 */

/**
 * Read the test-clock override from the global scope.
 * @returns the frozen time in seconds, or null if none is set.
 */
export function readTestClock(): number | null {
  const w = globalThis as Record<string, unknown>
  const v = w.__BUCKET_MOTION_CLOCK__
  if (typeof v === 'number' && Number.isFinite(v)) return v
  return null
}
