/**
 * Motion Marketplace e2e fixture (issue #327 skeleton; #338 fills it).
 *
 * Installs Tauri mocks for Motion prefs, library folder, font availability,
 * project folder states, ffmpeg detection and the four render commands.
 */
import type { Page } from '@playwright/test'

export interface MotionMockOptions {
  /** Override motion_prefs.json contents */
  prefs?: Record<string, unknown>
  /** Library folder path and template files to serve */
  libraryFolder?: {
    path: string
    files?: { name: string; contents: string }[]
  }
  /** Whether the Cabrito font is installed */
  fontInstalled?: boolean
  /** Project folder path and what it contains */
  projectFolder?: {
    path: string
    hasBreadcrumbs?: boolean
    hasGraphics?: boolean
  }
  /** Whether ffmpeg is available */
  ffmpegAvailable?: boolean
}

/**
 * Install Motion-specific IPC mocks into the page.
 *
 * Stub - #338 replaces the body with a full mock layer that records writes,
 * clipboard and render frames.
 */
export async function installMotionMocks(
  _page: Page,
  _options?: MotionMockOptions
): Promise<void> {
  // Skeleton - #338 fills this
}
