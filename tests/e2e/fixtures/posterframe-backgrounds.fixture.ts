/**
 * Posterframe background folder E2E fixture (issue #166)
 *
 * Installs a Tauri IPC mock that can put the background folder into each of the
 * states the app must now tell apart: usable, absent, present-but-unreadable,
 * present-but-empty, never configured, and unknown-because-settings-failed.
 *
 * Note the boundary this cannot cross: IPC is mocked, so nothing here proves
 * that Tauri's real `readDir` rejects with `os error 2` for an absent directory,
 * nor that a macOS TCC denial behaves as modelled. Those are covered by
 * `docs/posterframe-background-verification.md`. The same limit applies to
 * `sprout-folders.fixture.ts`, which documents it at its own header.
 */
import type { Page } from '@playwright/test'

/** What the mocked filesystem should do with the configured background folder. */
export type FolderScenario =
  /** Folder exists and holds image files. */
  | 'ready'
  /** Folder is not on disk at all: `exists` reports false. */
  | 'missing'
  /** Folder exists but the listing rejects, as a permission denial would. */
  | 'unreadable'
  /** Folder exists and lists fine, but holds no images. */
  | 'empty'

export interface BackgroundMockOptions {
  /** State of the configured folder. Ignored when `configured` is false. */
  scenario?: FolderScenario
  /** Whether api_keys.json carries a defaultBackgroundFolder at all. */
  configured?: boolean
  /** Make reading api_keys.json fail, so settings status is an error. */
  settingsUnreadable?: boolean
  /** The configured background folder path. */
  folder?: string
  /** Whether the Cabrito poster frame font should report as installed. */
  fontInstalled?: boolean
  /**
   * Serve the Baker scan and video-link commands too, so a spec can walk
   * Baker > project > Video Links and reach the poster frame dialogs. Off by
   * default to keep the folder-only specs from paying for the scan mocks.
   */
  bakerJourney?: boolean
  /**
   * Whether the project already has a linked Sprout video. Needed to reach
   * SetPosterFrameDialog, whose trigger is disabled without a Sprout id.
   */
  withLinkedVideo?: boolean
}

export const DRIVE_ROOT = '/Volumes/E2E-Drive'
export const PROJECT_PATH = `${DRIVE_ROOT}/2026 Managing Change`
export const PROJECT_NAME = '2026 Managing Change'
export const LINKED_VIDEO_TITLE = 'Managing Change - Session 1'

export const DEFAULT_FOLDER = '/Users/e2e/Documents/backgrounds'
export const IMAGE_NAMES = ['wbs-blue.jpg', 'wbs-red.png']
export const NON_IMAGE_NAMES = ['notes.txt', 'script.md']

/**
 * Install the mock. Call before `page.goto`, since it runs as an init script.
 */
