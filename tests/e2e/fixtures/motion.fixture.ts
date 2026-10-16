/**
 * Motion Marketplace e2e fixture (issue #338).
 *
 * Installs Tauri mocks for Motion prefs, library folder, font availability,
 * project folder states, ffmpeg detection and the four render commands.
 * Records writes, clipboard and render frames for assertion.
 *
 * Designed to layer on top of setupTauriMocks() from mocks.fixture.ts:
 * call setupTauriMocks first to get the shared mock, then installMotionMocks
 * which patches __TAURI_INTERNALS__.invoke to intercept Motion-specific
 * commands before falling through to the shared handler.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Page } from '@playwright/test'

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface MotionMockOptions {
  /** Override motion_prefs.json contents */
  prefs?: Record<string, unknown>
  /** Library folder path and template files to serve */
  libraryFolder?: {
    path: string
    files?: { name: string; contents: string; isFile?: boolean }[]
    /** File that should cause a read error (simulates an invalid template) */
    brokenFile?: { name: string; errorMessage: string }
  }
  /** Whether the Cabrito font is installed (default: true) */
  fontInstalled?: boolean
  /** Font bytes to serve (base64-encoded). When fontInstalled is true and
   *  this is null, the fixture reads Inter-Bold.woff2 from the fonts dir. */
  fontBytesBase64?: string | null
  /** Project folder path and what it contains */
  projectFolder?: {
    path: string
    hasBreadcrumbs?: boolean
    hasGraphicsMotion?: boolean
    /** Existing folder names inside Graphics/Motion/ for dedup testing */
    existingMotionFolders?: string[]
  }
  /** Whether ffmpeg is available (default: true) */
  ffmpegAvailable?: boolean
  /** Render progress events to emit (frame count increments) */
  renderProgressFrames?: number[]
}

// ---------------------------------------------------------------------------
// Read the Inter-Bold.woff2 font and convert to base64 for injection
// ---------------------------------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FONT_PATH = path.resolve(__dirname, 'fonts', 'Inter-Bold.woff2')
let fontBase64Cache: string | null = null

function loadFontBase64(): string {
  if (fontBase64Cache) return fontBase64Cache
  const bytes = fs.readFileSync(FONT_PATH)
  fontBase64Cache = bytes.toString('base64')
  return fontBase64Cache
}

// ---------------------------------------------------------------------------
// Default prefs
// ---------------------------------------------------------------------------

const DEFAULT_PREFS: Record<string, unknown> = {
  libraryFolder: null,
  defaultFormat: { width: 3840, height: 2160, fps: 50 },
  favourites: [],
  defaults: {},
  lastProjectFolder: null,
  rememberedTargets: null
}

// ---------------------------------------------------------------------------
// installMotionMocks
// ---------------------------------------------------------------------------

/**
 * Install Motion-specific IPC mocks into the page.
 *
 * Must be called AFTER setupTauriMocks so that __TAURI_INTERNALS__ exists.
 * Wraps the existing invoke to intercept Motion commands first.
 */
