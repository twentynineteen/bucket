/**
 * Sprout folder picker E2E fixture (issue #155)
 *
 * Installs a Tauri IPC mock that serves a real folder hierarchy and *records*
 * every `get_folders` call with a timestamp. The recording is the point: the
 * rate-limit requirements are all statements about which requests happen and
 * when, so the assertions read the call log rather than the DOM.
 *
 * Note the boundary this cannot cross: IPC is mocked, so nothing here proves
 * the TS argument keys bind to the Rust parameters. That is covered statically
 * by `src/shared/lib/__contracts__/tauri-ipc.contract.test.ts`, and against the
 * real API by `docs/sprout-folder-picker-manual-verification.md`.
 */
import type { Page } from '@playwright/test'

export interface FolderNode {
  id: string
  name: string
  parent_id: string | null
}

export interface FolderCall {
  parentId: string | null
  /** ms since the mock was installed. */
  at: number
}

export interface SproutMockOptions {
  /** Every folder in the account, at every level. */
  folders: FolderNode[]
  /** Sprout API key the app should believe is configured. */
  apiKey?: string
  /** Fail every folder request with this message instead of serving data. */
  failWith?: string
  /** Report this many remaining requests in the budget. */
  rateLimitRemaining?: number
  /** Report the level as truncated by the backend page cap. */
  truncated?: boolean
}

const DEFAULT_KEY = 'e2e-sprout-key'

/** A small two-level tree: 3 roots, one of which has 2 children. */
export const SAMPLE_TREE: FolderNode[] = [
  { id: 'root-1', name: 'Marketing', parent_id: null },
  { id: 'root-2', name: '2026 Projects', parent_id: null },
  { id: 'root-3', name: 'Archive', parent_id: null },
  { id: 'child-1', name: 'Q1 Campaign', parent_id: 'root-1' },
  { id: 'child-2', name: 'Q2 Campaign', parent_id: 'root-1' }
]

/**
 * A deep hierarchy whose breadcrumb paths are long, for the width check.
 * `2026 Projects / MSc Programmes / Module X -- Session Recordings` is the kind
 * of path a real account produces.
 */
export const DEEP_TREE: FolderNode[] = [
  { id: 'd1', name: '2026 Projects', parent_id: null },
  { id: 'd2', name: 'MSc Programmes', parent_id: 'd1' },
  { id: 'd3', name: 'Module X -- Session Recordings', parent_id: 'd2' }
]

/** A level with more folders than fit on screen, for the scrolling check. */
export function wideTree(count: number): FolderNode[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `wide-${i}`,
    name: `Folder ${String(i).padStart(3, '0')}`,
    parent_id: null
  }))
}

/**
 * Installs the mock. Must run before the app loads, so folder responses and the
 * stored API key are in place when React first renders.
 */
export async function setupSproutMocks(
  page: Page,
  options: SproutMockOptions
): Promise<void> {
  const config = {
    folders: options.folders,
    apiKey: options.apiKey ?? DEFAULT_KEY,
    failWith: options.failWith ?? null,
    rateLimitRemaining: options.rateLimitRemaining ?? 190,
    truncated: options.truncated ?? false
  }

  await page.addInitScript((cfg: typeof config) => {
    const win = window as unknown as {
      __TAURI_INTERNALS__?: { invoke: (cmd: string, args?: unknown) => Promise<unknown> }
      __TAURI__?: unknown
      __sproutFolderCalls__: Array<{ parentId: string | null; at: number }>
    }

    const installedAt = Date.now()
    win.__sproutFolderCalls__ = []

    // plugin:fs|read_text_file returns BYTES, which the plugin then decodes.
    // Returning a string here yields garbage after Uint8Array.from().
    const apiKeysBytes = Array.from(
      new TextEncoder().encode(JSON.stringify({ sproutVideo: cfg.apiKey }))
    )

    const invoke = async (cmd: string, args?: unknown): Promise<unknown> => {
      const payload = (args ?? {}) as Record<string, unknown>

      if (cmd === 'get_folders') {
        const parentId = (payload.parentId as string | null) ?? null
        win.__sproutFolderCalls__.push({ parentId, at: Date.now() - installedAt })

        if (cfg.failWith) throw cfg.failWith

        return {
          folders: cfg.folders.filter((f) => f.parent_id === parentId),
          total: cfg.folders.filter((f) => f.parent_id === parentId).length,
          truncated: cfg.truncated,
          rate_limit_remaining: cfg.rateLimitRemaining,
          rate_limit_reset: null
        }
      }

      // The picker only renders once a file is chosen, so the dialog must
      // return a path rather than null.
      if (cmd === 'plugin:dialog|open') return '/tmp/bucket-e2e/clip.mp4'
      if (cmd === 'get_video_duration') return 120
      if (cmd === 'upload_video') return null
      if (cmd === 'get_username') return 'E2E User'
      if (cmd === 'get_version') return '0.0.0-e2e'

      // Settings live in api_keys.json, read through the fs plugin.
      if (cmd === 'plugin:fs|exists') return true
      if (cmd === 'plugin:fs|read_text_file') return apiKeysBytes
      if (cmd === 'plugin:fs|write_text_file') return null
      if (cmd === 'plugin:fs|read_dir') return []

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

/** Every `get_folders` call the app has made so far, in order. */
export async function folderCalls(page: Page): Promise<FolderCall[]> {
  return page.evaluate(
    () =>
      (window as unknown as { __sproutFolderCalls__: FolderCall[] })
        .__sproutFolderCalls__ ?? []
  )
}

/** Clears the call log, so a test can assert about a specific interaction. */
export async function resetFolderCalls(page: Page): Promise<void> {
  await page.evaluate(() => {
    ;(window as unknown as { __sproutFolderCalls__: unknown[] }).__sproutFolderCalls__ =
      []
  })
}
