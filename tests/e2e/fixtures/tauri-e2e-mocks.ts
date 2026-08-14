/**
 * Tauri E2E Mocks
 *
 * Provides mock implementations for Tauri IPC commands used in E2E tests.
 * All mocks are injected via addInitScript to ensure they're available
 * BEFORE React loads and sets up event listeners.
 */

import type { Page } from '@playwright/test'
import type { SimulatedFileSet, MockFile } from '../utils/large-file-simulator'

export interface FailureInjection {
  /** Error message carried on the failed `file-transfer-complete` event */
  errorMessage: string
  /**
   * File index at which the transfer aborts (default 0 — fail immediately).
   * Mirrors the real backend: any file error aborts the whole transfer;
   * there is no skip-and-continue mode.
   */
  failAtFileIndex?: number
}

export interface TauriMockConfig {
  scenario: SimulatedFileSet
  mockFiles: MockFile[]
  selectedFolder: string
  speedMultiplier: number
  failureInjection?: FailureInjection
  /** Maximum events to emit per file (caps for performance while maintaining realism) */
  maxEventsPerFile?: number
  /** External drive path for dialog returns (e.g., /Volumes/Production) */
  externalDrivePath?: string
  /** Enable intra-file progress (emit events within each file, not just per-file) */
  enableIntraFileProgress?: boolean
}

/**
 * E2E Tauri Mock Manager
 *
 * Handles setup and control of Tauri mocks during E2E tests
 */
export class TauriE2EMock {
  private page: Page
  private config: TauriMockConfig

  constructor(page: Page) {
    this.page = page
    this.config = {
      scenario: {
        name: 'default',
        totalSize: 1024 * 1024 * 1024,
        fileCount: 10,
        averageFileSize: 100 * 1024 * 1024,
        progressIntervalMs: 100
      },
      mockFiles: [],
      selectedFolder: '/mock/project/folder',
      speedMultiplier: 100, // Default speed for faster tests
      maxEventsPerFile: 10, // Default to 10 events per file
      enableIntraFileProgress: true
    }
  }

  /**
   * Configure the simulation scenario
   */
  setScenario(scenario: SimulatedFileSet): this {
    this.config.scenario = scenario
    return this
  }

  /**
   * Set mock files to use
   */
  setMockFiles(files: MockFile[]): this {
    this.config.mockFiles = files
    return this
  }

  /**
   * Set the selected folder path
   */
  setSelectedFolder(folder: string): this {
    this.config.selectedFolder = folder
    return this
  }

  /**
   * Set speed multiplier for faster tests
   */
  setSpeedMultiplier(multiplier: number): this {
    this.config.speedMultiplier = multiplier
    return this
  }

  /**
   * Inject failure for error recovery tests
   */
  injectFailure(injection: FailureInjection): this {
    this.config.failureInjection = injection
    return this
  }

  /**
   * Clear failure injection
   *
   * Deletes rather than assigning `undefined`, so that `injectMocks()` can
   * re-sync the in-page config by key and the key genuinely disappears.
   */
  clearFailure(): this {
    delete this.config.failureInjection
    return this
  }

  /**
   * Set max events per file (caps for performance while maintaining realism)
   */
  setMaxEventsPerFile(max: number): this {
    this.config.maxEventsPerFile = max
    return this
  }

  /**
   * Set external drive path for dialog returns
   */
  setExternalDrivePath(path: string): this {
    this.config.externalDrivePath = path
    return this
  }

  /**
   * Enable or disable intra-file progress (emit events within each file)
   */
  setEnableIntraFileProgress(enable: boolean): this {
    this.config.enableIntraFileProgress = enable
    return this
  }