export async function installMotionMocks(
  page: Page,
  options?: MotionMockOptions
): Promise<void> {
  const fontInstalled = options?.fontInstalled ?? true
  const fontBytesB64 = fontInstalled
    ? (options?.fontBytesBase64 ?? loadFontBase64())
    : null
  const ffmpegAvailable = options?.ffmpegAvailable ?? true

  // Auto-set prefs.libraryFolder when a libraryFolder option is provided
  const mergedPrefs = { ...DEFAULT_PREFS, ...options?.prefs }
  if (options?.libraryFolder && !options?.prefs?.libraryFolder) {
    mergedPrefs.libraryFolder = options.libraryFolder.path
  }

  const config = {
    prefs: mergedPrefs,
    libraryFolder: options?.libraryFolder ?? null,
    fontInstalled,
    fontBytesB64,
    projectFolder: options?.projectFolder ?? null,
    ffmpegAvailable,
    renderProgressFrames: options?.renderProgressFrames ?? [5, 10, 15, 20, 25]
  }

  await page.addInitScript((cfg: typeof config) => {
    // -----------------------------------------------------------------------
    // Types
    // -----------------------------------------------------------------------
    type InvokeFn = (
      cmd: string,
      args?: unknown,
      options?: { headers?: Record<string, string> }
    ) => Promise<unknown>

    type MotionRecordedWrite = {
      path: string
      data: string | number[]
      kind: 'text' | 'binary'
    }
    type MotionRecordedRename = { oldPath: string; newPath: string }
    type MotionRecordedRemove = { path: string }
    type MotionRecordedFrame = { renderId: string; byteLength: number }

    interface MotionMockState {
      writes: MotionRecordedWrite[]
      renames: MotionRecordedRename[]
      removes: MotionRecordedRemove[]
      clipboard: string | null
      renderFrames: MotionRecordedFrame[]
      renderIds: string[]
      renderCancelled: Set<string>
      renderProgress: Map<string, number>
      /** Live copy of prefs - mutated on writes, returned on reads */
      prefs: Record<string, unknown>
      /** Track created dirs for exists checks */
      createdDirs: Set<string>
      /** Counter for dedup: lower-third-glide-name -> count */
      folderCounter: Map<string, number>
    }

    type E2EWindow = Window & {
      __TAURI_INTERNALS__?: { invoke: InvokeFn }
      __MOTION_MOCK__?: MotionMockState
      __E2E_CALLBACKS__?: Record<number, (response: unknown) => void>
    }

    const win = window as E2EWindow
    if (!win.__TAURI_INTERNALS__) return

    // -----------------------------------------------------------------------
    // State
    // -----------------------------------------------------------------------
    const state: MotionMockState = {
      writes: [],
      renames: [],
      removes: [],
      clipboard: null,
      renderFrames: [],
      renderIds: [],
      renderCancelled: new Set(),
      renderProgress: new Map(),
      prefs: cfg.prefs,
      createdDirs: new Set(),
      folderCounter: new Map()
    }
    win.__MOTION_MOCK__ = state

    // -----------------------------------------------------------------------
    // App data dir (must match mocks.fixture.ts)
    // -----------------------------------------------------------------------
    const APP_DATA_DIR = '/tmp/bucket-test/data'
    const PREFS_PATH = `${APP_DATA_DIR}/motion_prefs.json`
    const FONT_DIR = '/tmp/bucket-test/fonts'
    const FONT_PATH = `${FONT_DIR}/Cabrito.otf`

    // Serialise prefs to bytes (plugin:fs|read_text_file returns bytes)
    const asBytes = (text: string) => Array.from(new TextEncoder().encode(text))

    // Helpers
    const base64ToUint8Array = (b64: string): number[] => {
      const binary = atob(b64)
      const arr = new Array<number>(binary.length)
      for (let i = 0; i < binary.length; i++) {
        arr[i] = binary.charCodeAt(i)
      }
      return arr
    }

    // -----------------------------------------------------------------------
    // Wrap invoke
    // -----------------------------------------------------------------------
    const originalInvoke = win.__TAURI_INTERNALS__!.invoke.bind(win.__TAURI_INTERNALS__)

    let nextRenderId = 1
    let nextListenerId = 100_000 // high range to avoid collisions with shared mock

    const motionInvoke: InvokeFn = async (cmd, args, options) => {
      const payload = (args ?? {}) as Record<string, unknown>
      const headers = options?.headers ?? {}

      // ----- Path plugin -----
      // fontDir returns the system font directory
      if (cmd === 'plugin:path|font_dir') {
        return FONT_DIR
      }

      // ----- Font availability -----
      if (cmd === 'plugin:fs|exists') {
        const p = String(payload.path ?? '')
        // Font path check
        if (p === FONT_PATH) {
          return cfg.fontInstalled
        }
        // Project folder Graphics/Motion subdir checks
        if (cfg.projectFolder && p.startsWith(cfg.projectFolder.path)) {
          const rel = p.slice(cfg.projectFolder.path.length)
          if (rel === '/breadcrumbs.json')
            return cfg.projectFolder.hasBreadcrumbs ?? false
          if (rel === '/Graphics/Motion')
            return cfg.projectFolder.hasGraphicsMotion ?? true
          // Check existing motion folder names for dedup
          if (cfg.projectFolder.existingMotionFolders) {
            for (const folder of cfg.projectFolder.existingMotionFolders) {
              if (rel === `/Graphics/Motion/${folder}`) return true
            }
          }
          // Check dynamically created dirs
          if (state.createdDirs.has(p)) return true
        }
        // Check dynamically created dirs
        if (state.createdDirs.has(p)) return true
        // Fall through to shared mock
        return originalInvoke(cmd, args, options)
      }

      // ----- Read font bytes -----
      if (cmd === 'plugin:fs|read_file') {
        const p = String(payload.path ?? '')
        if (p === FONT_PATH && cfg.fontBytesB64) {
          return base64ToUint8Array(cfg.fontBytesB64)
        }
        return originalInvoke(cmd, args, options)
      }

      // ----- Read text file (prefs, templates, breadcrumbs) -----
      if (cmd === 'plugin:fs|read_text_file') {
        const p = String(payload.path ?? '')
        // Prefs
        if (p === PREFS_PATH) {
          return asBytes(JSON.stringify(state.prefs))
        }
        // Library template files
        if (cfg.libraryFolder) {
          const libPath = cfg.libraryFolder.path
          if (p.startsWith(libPath + '/')) {
            const fileName = p.slice(libPath.length + 1)
            // Check broken file first
            if (cfg.libraryFolder.brokenFile?.name === fileName) {
              throw new Error(cfg.libraryFolder.brokenFile.errorMessage)
            }
            const file = cfg.libraryFolder.files?.find(f => f.name === fileName)
            if (file) {
              return asBytes(file.contents)
            }
            throw new Error(`File not found: ${p}`)
          }
        }
        // Breadcrumbs
        if (cfg.projectFolder && p === `${cfg.projectFolder.path}/breadcrumbs.json`) {
          if (cfg.projectFolder.hasBreadcrumbs) {
            return asBytes(
              JSON.stringify({
                projectTitle: 'Test Project',
                parentFolder: cfg.projectFolder.path
              })
            )
          }
        }
        return originalInvoke(cmd, args, options)
      }

      // ----- Read directory (library folder) -----
      if (cmd === 'plugin:fs|read_dir') {
        const p = String(payload.path ?? '')
        if (cfg.libraryFolder && p === cfg.libraryFolder.path) {
          const entries = (cfg.libraryFolder.files ?? []).map(f => ({
            name: f.name,
            isFile: f.isFile !== false,
            isDirectory: false,
            isSymlink: false
          }))
          // Add broken file to listing so loadLibrary tries to read it
          if (cfg.libraryFolder.brokenFile) {
            entries.push({
              name: cfg.libraryFolder.brokenFile.name,
              isFile: true,
              isDirectory: false,
              isSymlink: false
            })
          }
          return entries
        }
        return originalInvoke(cmd, args, options)
      }

      // ----- Write text file (prefs, exports) -----
      if (cmd === 'plugin:fs|write_text_file') {
        const headerPath = headers.path
        const p = headerPath ? decodeURIComponent(headerPath) : ''
        // Prefs write
        if (p === PREFS_PATH) {
          // Data is the second arg (Uint8Array-like)
          const data = args as unknown
          let text = ''
          if (data instanceof Uint8Array || ArrayBuffer.isView(data)) {
            text = new TextDecoder().decode(data as unknown as BufferSource)
          } else if (Array.isArray(data)) {
            text = new TextDecoder().decode(Uint8Array.from(data))
          }
          try {
            state.prefs = JSON.parse(text)
          } catch {
            // Keep existing prefs on invalid JSON
          }
          state.writes.push({ path: p, data: text, kind: 'text' })
          return null
        }
        // Other text writes (export files)
        if (p) {
          const data = args as unknown
          let text = ''
          if (data instanceof Uint8Array || ArrayBuffer.isView(data)) {
            text = new TextDecoder().decode(data as unknown as BufferSource)
          } else if (Array.isArray(data)) {
            text = new TextDecoder().decode(Uint8Array.from(data))
          }
          state.writes.push({ path: p, data: text, kind: 'text' })
          return null
        }
        return originalInvoke(cmd, args, options)
      }

      // ----- Write binary file (exports) -----
      if (cmd === 'plugin:fs|write_file') {
        const headerPath = headers.path
        const p = headerPath ? decodeURIComponent(headerPath) : ''
        if (p) {
          const data = args as unknown
          let bytes: number[] = []
          if (data instanceof Uint8Array) {
            bytes = Array.from(data)
          } else if (Array.isArray(data)) {
            bytes = data as number[]
          }
          state.writes.push({ path: p, data: bytes, kind: 'binary' })
          return null
        }
        return originalInvoke(cmd, args, options)
      }

      // ----- mkdir -----
      if (cmd === 'plugin:fs|mkdir') {
        const p = String(payload.path ?? '')
        if (p) {
          state.createdDirs.add(p)
        }
        return null
      }

      // ----- rename -----
      if (cmd === 'plugin:fs|rename') {
        const oldPath = String(payload.oldPath ?? '')
        const newPath = String(payload.newPath ?? '')
        state.renames.push({ oldPath, newPath })
        state.createdDirs.add(newPath)
        return null
      }

      // ----- remove -----
      if (cmd === 'plugin:fs|remove') {
        const p = String(payload.path ?? '')
        state.removes.push({ path: p })
        state.createdDirs.delete(p)
        return null
      }

      // ----- copy_file -----
      if (cmd === 'plugin:fs|copy_file') {
        const toPath = String(payload.toPath ?? '')
        state.writes.push({
          path: toPath,
          data: `[copied to ${toPath}]`,
          kind: 'text'
        })
        return null
      }

      // ----- Dialog (folder picker for library/project) -----
      if (cmd === 'plugin:dialog|open') {
        const opts = (payload.options ?? payload) as {
          directory?: boolean
          title?: string
        }
        if (opts?.directory) {
          // "Choose library folder" -> library path
          if (opts.title?.toLowerCase().includes('library') && cfg.libraryFolder) {
            return cfg.libraryFolder.path
          }
          // Project folder selection
          if (cfg.projectFolder) {
            return cfg.projectFolder.path
          }
        }
        return originalInvoke(cmd, args, options)
      }

      // ----- Opener (reveal in Finder) -----
      if (cmd === 'plugin:opener|reveal_item_in_dir') {
        // No-op in tests - recorded via the toast
        return null
      }

      // ----- Render pipeline -----
      if (cmd === 'motion_render_start') {
        const renderId = `mock-render-${nextRenderId++}`
        state.renderIds.push(renderId)
        state.renderProgress.set(renderId, 0)

        // Emit progress events asynchronously
        const totalFrames =
          (payload.request as { totalFrames?: number })?.totalFrames ?? 25
        const frames = cfg.renderProgressFrames
        setTimeout(() => {
          const callbacks = (
            win as unknown as { __E2E_CALLBACKS__?: Record<number, (r: unknown) => void> }
          ).__E2E_CALLBACKS__
          if (!callbacks) return
          const listeners = (
            win as unknown as {
              __E2E_LISTENERS__?: Map<
                string,
                Map<number, (e: { payload: unknown; id: number }) => void>
              >
            }
          ).__E2E_LISTENERS__
          if (!listeners) return

          const motionListeners = listeners.get('motion-render-progress')
          if (!motionListeners) return

          let frameIdx = 0
          const emitNext = () => {
            if (state.renderCancelled.has(renderId)) return
            if (frameIdx >= frames.length) return
            const framesWritten = frames[frameIdx]
            motionListeners.forEach((cb, id) => {
              cb({
                payload: { renderId, framesWritten, totalFrames },
                id
              })
            })
            state.renderProgress.set(renderId, framesWritten / totalFrames)
            frameIdx++
            if (frameIdx < frames.length) {
              setTimeout(emitNext, 10)
            }
          }
          setTimeout(emitNext, 10)
        }, 10)

        return renderId
      }

      if (cmd === 'motion_render_frame') {
        const renderId = headers['motion-render-id'] ?? ''
        const data = args as unknown
        let byteLength = 0
        if (data instanceof Uint8Array) {
          byteLength = data.byteLength
        } else if (Array.isArray(data)) {
          byteLength = (data as number[]).length
        }
        state.renderFrames.push({ renderId, byteLength })
        return null
      }

      if (cmd === 'motion_render_finish') {
        const renderId = String(payload.renderId ?? '')
        state.renderProgress.set(renderId, 1)
        return (
          (payload.request as { outputPath?: string })?.outputPath ?? '/mock/output.mov'
        )
      }

      if (cmd === 'motion_render_cancel') {
        const renderId = String(payload.renderId ?? '')
        state.renderCancelled.add(renderId)
        return null
      }

      // ----- Kavanagh ffmpeg detection -----
      if (cmd === 'kavanagh_detect_ffmpeg') {
        if (cfg.ffmpegAvailable) {
          return { status: 'available', directory: '/usr/local/bin' }
        }
        return { status: 'unavailable', directory: null }
      }

      // ----- Event listening (render progress) -----
      if (cmd === 'plugin:event|listen') {
        const eventName = String(payload.event ?? '')
        if (eventName === 'motion-render-progress') {
          const id = nextListenerId++
          // Register in the shared listener map
          const listeners = (
            win as unknown as {
              __E2E_LISTENERS__?: Map<
                string,
                Map<number, (e: { payload: unknown; id: number }) => void>
              >
            }
          ).__E2E_LISTENERS__
          if (listeners) {
            if (!listeners.has(eventName)) {
              listeners.set(eventName, new Map())
            }
            const handlerId = payload.handler as number | undefined
            const callbacks = (
              win as unknown as {
                __E2E_CALLBACKS__?: Record<number, (r: unknown) => void>
              }
            ).__E2E_CALLBACKS__
            if (handlerId != null && callbacks) {
              listeners.get(eventName)!.set(id, event => {
                if (callbacks[handlerId]) {
                  callbacks[handlerId](event)
                }
              })
            }
          }
          return id
        }
        return originalInvoke(cmd, args, options)
      }

      // ----- Fall through to shared mock -----
      return originalInvoke(cmd, args, options)
    }

    win.__TAURI_INTERNALS__!.invoke = motionInvoke

    // ----- Clipboard mock -----
    // Override navigator.clipboard.writeText
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async (text: string) => {
          state.clipboard = text
          return undefined
        },
        readText: async () => state.clipboard ?? ''
      },
      writable: true,
      configurable: true
    })
  }, config)
}

