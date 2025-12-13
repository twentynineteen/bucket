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
      speedMultiplier: 1
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
        __E2E_EVENTS__: Array<{ percent: number; fileIndex: number }>
        __E2E_LISTENERS__: Map<string, Map<number, EventCallback>>
        __E2E_NEXT_EVENT_ID__: number
        __E2E_CALLBACKS__: Record<number, (response: unknown) => void>
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
              console.log('[E2E Mock] Returning folder:', cfg.selectedFolder)
              return cfg.selectedFolder
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

          // Handle move_files
          if (cmd === 'move_files') {
            console.log('[E2E Mock] Mocking move_files')

            // Start async simulation
            const totalFiles = cfg.mockFiles.length || 10

            // For tests, batch multiple files per tick to avoid browser setTimeout throttling
            // Browser min setTimeout is often 4ms+ even with 0ms specified
            // For large tests we use fewer updates to complete in reasonable time
            const targetUpdates = totalFiles <= 20 ? totalFiles : totalFiles <= 100 ? 20 : 10
            const filesPerBatch = Math.max(1, Math.ceil(totalFiles / targetUpdates))
            const batchIntervalMs = Math.max(1, 50 / cfg.speedMultiplier) // With speedMultiplier=500, this is 1ms

            setTimeout(async () => {
              console.log('[E2E Mock] Starting file copy simulation, files:', totalFiles, 'filesPerBatch:', filesPerBatch, 'batchInterval:', batchIntervalMs)

              let processedFiles = 0

              while (processedFiles < totalFiles) {
                const batchEnd = Math.min(processedFiles + filesPerBatch, totalFiles)

                // Process batch
                for (let fileIndex = processedFiles; fileIndex < batchEnd; fileIndex++) {
                  // Check for failure
                  if (
                    cfg.failureInjection?.type === 'partial' &&
                    cfg.failureInjection.failingFileIndices?.includes(fileIndex)
                  ) {
                    continue
                  }
                }

                processedFiles = batchEnd
                const percent = (processedFiles / totalFiles) * 100

                win.__E2E_EVENTS__.push({ percent, fileIndex: processedFiles - 1 })
                emitEvent('copy_progress', percent)

                // Yield to browser with batched interval
                if (processedFiles < totalFiles) {
                  await new Promise((r) => setTimeout(r, batchIntervalMs))
                }
              }

              emitEvent('copy_progress', 100)
              emitEvent('copy_complete', [])
              console.log('[E2E Mock] move_files complete')
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

          // Path plugin commands
          if (cmd === 'plugin:path|resolve_directory') {
            console.log('[E2E Mock] Mocking resolve_directory')
            return '/mock/app/data'
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
      ;(window as Window & { __E2E_EVENTS__?: unknown[] }).__E2E_EVENTS__ = []
    })
    this.config.failureInjection = undefined
  }
}

/**
 * Create and configure a Tauri mock for a test
 */
export function createTauriMock(page: Page): TauriE2EMock {
  return new TauriE2EMock(page)
}
