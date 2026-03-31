/**
 * Integration Test: US-03 — Build Project File Transfer Progress
 *
 * As a video editor transferring large files, when the workflow enters the
 * transferringFiles stage, I see real-time progress updates as files are copied.
 *
 * Tests the transferFiles stage function and createTransferItems utility from
 * src/features/build-project/stages/fileTransfer.ts.
 *
 * Mocking strategy: mock @tauri-apps/api/core (invoke) and @tauri-apps/api/event
 * (listen) since the stage function is a pure function that orchestrates Tauri calls.
 *
 * Note: vite.config.ts has `mockReset: true` so mock implementations must be set
 * in each test or beforeEach — they are reset between tests.
 */

import {
  createTransferItems,
  formatBytes,
  formatTimeRemaining,
  transferFiles
} from '../../src/features/build-project/stages/fileTransfer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock Tauri core — transferFiles calls invoke('transfer_files_with_progress', ...)
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

// Mock Tauri event — transferFiles listens for progress and completion events
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
  emit: vi.fn()
}))

// ============================================================================
// Helpers
// ============================================================================

const mockFiles = [
  { source: '/volumes/drive/cam1.braw', destination: '/projects/My Project/Footage/Camera 1/cam1.braw' },
  { source: '/volumes/drive/cam2.braw', destination: '/projects/My Project/Footage/Camera 2/cam2.braw' },
  { source: '/volumes/drive/cam3.braw', destination: '/projects/My Project/Footage/Camera 1/cam3.braw' }
]

// ============================================================================
// US-03: File Transfer Progress — transferFiles stage function
// ============================================================================

