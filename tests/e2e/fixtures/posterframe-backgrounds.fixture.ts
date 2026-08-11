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
}

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
    imageNames: IMAGE_NAMES,
    nonImageNames: NON_IMAGE_NAMES
  }

  await page.addInitScript((cfg: typeof config) => {
    const win = window as unknown as {
      __TAURI_INTERNALS__?: { invoke: (cmd: string, args?: unknown) => Promise<unknown> }
      __TAURI__?: unknown
      /** Every folder listing the app attempted, so tests can assert absence. */
      __backgroundListings__: string[]
    }

    win.__backgroundListings__ = []

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

      if (cmd === 'plugin:dialog|open') return '/Volumes/Media/session-bgs'
      if (cmd === 'plugin:dialog|save') return '/Users/e2e/Desktop'

      if (cmd === 'get_username') return 'E2E User'
      if (cmd === 'get_version') return '0.0.0-e2e'

      if (cmd === 'tauri' && payload && typeof payload === 'object') {
        const inner = (payload as { cmd?: string }).cmd
        if (inner?.startsWith('plugin:path|')) return '/tmp/bucket-e2e/'
        return null
      }

      if (cmd.startsWith('plugin:path|')) return '/tmp/bucket-e2e/'
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