  /**
   * Setup mocks - call this before navigating to the page
   * ALL mock logic is in addInitScript to ensure it runs before React loads
   */
  async setup(): Promise<void> {
    const config = this.config

    // Add init script that runs before page scripts - includes ALL mock logic
    await this.page.addInitScript((cfg) => {
      // Types for window extensions
      type EventCallback = (event: { payload: unknown; id: number }) => void
      type TauriInternals = {
        invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>
        transformCallback: (callback?: (response: unknown) => void, once?: boolean) => number
        convertFileSrc: (filePath: string, protocol?: string) => string
        unregisterCallback: (id: number) => void
        metadata?: {
          target: string
          currentWindow: { label: string }
          currentWebview: { label: string; windowLabel: string }
        }
      }

      // Properties added to window during E2E setup. Optional because they are
      // populated progressively below; the cast targets this shape before any of
      // them exist on the real window object.
      type E2EExtras = {
        __E2E_CONFIG__?: typeof cfg
        __E2E_EVENTS__?: Array<{ percent: number; fileIndex: number; fileProgress?: number }>
        __E2E_LISTENERS__?: Map<string, Map<number, EventCallback>>
        __E2E_NEXT_EVENT_ID__?: number
        __E2E_NEXT_OPERATION_ID__?: number
        __E2E_CALLBACKS__?: Record<number, (response: unknown) => void>
        __E2E_CANCELLED__?: boolean
        __E2E_OPERATION_IN_PROGRESS__?: boolean
        __TAURI_INTERNALS__?: TauriInternals
        __TAURI_EVENT_PLUGIN_INTERNALS__?: {
          unregisterListener: (event: string, eventId: number) => void
        }
        isTauri?: boolean
      }

      type E2EWindow = Window & E2EExtras

      const win = window as E2EWindow

      // Store config globally
      win.__E2E_CONFIG__ = cfg
      win.__E2E_EVENTS__ = []
      win.__E2E_LISTENERS__ = new Map()
      win.__E2E_NEXT_EVENT_ID__ = 1
      win.__E2E_NEXT_OPERATION_ID__ = 1
      win.__E2E_CANCELLED__ = false
      win.__E2E_OPERATION_IN_PROGRESS__ = false

      // Callback registry for transformCallback
      let callbackId = 0
      const callbacks: Record<number, (response: unknown) => void> = {}
      win.__E2E_CALLBACKS__ = callbacks

      // Helper to emit events - calls registered callbacks
      const emitEvent = (event: string, payload: unknown) => {
        const listeners = win.__E2E_LISTENERS__.get(event)
        const count = listeners?.size || 0
        console.log('[E2E Mock] Emitting', event, 'to', count, 'listeners')
        if (listeners) {
          listeners.forEach((cb, eventId) => {
            try {
              cb({ payload, id: eventId })
            } catch (e) {
              console.error('[E2E Mock] Listener error:', e)
            }
          })
        }
      }

      // Create event plugin internals
      win.__TAURI_EVENT_PLUGIN_INTERNALS__ = {
        unregisterListener: (event: string, eventId: number) => {
          const listeners = win.__E2E_LISTENERS__.get(event)
          if (listeners) {
            listeners.delete(eventId)
          }
        }
      }

      // Create __TAURI_INTERNALS__ with full mock implementation
      win.__TAURI_INTERNALS__ = {
        invoke: async (cmd: string, args?: Record<string, unknown>) => {
          console.log('[E2E Mock] invoke:', cmd, args ? Object.keys(args) : [])

          // Handle dialog plugin - file selection
          if (cmd === 'plugin:dialog|open') {
            const options = args?.options as { directory?: boolean } | undefined
            if (options?.directory) {
              // Use external drive path if configured, otherwise selected folder
              const folder = cfg.externalDrivePath || cfg.selectedFolder
              console.log('[E2E Mock] Returning folder:', folder)
              return folder
            }
            const files = cfg.mockFiles.map((f) => f.file.path)
            console.log('[E2E Mock] Returning files:', files.length)
            return files
          }

          // Handle event listening
          if (cmd === 'plugin:event|listen') {
            const eventName = args?.event as string
            const handlerId = args?.handler as number
            console.log('[E2E Mock] Registering listener for:', eventName, 'handler:', handlerId)

            const eventId = win.__E2E_NEXT_EVENT_ID__++

            if (!win.__E2E_LISTENERS__.has(eventName)) {
              win.__E2E_LISTENERS__.set(eventName, new Map())
            }

            // Create a wrapper that will call the registered callback
            const listeners = win.__E2E_LISTENERS__.get(eventName)!
            listeners.set(eventId, (event: { payload: unknown; id: number }) => {
              if (callbacks[handlerId]) {
                callbacks[handlerId](event)
              } else {
                console.warn('[E2E Mock] No callback found for handler', handlerId)
              }
            })

            console.log('[E2E Mock] Listener registered, eventId:', eventId, 'total:', listeners.size)
            return eventId
          }

          // Handle event unlisten
          if (cmd === 'plugin:event|unlisten') {
            const eventName = args?.event as string
            const eventId = args?.eventId as number
            console.log('[E2E Mock] Unregistering listener for:', eventName, 'id:', eventId)
            const listeners = win.__E2E_LISTENERS__.get(eventName)
            if (listeners) {
              listeners.delete(eventId)
            }
            return
          }

          // Handle cancel_file_transfer (mirrors src-tauri/src/build_project/commands.rs:
          // returns a boolean; the running transfer notices the flag and emits a
          // cancelled `file-transfer-complete` event)
          if (cmd === 'cancel_file_transfer') {
            console.log('[E2E Mock] Cancelling file transfer:', args?.operationId)
            win.__E2E_CANCELLED__ = true
            return true
          }

          // Handle transfer_files_with_progress with intra-file progress simulation.
          // Mirrors the real backend: returns an operation ID immediately, then runs
          // the transfer in the background emitting `file-transfer-progress` events
          // and exactly one `file-transfer-complete` event (success, failure or
          // cancellation). Any file error aborts the whole transfer.
          if (cmd === 'transfer_files_with_progress') {
            const request = args?.request as
              | { files: Array<{ source: string; destination: string }> }
              | undefined
            const requestFiles = request?.files ?? []
            const operationId = `e2e-op-${win.__E2E_NEXT_OPERATION_ID__++}`
            console.log(
              '[E2E Mock] Mocking transfer_files_with_progress:',
              operationId,
              requestFiles.length,
              'files'
            )

            // Reset cancellation flag
            win.__E2E_CANCELLED__ = false
            win.__E2E_OPERATION_IN_PROGRESS__ = true

            const totalFiles = requestFiles.length || cfg.mockFiles.length || 10
            const enableIntraFile = cfg.enableIntraFileProgress !== false
            const maxEventsPerFile = cfg.maxEventsPerFile || 100
            const BUFFER_SIZE = 8192 // 8KB - matches Rust backend

            // Calculate base interval (adjusted by speed multiplier)
            const baseIntervalMs = Math.max(1, cfg.scenario.progressIntervalMs / cfg.speedMultiplier)

            const baseName = (p: string) => p.split('/').pop() || p

            setTimeout(async () => {
              console.log('[E2E Mock] Starting file transfer simulation', {
                operationId,
                totalFiles,
                enableIntraFile,
                maxEventsPerFile,
                baseIntervalMs,
                speedMultiplier: cfg.speedMultiplier
              })

              const startedAt = Date.now()
              let filesTransferred = 0

              const emitComplete = (success: boolean, error: string | null) => {
                emitEvent('file-transfer-complete', {
                  operationId,
                  success,
                  filesTransferred,
                  error
                })
                win.__E2E_OPERATION_IN_PROGRESS__ = false
              }

              const emitProgress = (
                currentFile: string,
                bytesTransferred: number,
                totalBytes: number,
                percentage: number
              ) => {
                const elapsedMs = Math.max(1, Date.now() - startedAt)
                const bytesPerSecond = Math.round((bytesTransferred / elapsedMs) * 1000)
                const estimatedTimeRemaining =
                  percentage > 0
                    ? Math.round((elapsedMs / percentage) * (100 - percentage))
                    : 0
                emitEvent('file-transfer-progress', {
                  operationId,
                  currentFile,
                  filesCompleted: filesTransferred,
                  totalFiles,
                  bytesTransferred,
                  totalBytes,
                  percentage,
                  bytesPerSecond,
                  estimatedTimeRemaining
                })
              }

              for (let fileIndex = 0; fileIndex < totalFiles; fileIndex++) {
                // Check for cancellation
                if (win.__E2E_CANCELLED__) {
                  console.log('[E2E Mock] Transfer cancelled at file', fileIndex)
                  emitComplete(false, 'Transfer cancelled by user')
                  return
                }

                // Check for failure injection - like the real backend, a file
                // error aborts the whole transfer with a failed complete event
                if (
                  cfg.failureInjection &&
                  fileIndex >= (cfg.failureInjection.failAtFileIndex ?? 0)
                ) {
                  console.log('[E2E Mock] Failure injected at file', fileIndex)
                  emitComplete(false, cfg.failureInjection.errorMessage)
                  return
                }

                const mockFile = cfg.mockFiles[fileIndex]
                const fileSize = mockFile?.simulatedSize || cfg.scenario.averageFileSize
                const currentFile = baseName(
                  requestFiles[fileIndex]?.source || mockFile?.file.path || `file_${fileIndex}`
                )

                if (enableIntraFile) {
                  // Intra-file progress: emit events as if reading 8KB chunks
                  // Cap the number of events per file for performance
                  const theoreticalChunks = Math.ceil(fileSize / BUFFER_SIZE)
                  const eventsPerFile = Math.min(maxEventsPerFile, theoreticalChunks)

                  for (let chunk = 0; chunk < eventsPerFile; chunk++) {
                    // Check for cancellation within file
                    if (win.__E2E_CANCELLED__) {
                      console.log('[E2E Mock] Transfer cancelled during file', fileIndex)
                      emitComplete(false, 'Transfer cancelled by user')
                      return
                    }

                    // Calculate progress matching Rust formula:
                    // overall_progress = (files_completed + file_progress) / total_files * 100
                    const fileProgress = (chunk + 1) / eventsPerFile
                    const overallProgress = ((fileIndex + fileProgress) / totalFiles) * 100

                    win.__E2E_EVENTS__.push({
                      percent: overallProgress,
                      fileIndex,
                      fileProgress
                    })
                    emitProgress(
                      currentFile,
                      Math.round(fileSize * fileProgress),
                      fileSize,
                      overallProgress
                    )

                    // Only wait between chunks, not after the last one
                    if (chunk < eventsPerFile - 1) {
                      await new Promise((r) => setTimeout(r, baseIntervalMs))
                    }
                  }
                } else {
                  // One event per file
                  const percent = ((fileIndex + 1) / totalFiles) * 100
                  win.__E2E_EVENTS__.push({ percent, fileIndex })
                  emitProgress(currentFile, fileSize, fileSize, percent)
                }

                filesTransferred++

                // Small delay between files
                if (fileIndex < totalFiles - 1) {
                  await new Promise((r) => setTimeout(r, baseIntervalMs))
                }
              }

              // Ensure we emit exactly 100% at the end, then the success event
              win.__E2E_EVENTS__.push({ percent: 100, fileIndex: totalFiles - 1 })
              emitProgress('', 0, 0, 100)
              emitComplete(true, null)
              console.log(
                '[E2E Mock] Transfer complete:',
                operationId,
                'files transferred:',
                filesTransferred
              )
            }, 10)

            return operationId
          }

          // Handle other commands
          if (cmd === 'copy_premiere_project') {
            console.log('[E2E Mock] Mocking copy_premiere_project')
            return 'Premiere project created'
          }

          if (cmd === 'show_confirmation_dialog') {
            console.log('[E2E Mock] Mocking show_confirmation_dialog')
            return false
          }

          if (cmd === 'get_folder_size') {
            return cfg.scenario.totalSize
          }

          // App plugin commands
          if (cmd === 'plugin:app|version') {
            console.log('[E2E Mock] Mocking app version')
            return '0.0.0-test'
          }

          if (cmd === 'plugin:app|name') {
            console.log('[E2E Mock] Mocking app name')
            return 'Bucket'
          }

          if (cmd === 'plugin:app|tauri_version') {
            console.log('[E2E Mock] Mocking tauri version')
            return '2.0.0'
          }

          // Custom commands
          if (cmd === 'get_username') {
            console.log('[E2E Mock] Mocking get_username')
            return 'test-user'
          }

          // Path plugin commands
          if (cmd === 'plugin:path|resolve_directory') {
            console.log('[E2E Mock] Mocking resolve_directory')
            return '/mock/app/data'
          }

          // Must genuinely concatenate: the app joins the app data directory
          // to a filename, and a constant answer would collapse every settings
          // file onto one path (issue #167).
          if (cmd === 'plugin:path|join') {
            const parts = (args?.paths as string[]) ?? []
            return parts.join('/').replace(/\/{2,}/g, '/')
          }

          if (
            cmd === 'plugin:path|app_data_dir' ||
            cmd === 'plugin:path|app_config_dir' ||
            cmd === 'plugin:path|app_local_data_dir' ||
            cmd === 'plugin:path|app_cache_dir' ||
            cmd === 'plugin:path|app_log_dir'
          ) {
            console.log('[E2E Mock] Mocking', cmd)
            // No trailing separator, matching the real API (issue #167).
            return '/mock/app/data'
          }

          if (
            cmd === 'plugin:path|resource_dir' ||
            cmd === 'plugin:path|temp_dir' ||
            cmd === 'plugin:path|home_dir' ||
            cmd === 'plugin:path|desktop_dir' ||
            cmd === 'plugin:path|document_dir' ||
            cmd === 'plugin:path|download_dir'
          ) {
            console.log('[E2E Mock] Mocking', cmd)
            return '/mock/user/'
          }

          // Filesystem plugin commands
          if (cmd === 'plugin:fs|write_text_file' || cmd === 'plugin:fs|write_file') {
            console.log('[E2E Mock] Mocking writeTextFile')
            return null
          }

          if (cmd === 'plugin:fs|mkdir') {
            console.log('[E2E Mock] Mocking mkdir')
            return null
          }

          if (cmd === 'plugin:fs|exists') {
            console.log('[E2E Mock] Mocking exists')
            return false
          }

          if (cmd === 'plugin:fs|remove') {
            console.log('[E2E Mock] Mocking remove')
            return null
          }

          if (cmd === 'plugin:fs|read_text_file') {
            console.log('[E2E Mock] Mocking read_text_file')
            return '{}'
          }

          // Window plugin commands
          if (cmd === 'plugin:window|current') {
            console.log('[E2E Mock] Mocking window|current')
            return { label: 'main', kind: 'WebviewWindow' }
          }

          if (cmd.startsWith('plugin:window|')) {
            const windowCmd = cmd.replace('plugin:window|', '')
            console.log('[E2E Mock] Mocking window command:', windowCmd)
            // Handle common window commands
            if (windowCmd === 'outer_position' || windowCmd === 'inner_position') {
              return { x: 100, y: 100 }
            }
            if (windowCmd === 'outer_size' || windowCmd === 'inner_size') {
              return { width: 1280, height: 720 }
            }
            if (windowCmd === 'is_fullscreen' || windowCmd === 'is_maximized' || windowCmd === 'is_minimized') {
              return false
            }
            if (windowCmd === 'is_visible' || windowCmd === 'is_focused' || windowCmd === 'is_decorated') {
              return true
            }
            if (windowCmd === 'scale_factor') {
              return 1.0
            }
            // For setter methods, just return null (success)
            return null
          }

          // Webview plugin commands (window operations)
          if (cmd.startsWith('plugin:webview|')) {
            console.log('[E2E Mock] Mocking webview command:', cmd)
            return null
          }

          // Default: return undefined for unknown commands
          console.log('[E2E Mock] Unknown command, returning undefined:', cmd)
          return undefined
        },

        transformCallback: (callback?: (response: unknown) => void, once?: boolean) => {
          const id = ++callbackId
          if (callback) {
            callbacks[id] = once
              ? (response: unknown) => {
                  callback(response)
                  delete callbacks[id]
                }
              : callback
          }
          console.log('[E2E Mock] transformCallback registered:', id)
          return id
        },

        convertFileSrc: (filePath: string, protocol = 'asset') => {
          return `${protocol}://localhost/${encodeURIComponent(filePath)}`
        },

        unregisterCallback: (id: number) => {
          delete callbacks[id]
        },

        metadata: {
          target: 'darwin', // macOS target (can be 'windows' or 'linux')
          currentWindow: {
            label: 'main'
          },
          currentWebview: {
            label: 'main',
            windowLabel: 'main'
          }
        }
      }

      win.isTauri = true
      console.log('[E2E Mock] Full mock initialized, scenario:', cfg.scenario.name)
    }, config)
  }