describe('US-03 — File Transfer Progress', () => {
  beforeEach(async () => {
    // mockReset: true clears implementations between tests, so re-apply defaults here
    const { invoke } = await import('@tauri-apps/api/core')
    const { listen, emit } = await import('@tauri-apps/api/event')

    vi.mocked(invoke).mockResolvedValue('default-op-id')
    vi.mocked(listen).mockResolvedValue(vi.fn())
    vi.mocked(emit).mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // US-03a: Validation
  it('US-03a — should return failure result when files array is empty', async () => {
    const result = await transferFiles({ files: [] })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.kind).toBe('Validation')
      expect(result.error.message).toContain('No files provided')
    }
  })

  it('US-03b — should invoke transfer_files_with_progress with the files request', async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    const { listen } = await import('@tauri-apps/api/event')

    const OPERATION_ID = 'op-test-12345'
    vi.mocked(invoke).mockResolvedValue(OPERATION_ID)

    // Capture listeners to fire events later
    const handlers: Record<string, (event: any) => void> = {}
    vi.mocked(listen).mockImplementation((eventName: string, handler: any) => {
      handlers[eventName] = handler
      return Promise.resolve(vi.fn())
    })

    const transferPromise = transferFiles({ files: mockFiles })

    // Allow listeners to be set up
    await new Promise((resolve) => setTimeout(resolve, 15))

    // Fire completion event
    if (handlers['file-transfer-complete']) {
      handlers['file-transfer-complete']({
        payload: { operationId: OPERATION_ID, success: true, filesTransferred: 3, error: null }
      })
    }

    const result = await transferPromise

    expect(invoke).toHaveBeenCalledWith(
      'transfer_files_with_progress',
      expect.objectContaining({
        request: { files: mockFiles }
      })
    )
    expect(result.ok).toBe(true)
  })

  it('US-03c — should set up progress and completion event listeners', async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    const { listen } = await import('@tauri-apps/api/event')

    const OPERATION_ID = 'op-listeners-test'
    vi.mocked(invoke).mockResolvedValue(OPERATION_ID)

    const handlers: Record<string, (event: any) => void> = {}
    vi.mocked(listen).mockImplementation((eventName: string, handler: any) => {
      handlers[eventName] = handler
      return Promise.resolve(vi.fn())
    })

    const transferPromise = transferFiles({ files: mockFiles })
    await new Promise((resolve) => setTimeout(resolve, 15))

    // Fire completion
    if (handlers['file-transfer-complete']) {
      handlers['file-transfer-complete']({
        payload: { operationId: OPERATION_ID, success: true, filesTransferred: 3, error: null }
      })
    }

    await transferPromise

    // Verify both event listeners were registered
    const listenEventNames = vi.mocked(listen).mock.calls.map(([name]) => name)
    expect(listenEventNames).toContain('file-transfer-progress')
    expect(listenEventNames).toContain('file-transfer-complete')
  })

  it('US-03d — should call onProgress callback when progress events arrive', async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    const { listen } = await import('@tauri-apps/api/event')

    const OPERATION_ID = 'op-progress-test'
    vi.mocked(invoke).mockResolvedValue(OPERATION_ID)

    const handlers: Record<string, (event: any) => void> = {}
    vi.mocked(listen).mockImplementation((eventName: string, handler: any) => {
      handlers[eventName] = handler
      return Promise.resolve(vi.fn())
    })

    const progressUpdates: number[] = []
    const onProgress = vi.fn((progress: any) => {
      progressUpdates.push(progress.percentage)
    })

    const transferPromise = transferFiles({ files: mockFiles, onProgress })
    await new Promise((resolve) => setTimeout(resolve, 15))

    // Simulate incremental progress events
    const fire = (filesCompleted: number, pct: number) => {
      handlers['file-transfer-progress']?.({
        payload: {
          operationId: OPERATION_ID,
          currentFile: `/volumes/drive/cam${filesCompleted}.braw`,
          filesCompleted,
          totalFiles: 3,
          bytesTransferred: Math.round((pct / 100) * 1_500_000_000),
          totalBytes: 1_500_000_000,
          percentage: pct,
          bytesPerSecond: 100_000_000,
          estimatedTimeRemaining: Math.round(((100 - pct) / 100) * 15_000)
        }
      })
    }

    fire(1, 33)
    fire(2, 66)
    fire(3, 100)

    // Fire completion
    handlers['file-transfer-complete']?.({
      payload: { operationId: OPERATION_ID, success: true, filesTransferred: 3, error: null }
    })

    await transferPromise

    expect(onProgress).toHaveBeenCalledTimes(3)
    expect(progressUpdates).toEqual([33, 66, 100])
  })

  it('US-03e — should return completed result after successful transfer', async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    const { listen } = await import('@tauri-apps/api/event')

    const OPERATION_ID = 'op-success'
    vi.mocked(invoke).mockResolvedValue(OPERATION_ID)

    const handlers: Record<string, (event: any) => void> = {}
    vi.mocked(listen).mockImplementation((eventName: string, handler: any) => {
      handlers[eventName] = handler
      return Promise.resolve(vi.fn())
    })

    const transferPromise = transferFiles({ files: mockFiles })
    await new Promise((resolve) => setTimeout(resolve, 15))

    handlers['file-transfer-complete']?.({
      payload: { operationId: OPERATION_ID, success: true, filesTransferred: 3, error: null }
    })

    const result = await transferPromise
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.filesTransferred).toBe(3)
    }
  })

  it('US-03f — should return InsufficientSpace failure when Tauri invoke fails with disk full', async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    vi.mocked(invoke).mockRejectedValue(new Error('Disk full — no space available'))

    const result = await transferFiles({ files: mockFiles })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.kind).toBe('InsufficientSpace')
    }
  })

  it('US-03g — should map permission error correctly', async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    vi.mocked(invoke).mockRejectedValue(new Error('Permission denied: /volumes/drive'))

    const result = await transferFiles({ files: mockFiles })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.kind).toBe('Permission')
    }
  })

  it('US-03h — should return failure when transfer complete event reports failure', async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    const { listen } = await import('@tauri-apps/api/event')

    const OPERATION_ID = 'op-fail-test'
    vi.mocked(invoke).mockResolvedValue(OPERATION_ID)

    const handlers: Record<string, (event: any) => void> = {}
    vi.mocked(listen).mockImplementation((eventName: string, handler: any) => {
      handlers[eventName] = handler
      return Promise.resolve(vi.fn())
    })

    const transferPromise = transferFiles({ files: mockFiles })
    await new Promise((resolve) => setTimeout(resolve, 15))

    handlers['file-transfer-complete']?.({
      payload: { operationId: OPERATION_ID, success: false, filesTransferred: 0, error: 'IO error during copy' }
    })

    const result = await transferPromise

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.message).toContain('IO error during copy')
    }
  })

  it('US-03i — should respect AbortSignal and return Cancelled result', async () => {
    const { invoke } = await import('@tauri-apps/api/core')

    // Transfer that's already aborted before it starts
    const controller = new AbortController()
    controller.abort()

    vi.mocked(invoke).mockResolvedValue('op-cancelled')

    const result = await transferFiles({
      files: mockFiles,
      signal: controller.signal
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.kind).toBe('Cancelled')
    }
  })

  it('US-03j — should ignore progress events for different operation IDs', async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    const { listen } = await import('@tauri-apps/api/event')

    const OPERATION_ID = 'op-correct'
    vi.mocked(invoke).mockResolvedValue(OPERATION_ID)

    const handlers: Record<string, (event: any) => void> = {}
    vi.mocked(listen).mockImplementation((eventName: string, handler: any) => {
      handlers[eventName] = handler
      return Promise.resolve(vi.fn())
    })

    const onProgress = vi.fn()

    const transferPromise = transferFiles({ files: mockFiles, onProgress })
    await new Promise((resolve) => setTimeout(resolve, 15))

    // Simulate progress for a DIFFERENT operation ID — should be ignored
    handlers['file-transfer-progress']?.({
      payload: { operationId: 'op-different', filesCompleted: 1, totalFiles: 3, percentage: 33 }
    })

    // Fire completion for the correct operation
    handlers['file-transfer-complete']?.({
      payload: { operationId: OPERATION_ID, success: true, filesTransferred: 3, error: null }
    })

    await transferPromise

    // onProgress should NOT have been called for the wrong operation
    expect(onProgress).not.toHaveBeenCalled()
  })
})

