/**
 * Test Utility: Tauri API Mocks
 * Purpose: Provide reusable mock factories for Tauri APIs
 */

import { vi } from 'vitest'

/**
 * Create a complete set of Tauri API mocks
 * Returns properly typed mocks for invoke, listen, and unlisten
 */
export const createTauriMocks = () => {
  const mockUnlisten = vi.fn()

  return {
    invoke: vi.fn().mockResolvedValue(undefined),
    listen: vi.fn().mockResolvedValue(mockUnlisten),
    emit: vi.fn().mockResolvedValue(undefined),
    mockUnlisten
  }
}

/**
 * Mock a specific Tauri command with a response
 * Usage:
 *
 * mockTauriCommand('get_folder_size', { size: 1024000 })
 * await invoke('get_folder_size', { path: '/test' }) // Returns { size: 1024000 }
 */
export const mockTauriCommand = (
  invokeMock: ReturnType<typeof vi.fn>,
  command: string,
  response: any
) => {
  invokeMock.mockImplementation((cmd: string) => {
    if (cmd === command) {
      return Promise.resolve(response)
    }
    return Promise.resolve(undefined)
  })
}

/**
 * Mock a Tauri command to reject with an error
 * Usage:
 *
 * mockTauriCommandError('invalid_command', new Error('Not found'))
 */
export const mockTauriCommandError = (
  invokeMock: ReturnType<typeof vi.fn>,
  command: string,
  error: Error
) => {
  invokeMock.mockImplementation((cmd: string) => {
    if (cmd === command) {
      return Promise.reject(error)
    }
    return Promise.resolve(undefined)
  })
}

/**
 * Create a mock event listener that triggers a callback
 * Usage:
 *
 * const { listen, triggerEvent } = createMockEventListener()
 * vi.mocked(tauriListen).mockImplementation(listen)
 *
 * // Later in test
 * triggerEvent('copy_complete', ['file1.mp4', 'file2.mp4'])
 */
export const createMockEventListener = () => {
  const listeners = new Map<string, (payload: any) => void>()
  const mockUnlisten = vi.fn()

  const listen = vi.fn((event: string, callback: (payload: any) => void) => {
    listeners.set(event, callback)
    return Promise.resolve(mockUnlisten)
  })

  const triggerEvent = (event: string, payload: any) => {
    const callback = listeners.get(event)
    if (callback) {
      callback({ payload })
    }
  }

  const clearListeners = () => {
    listeners.clear()
  }

  return {
    listen,
    triggerEvent,
    clearListeners,
    mockUnlisten
  }
}

/**
 * Mock file system operations
 */
export const createFileSystemMocks = () => {
  return {
    exists: vi.fn().mockResolvedValue(false),
    mkdir: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    writeTextFile: vi.fn().mockResolvedValue(undefined),
    readTextFile: vi.fn().mockResolvedValue('{}'),
    readDir: vi.fn().mockResolvedValue([])
  }
}

/**
 * Mock dialog operations
 */
export const createDialogMocks = () => {
  return {
    confirm: vi.fn().mockResolvedValue(true),
    message: vi.fn().mockResolvedValue(undefined),
    open: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(null)
  }
}