  /**
   * Push the current config into an already-loaded page.
   *
   * `setup()` installs the mock as an init script that closes over the config
   * object it was handed, and stores that same object on
   * `window.__E2E_CONFIG__`. The two are one reference, so this must **mutate**
   * that object rather than replace it: reassigning `__E2E_CONFIG__` leaves the
   * mock reading the old object and every setter called after `setup()` -
   * `clearFailure()` above, most importantly - silently does nothing (issue
   * #200). Own keys are cleared first so that a key removed from the config,
   * such as `failureInjection`, is really gone in the page.
   */
  async injectMocks(): Promise<void> {
    await this.page.evaluate((config) => {
      const win = window as Window & { __E2E_CONFIG__?: Record<string, unknown> }
      const live = win.__E2E_CONFIG__
      if (!live) return
      for (const key of Object.keys(live)) {
        delete live[key]
      }
      Object.assign(live, config)
      console.log('[E2E Mock] Config updated')
    }, this.config)
  }

  /**
   * Get emitted progress events from the page
   */
  async getEmittedEvents(): Promise<Array<{ percent: number; fileIndex: number }>> {
    return this.page.evaluate(() => {
      return (
        window as Window & { __E2E_EVENTS__?: Array<{ percent: number; fileIndex: number }> }
      ).__E2E_EVENTS__ || []
    })
  }