// ---------------------------------------------------------------------------
// Helpers for reading recorded state
// ---------------------------------------------------------------------------

/** Read the recorded writes from the Motion mock. */
export async function getMotionWrites(
  page: Page
): Promise<{ path: string; data: string | number[]; kind: string }[]> {
  return page.evaluate(() => {
    const state = (window as unknown as { __MOTION_MOCK__?: { writes: unknown[] } })
      .__MOTION_MOCK__
    return (state?.writes ?? []) as {
      path: string
      data: string | number[]
      kind: string
    }[]
  })
}

/** Read recorded renames. */
export async function getMotionRenames(
  page: Page
): Promise<{ oldPath: string; newPath: string }[]> {
  return page.evaluate(() => {
    const state = (window as unknown as { __MOTION_MOCK__?: { renames: unknown[] } })
      .__MOTION_MOCK__
    return (state?.renames ?? []) as { oldPath: string; newPath: string }[]
  })
}

/** Read recorded removes. */
export async function getMotionRemoves(page: Page): Promise<{ path: string }[]> {
  return page.evaluate(() => {
    const state = (window as unknown as { __MOTION_MOCK__?: { removes: unknown[] } })
      .__MOTION_MOCK__
    return (state?.removes ?? []) as { path: string }[]
  })
}

