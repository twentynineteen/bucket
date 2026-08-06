/**
 * Runtime environment detection (Issue #144)
 *
 * Bucket is a Tauri desktop app: `@tauri-apps/api` calls only work inside the
 * Tauri webview, where the `__TAURI_INTERNALS__` bridge is injected. Loading
 * the Vite dev server in a plain browser has no bridge, so anything touching
 * the window or `invoke` throws — and a throw inside a mount effect takes the
 * whole React tree down with it.
 *
 * Code that runs at mount asks here first and no-ops when the bridge is
 * absent, so `vite dev` renders the UI instead of a blank page.
 */

import { isTauri } from '@tauri-apps/api/core'

import { logger } from './logger'

let hasWarnedMissingRuntime = false

/**
 * Whether the app is running inside the Tauri webview, where native APIs
 * work. Returns false in a plain browser, warning once so an oddly empty UI
 * has a visible explanation.
 *
 * The warning is not gated on a dev-only env flag: a real build only ever
 * runs inside the webview, so this branch cannot be reached in production.
 */
export function isTauriRuntime(): boolean {
  let present = false

  try {
    present = isTauri()
  } catch {
    // A detection helper that throws is itself proof there's no bridge
    present = false
  }

  if (!present && !hasWarnedMissingRuntime) {
    hasWarnedMissingRuntime = true
    logger.warn(
      'Not running inside the Bucket desktop app — native features (window state, file access, Sprout Video uploads) are unavailable. Run `bun run dev:tauri` for the full app.'
    )
  }

  return present
}