  /**
   * Check if operation is in progress
   */
  async isOperationInProgress(): Promise<boolean> {
    return this.page.evaluate(() => {
      return (window as Window & { __E2E_OPERATION_IN_PROGRESS__?: boolean })
        .__E2E_OPERATION_IN_PROGRESS__ || false
    })
  }

  /**
   * Get current listener count for an event
   */
  async getListenerCount(eventName: string): Promise<number> {
    return this.page.evaluate((name) => {
      const listeners = (
        window as Window & { __E2E_LISTENERS__?: Map<string, Map<number, unknown>> }
      ).__E2E_LISTENERS__?.get(name)
      return listeners?.size || 0
    }, eventName)
  }

  /**
   * Reset mock state
   */
  async reset(): Promise<void> {
    await this.page.evaluate(() => {
      const win = window as Window & {
        __E2E_EVENTS__?: unknown[]
        __E2E_CANCELLED__?: boolean
        __E2E_OPERATION_IN_PROGRESS__?: boolean
      }
      win.__E2E_EVENTS__ = []
      win.__E2E_CANCELLED__ = false
      win.__E2E_OPERATION_IN_PROGRESS__ = false
    })
    delete this.config.failureInjection
  }

  /**
   * Cancel the current operation
   */
  async cancelOperation(): Promise<void> {
    await this.page.evaluate(() => {
      ;(window as Window & { __E2E_CANCELLED__?: boolean }).__E2E_CANCELLED__ = true
    })
  }

  /**
   * Check if an operation is currently in progress
   */
  async isOperationActive(): Promise<boolean> {
    return this.page.evaluate(() => {
      return (
        (window as Window & { __E2E_OPERATION_IN_PROGRESS__?: boolean })
          .__E2E_OPERATION_IN_PROGRESS__ || false
      )
    })
  }

  /**
   * Get detailed progress events including intra-file progress
   */
  async getDetailedEvents(): Promise<
    Array<{ percent: number; fileIndex: number; fileProgress?: number }>
  > {
    return this.page.evaluate(() => {
      return (
        (
          window as Window & {
            __E2E_EVENTS__?: Array<{ percent: number; fileIndex: number; fileProgress?: number }>
          }
        ).__E2E_EVENTS__ || []
      )
    })
  }
}

/**
 * Create and configure a Tauri mock for a test
 */
export function createTauriMock(page: Page): TauriE2EMock {
  return new TauriE2EMock(page)
}