// ============================================================================
// US-03: Utility functions (pure — no mocking needed)
// ============================================================================

describe('US-03 — File Transfer Utilities', () => {
  describe('createTransferItems', () => {
    it('should create destination paths with correct camera folder structure', () => {
      const footageFiles = [
        { file: { path: '/source/a.braw', name: 'a.braw' }, camera: 1 },
        { file: { path: '/source/b.braw', name: 'b.braw' }, camera: 2 },
        { file: { path: '/source/c.braw', name: 'c.braw' }, camera: 1 }
      ]

      const items = createTransferItems(footageFiles, '/projects/My Documentary')

      expect(items).toHaveLength(3)
      expect(items[0].source).toBe('/source/a.braw')
      expect(items[0].destination).toBe(
        '/projects/My Documentary/Footage/Camera 1/a.braw'
      )
      expect(items[1].destination).toBe(
        '/projects/My Documentary/Footage/Camera 2/b.braw'
      )
      expect(items[2].destination).toBe(
        '/projects/My Documentary/Footage/Camera 1/c.braw'
      )
    })

    it('should return empty array for empty footage files', () => {
      expect(createTransferItems([], '/projects/Empty')).toEqual([])
    })
  })

  describe('formatBytes', () => {
    it('should format zero bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 B')
    })

    it('should format kilobytes correctly', () => {
      expect(formatBytes(1024)).toBe('1 KB')
    })

    it('should format megabytes correctly', () => {
      expect(formatBytes(1024 * 1024)).toBe('1 MB')
    })

    it('should format gigabytes correctly', () => {
      expect(formatBytes(1.5 * 1024 * 1024 * 1024)).toBe('1.5 GB')
    })
  })

  describe('formatTimeRemaining', () => {
    it('should format seconds', () => {
      expect(formatTimeRemaining(30_000)).toBe('30s')
    })

    it('should format minutes and seconds', () => {
      expect(formatTimeRemaining(150_000)).toBe('2m 30s')
    })

    it('should format hours and minutes', () => {
      expect(formatTimeRemaining(7_200_000)).toBe('2h 0m')
    })

    it('should return 0s for zero or negative duration', () => {
      expect(formatTimeRemaining(0)).toBe('0s')
      expect(formatTimeRemaining(-100)).toBe('0s')
    })
  })
})