export async function installBackgroundMocks(
  page: Page,
  options: BackgroundMockOptions = {}
): Promise<void> {
  const config = {
    scenario: options.scenario ?? 'ready',
    configured: options.configured ?? true,
    settingsUnreadable: options.settingsUnreadable ?? false,
    folder: options.folder ?? DEFAULT_FOLDER,
    fontInstalled: options.fontInstalled ?? true,
    bakerJourney: options.bakerJourney ?? false,
    withLinkedVideo: options.withLinkedVideo ?? false,
    imageNames: IMAGE_NAMES,
    nonImageNames: NON_IMAGE_NAMES,
    driveRoot: DRIVE_ROOT,
    projectPath: PROJECT_PATH,
    projectName: PROJECT_NAME,
    linkedVideoTitle: LINKED_VIDEO_TITLE
  }

  await page.addInitScript((cfg: typeof config) => {
    const win = window as unknown as {
      __TAURI_INTERNALS__?: { invoke: (cmd: string, args?: unknown) => Promise<unknown> }
      __TAURI__?: unknown
      /** Every folder listing the app attempted, so tests can assert absence. */
      __backgroundListings__: string[]
      /** Monotonic id handed back for each event listener registration. */
      __nextListenerId__: number
    }

    win.__backgroundListings__ = []
    win.__nextListenerId__ = 1

    /** No trailing separator, matching the real appDataDir (issue #167). */
    const APP_DATA_DIR = '/tmp/bucket-e2e'

    const settings: Record<string, string> = { sproutVideo: 'e2e-sprout-key' }
    if (cfg.configured) settings.defaultBackgroundFolder = cfg.folder

    // plugin:fs|read_text_file returns BYTES, which the plugin then decodes.
    // Returning a string here yields garbage after Uint8Array.from().
    const settingsBytes = Array.from(new TextEncoder().encode(JSON.stringify(settings)))

    const dirEntry = (name: string) => ({
      name,
      isFile: true,
      isDirectory: false,
      isSymlink: false
    })

    const invoke = async (cmd: string, args?: unknown): Promise<unknown> => {
      const payload = (args ?? {}) as Record<string, unknown>
      const path = String((payload.path as string) ?? '')

      if (cmd === 'plugin:fs|exists') {
        if (path.includes('sprout-folder-index')) return false
        // The Cabrito font probe goes through the same exists() call.
        if (path.toLowerCase().includes('cabrito')) return cfg.fontInstalled
        if (path === cfg.folder) return cfg.scenario !== 'missing'
        // A path beside the app data directory rather than inside it is the
        // pre-#167 layout. E2E runs start already migrated. The directory
        // itself must still report as present, or every run takes the mkdir
        // branch.
        if (
          path !== APP_DATA_DIR &&
          path.startsWith(APP_DATA_DIR) &&
          !path.startsWith(`${APP_DATA_DIR}/`)
        ) {
          return false
        }
        return true
      }

      if (cmd === 'plugin:fs|read_text_file') {
        if (path.includes('sprout-folder-index')) throw 'not found'
        if (cfg.settingsUnreadable) throw 'permission denied reading api_keys.json'
        return settingsBytes
      }

      if (cmd === 'plugin:fs|read_dir') {
        win.__backgroundListings__.push(path)
        if (cfg.scenario === 'unreadable') throw 'forbidden (os error 13)'
        if (cfg.scenario === 'empty') return cfg.nonImageNames.map(dirEntry)
        return cfg.imageNames.map(dirEntry)
      }

      if (cmd === 'plugin:fs|read_file') return Array.from(new Uint8Array([1, 2, 3]))
      if (cmd === 'plugin:fs|write_text_file') return null
      if (cmd === 'plugin:fs|write_file') return null

      if (cmd === 'plugin:dialog|open') {
        const opts = (payload.options ?? payload) as {
          title?: string
          directory?: boolean
        }
        // A file picker (not a directory one) is the Add Video upload flow.
        if (!opts?.directory) return `${cfg.driveRoot}/clip.mp4`
        // Baker's folder dialog passes a `title`; the Posterframe background
        // picker does not. That is the only thing separating the two callers.
        return opts?.title ? cfg.driveRoot : '/Volumes/Media/session-bgs'
      }
      if (cmd === 'plugin:dialog|save') return '/Users/e2e/Desktop'

      // Must be a numeric listener id: returning null makes the upload hook
      // report "Failed to setup event listeners" and hide the whole panel.
      // Events are never delivered here, only registered.
      if (cmd === 'plugin:event|listen') return win.__nextListenerId__++
      if (cmd === 'plugin:event|unlisten') return null

      if (cmd === 'get_video_duration') return 120

      if (cfg.bakerJourney) {
        if (cmd === 'baker_start_scan') return 'scan-e2e-1'
        if (cmd === 'baker_get_scan_status') {
          // endTime present, so the hook's poll treats the scan as finished.
          // Events are not mocked here; the poll is the documented fallback.
          return {
            startTime: '2026-08-11T10:00:00Z',
            endTime: '2026-08-11T10:00:02Z',
            rootPath: cfg.driveRoot,
            totalFolders: 1,
            validProjects: 1,
            updatedBreadcrumbs: 0,
            createdBreadcrumbs: 0,
            totalFolderSize: 1024,
            errors: [],
            projects: [
              {
                path: cfg.projectPath,
                name: cfg.projectName,
                isValid: true,
                hasBreadcrumbs: true,
                staleBreadcrumbs: false,
                invalidBreadcrumbs: false,
                lastScanned: '2026-08-11T10:00:02Z',
                cameraCount: 1,
                validationErrors: [],
                folderSizeBytes: 1024
              }
            ]
          }
        }
        if (cmd === 'baker_get_video_links') {
          if (!cfg.withLinkedVideo) return []
          return [
            {
              url: 'https://sproutvideo.com/videos/abc123',
              sproutVideoId: 'abc123',
              title: cfg.linkedVideoTitle,
              addedAt: '2026-08-11T09:00:00Z'
            }
          ]
        }
        if (cmd === 'baker_read_breadcrumbs') {
          return {
            projectTitle: cfg.projectName,
            parentFolder: cfg.driveRoot,
            cameras: [],
            files: [],
            videoLinks: cfg.withLinkedVideo
              ? [
                  {
                    url: 'https://sproutvideo.com/videos/abc123',
                    sproutVideoId: 'abc123',
                    title: cfg.linkedVideoTitle,
                    addedAt: '2026-08-11T09:00:00Z'
                  }
                ]
              : []
          }
        }
        if (cmd === 'baker_read_raw_breadcrumbs') return null
        if (cmd === 'baker_scan_current_files') return []
        if (cmd === 'baker_get_trello_cards') return []
        if (cmd === 'get_folder_size') return 1024
      }

      if (cmd === 'get_username') return 'E2E User'
      if (cmd === 'get_version') return '0.0.0-e2e'

      // join must genuinely concatenate. The catch-all below would break the
      // cabrito probe above by returning a constant (issue #167).
      if (cmd === 'plugin:path|join') {
        const parts = (payload.paths as string[]) ?? []
        return parts.join('/').replace(/\/{2,}/g, '/')
      }

      if (cmd === 'tauri' && payload && typeof payload === 'object') {
        const inner = (payload as { cmd?: string }).cmd
        if (inner === 'plugin:path|join') {
          const parts = ((payload as { paths?: string[] }).paths as string[]) ?? []
          return parts.join('/').replace(/\/{2,}/g, '/')
        }
        if (inner?.startsWith('plugin:path|')) return APP_DATA_DIR
        return null
      }

      if (cmd.startsWith('plugin:path|')) return APP_DATA_DIR
      if (cmd.startsWith('plugin:')) return null

      return null
    }

    win.__TAURI_INTERNALS__ = {
      invoke,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...({
        metadata: {
          windows: [{ label: 'main' }],
          currentWindow: { label: 'main' }
        }
      } as any)
    }
    win.__TAURI__ = win.__TAURI_INTERNALS__
  }, config)
}

/** Every folder path the app has tried to list, in order. */
export async function attemptedListings(page: Page): Promise<string[]> {
  return page.evaluate(
    () => (window as unknown as { __backgroundListings__: string[] }).__backgroundListings__
  )
}