/** Read the captured clipboard text. */
export async function getMotionClipboard(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const state = (
      window as unknown as { __MOTION_MOCK__?: { clipboard: string | null } }
    ).__MOTION_MOCK__
    return state?.clipboard ?? null
  })
}

/** Read recorded render frames. */
export async function getMotionRenderFrames(
  page: Page
): Promise<{ renderId: string; byteLength: number }[]> {
  return page.evaluate(() => {
    const state = (window as unknown as { __MOTION_MOCK__?: { renderFrames: unknown[] } })
      .__MOTION_MOCK__
    return (state?.renderFrames ?? []) as { renderId: string; byteLength: number }[]
  })
}

/** Update the live prefs in the mock (simulates prefs change from Settings). */
export async function updateMotionPrefs(
  page: Page,
  patch: Record<string, unknown>
): Promise<void> {
  await page.evaluate(p => {
    const state = (
      window as unknown as { __MOTION_MOCK__?: { prefs: Record<string, unknown> } }
    ).__MOTION_MOCK__
    if (state) {
      Object.assign(state.prefs, p)
    }
  }, patch)
}

/** Reset all recorded state (writes, renames, removes, clipboard, render). */
export async function resetMotionState(page: Page): Promise<void> {
  await page.evaluate(() => {
    const state = (window as unknown as { __MOTION_MOCK__?: Record<string, unknown> })
      .__MOTION_MOCK__
    if (!state) return
    ;(state as { writes: unknown[] }).writes = []
    ;(state as { renames: unknown[] }).renames = []
    ;(state as { removes: unknown[] }).removes = []
    ;(state as { clipboard: string | null }).clipboard = null
    ;(state as { renderFrames: unknown[] }).renderFrames = []
  })
}
