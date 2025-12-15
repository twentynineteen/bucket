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
  type: 'partial' | 'complete'
  failingFileIndices?: number[]
  errorMessage: string
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
   */
  clearFailure(): this {
    this.config.failureInjection = undefined
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
        metadata?: { target: string }
      }

      interface E2EWindow extends Window {
        __E2E_CONFIG__: typeof cfg
        __E2E_EVENTS__: Array<{ percent: number; fileIndex: number; fileProgress?: number }>
        __E2E_LISTENERS__: Map<string, Map<number, EventCallback>>
        __E2E_NEXT_EVENT_ID__: number
        __E2E_CALLBACKS__: Record<number, (response: unknown) => void>
        __E2E_CANCELLED__: boolean
        __E2E_OPERATION_IN_PROGRESS__: boolean
        __TAURI_INTERNALS__?: TauriInternals
        __TAURI_EVENT_PLUGIN_INTERNALS__?: {
          unregisterListener: (event: string, eventId: number) => void
        }
        isTauri?: boolean
      }

      const win = window as E2EWindow

      // Store config globally
      win.__E2E_CONFIG__ = cfg
      win.__E2E_EVENTS__ = []
      win.__E2E_LISTENERS__ = new Map()
      win.__E2E_NEXT_EVENT_ID__ = 1
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

          // Handle cancel_copy command
          if (cmd === 'cancel_copy') {
            console.log('[E2E Mock] Cancelling copy operation')
            win.__E2E_CANCELLED__ = true
            return { success: true }
          }

          // Handle move_files with intra-file progress simulation
          if (cmd === 'move_files') {
            console.log('[E2E Mock] Mocking move_files')

            // Reset cancellation flag
            win.__E2E_CANCELLED__ = false
            win.__E2E_OPERATION_IN_PROGRESS__ = true

            const totalFiles = cfg.mockFiles.length || 10
            const enableIntraFile = cfg.enableIntraFileProgress !== false
            const maxEventsPerFile = cfg.maxEventsPerFile || 100
            const BUFFER_SIZE = 8192 // 8KB - matches Rust backend

            // Calculate base interval (adjusted by speed multiplier)
            const baseIntervalMs = Math.max(1, cfg.scenario.progressIntervalMs / cfg.speedMultiplier)

            setTimeout(async () => {
              console.log('[E2E Mock] Starting file copy simulation', {
                totalFiles,
                enableIntraFile,
                maxEventsPerFile,
                baseIntervalMs,
                speedMultiplier: cfg.speedMultiplier
              })

              const movedFiles: string[] = []

              for (let fileIndex = 0; fileIndex < totalFiles; fileIndex++) {
                // Check for cancellation
                if (win.__E2E_CANCELLED__) {
                  console.log('[E2E Mock] Operation cancelled at file', fileIndex)
                  emitEvent('copy_cancelled', { filesCompleted: fileIndex, movedFiles })
                  win.__E2E_OPERATION_IN_PROGRESS__ = false
                  return
                }

                // Check for failure injection
                if (cfg.failureInjection?.type === 'complete') {
                  console.log('[E2E Mock] Complete failure injected')
                  emitEvent('copy_error', { error: cfg.failureInjection.errorMessage })
                  win.__E2E_OPERATION_IN_PROGRESS__ = false
                  return
                }

                if (
                  cfg.failureInjection?.type === 'partial' &&
                  cfg.failureInjection.failingFileIndices?.includes(fileIndex)
                ) {
                  console.log('[E2E Mock] Partial failure at file', fileIndex)
                  // Skip this file but continue
                  continue
                }

                const mockFile = cfg.mockFiles[fileIndex]
                const fileSize = mockFile?.simulatedSize || cfg.scenario.averageFileSize

                if (enableIntraFile) {
                  // Intra-file progress: emit events as if reading 8KB chunks
                  // Cap the number of events per file for performance
                  const theoreticalChunks = Math.ceil(fileSize / BUFFER_SIZE)
                  const eventsPerFile = Math.min(maxEventsPerFile, theoreticalChunks)
                  // Note: bytesPerEvent = fileSize / eventsPerFile (used for simulation timing)

                  for (let chunk = 0; chunk < eventsPerFile; chunk++) {
                    // Check for cancellation within file
                    if (win.__E2E_CANCELLED__) {
                      console.log('[E2E Mock] Operation cancelled during file', fileIndex)
                      emitEvent('copy_cancelled', { filesCompleted: fileIndex, movedFiles })
                      win.__E2E_OPERATION_IN_PROGRESS__ = false
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
                    emitEvent('copy_progress', overallProgress)

                    // Only wait between chunks, not after the last one
                    if (chunk < eventsPerFile - 1) {
                      await new Promise((r) => setTimeout(r, baseIntervalMs))
                    }
                  }
                } else {
                  // Legacy mode: one event per file (for backward compatibility)
                  const percent = ((fileIndex + 1) / totalFiles) * 100
                  win.__E2E_EVENTS__.push({ percent, fileIndex })
                  emitEvent('copy_progress', percent)
                }

                movedFiles.push(mockFile?.file.path || `file_${fileIndex}`)

                // Small delay between files
                if (fileIndex < totalFiles - 1) {
                  await new Promise((r) => setTimeout(r, baseIntervalMs))
                }
              }

              // Ensure we emit exactly 100% at the end
              win.__E2E_EVENTS__.push({ percent: 100, fileIndex: totalFiles - 1 })
              emitEvent('copy_progress', 100)
              emitEvent('copy_complete', movedFiles)
              win.__E2E_OPERATION_IN_PROGRESS__ = false
              console.log('[E2E Mock] move_files complete, files moved:', movedFiles.length)
            }, 10)

            return { success: true }
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

          if (cmd === 'check_authentication') {
            console.log('[E2E Mock] Mocking check_authentication')
            return { authenticated: true, user: 'test-user' }
          }

          // Path plugin commands
          if (cmd === 'plugin:path|resolve_directory') {
            console.log('[E2E Mock] Mocking resolve_directory')
            return '/mock/app/data'
          }

          if (
            cmd === 'plugin:path|app_data_dir' ||
            cmd === 'plugin:path|app_config_dir' ||
            cmd === 'plugin:path|app_local_data_dir' ||
            cmd === 'plugin:path|app_cache_dir' ||
            cmd === 'plugin:path|app_log_dir'
          ) {
            console.log('[E2E Mock] Mocking', cmd)
            return '/mock/app/data/'
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
   * Inject mocks after the page has loaded (now optional - for updating config)
   * This is now mainly used to update the config if needed after page load
   */
  async injectMocks(): Promise<void> {
    // Config is already set in setup(), but we can update it here if needed
    await this.page.evaluate((config) => {
      const win = window as Window & { __E2E_CONFIG__?: typeof config }
      if (win.__E2E_CONFIG__) {
        win.__E2E_CONFIG__ = config
        console.log('[E2E Mock] Config updated')
      }
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
    this.config.failureInjection = undefined
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
