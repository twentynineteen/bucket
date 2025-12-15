/**
 * Unit Test: useBakerScan React Hook
 *
 * This test verifies the useBakerScan custom hook behavior.
 * It MUST FAIL initially until the hook implementation is complete.
 */

import type { ScanOptions, ScanResult } from '@/types/baker'
import { useBakerScan } from '@hooks/useBakerScan'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

// Mock Tauri invoke function
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

// Mock Tauri event listener - must return unlisten function
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(vi.fn())
}))

describe('useBakerScan Hook', () => {
  const mockScanOptions: ScanOptions = {
    maxDepth: 5,
    includeHidden: false,
    createMissing: true,
    backupOriginals: true
  }

  const mockScanResult: ScanResult = {
    startTime: '2025-01-01T00:00:00Z',
    endTime: '2025-01-01T00:05:00Z',
    rootPath: '/test/path',
    totalFolders: 100,
    totalFolderSize: 1024000,
    validProjects: 5,
    updatedBreadcrumbs: 3,
    createdBreadcrumbs: 2,
    errors: [],
    projects: []
  }

  beforeEach(async () => {
    // Use mockClear instead of clearAllMocks to preserve mock implementations
    const { invoke } = await import('@tauri-apps/api/core')
    const { listen } = await import('@tauri-apps/api/event')
    vi.mocked(invoke).mockClear()
    vi.mocked(listen).mockClear()
  })

  test('should initialize with correct default state', () => {
    const { result } = renderHook(() => useBakerScan())

    expect(result.current.scanResult).toBeNull()
    expect(result.current.isScanning).toBe(false)
    expect(result.current.error).toBeNull()
    expect(typeof result.current.startScan).toBe('function')
    expect(typeof result.current.cancelScan).toBe('function')
    expect(typeof result.current.clearResults).toBe('function')
  })

  test('should start scan and update state correctly', async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    vi.mocked(invoke).mockResolvedValue('test-scan-id')

    const { result } = renderHook(() => useBakerScan())

    await act(async () => {
      await result.current.startScan('/test/path', mockScanOptions)
    })

    expect(result.current.isScanning).toBe(true)
    expect(result.current.error).toBeNull()
    expect(invoke).toHaveBeenCalledWith('baker_start_scan', {
      rootPath: '/test/path',
      options: mockScanOptions
    })
  })

  test('should handle scan completion through events', async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    const { listen } = await import('@tauri-apps/api/event')

    vi.mocked(invoke).mockResolvedValue('test-scan-id')

    // Mock event listener for scan completion - capture the handler
    const mockUnlisten = vi.fn()
    let completeEventHandler: ((event: any) => void) | null = null

    vi.mocked(listen).mockImplementation((eventName: string, handler: any) => {
      if (eventName === 'baker_scan_complete') {
        completeEventHandler = handler
      }
      return Promise.resolve(mockUnlisten)
    })

    const { result } = renderHook(() => useBakerScan())

    await act(async () => {
      await result.current.startScan('/test/path', mockScanOptions)
    })

    expect(result.current.isScanning).toBe(true)
    expect(completeEventHandler).toBeDefined()

    // Simulate scan completion event using the captured handler
    await act(async () => {
      completeEventHandler!({
        payload: { scanId: 'test-scan-id', result: mockScanResult }
      })
    })

    // Wait for state updates to complete
    await waitFor(() => {
      expect(result.current.isScanning).toBe(false)
    })

    expect(result.current.scanResult).toEqual(mockScanResult)
  })

  test('should handle scan errors', async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    vi.mocked(invoke).mockRejectedValue(new Error('Scan failed'))

    const { result } = renderHook(() => useBakerScan())

    await act(async () => {
      await result.current.startScan('/invalid/path', mockScanOptions)
    })

    expect(result.current.isScanning).toBe(false)
    expect(result.current.error).toBe('Scan failed')
    expect(result.current.scanResult).toBeNull()
  })

  test('should cancel scan correctly', async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    vi.mocked(invoke).mockResolvedValue('test-scan-id')

    const { result } = renderHook(() => useBakerScan())

    // Start scan first
    await act(async () => {
      await result.current.startScan('/test/path', mockScanOptions)
    })

    // Then cancel it
    await act(async () => {
      result.current.cancelScan()
    })

    expect(invoke).toHaveBeenCalledWith('baker_cancel_scan', {
      scanId: 'test-scan-id'
    })
    expect(result.current.isScanning).toBe(false)
  })

  test('should clear results correctly', () => {
    const { result } = renderHook(() => useBakerScan())

    // Simulate having some results
    act(() => {
      result.current.clearResults()
    })

    expect(result.current.scanResult).toBeNull()
    expect(result.current.error).toBeNull()
    expect(result.current.isScanning).toBe(false)
  })

  test('should handle progress updates during scan', async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    const { listen } = await import('@tauri-apps/api/event')

    vi.mocked(invoke).mockResolvedValue('test-scan-id')
    vi.mocked(listen).mockResolvedValue(vi.fn())

    const { result } = renderHook(() => useBakerScan())

    await act(async () => {
      await result.current.startScan('/test/path', mockScanOptions)
    })

    // Verify progress event listener was set up
    expect(listen).toHaveBeenCalledWith('baker_scan_progress', expect.any(Function))
  })

  test('should prevent multiple simultaneous scans', async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    vi.mocked(invoke).mockResolvedValue('test-scan-id')

    const { result } = renderHook(() => useBakerScan())

    // Start first scan
    await act(async () => {
      await result.current.startScan('/test/path', mockScanOptions)
    })

    // Try to start second scan
    await act(async () => {
      await result.current.startScan('/another/path', mockScanOptions)
    })

    // Should only have called invoke once (first scan)
    expect(invoke).toHaveBeenCalledTimes(1)
  })
})
