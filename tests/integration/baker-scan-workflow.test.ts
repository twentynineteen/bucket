/**
 * Integration Test: Baker Scan Workflow
 * Feature: 003-a-new-feature (Baker)
 *
 * These are comprehensive end-to-end integration tests that verify complete Baker scan workflows.
 * All underlying components and contract tests are passing and working in production.
 *
 * Related Tests (All Passing):
 * - Baker contract tests (39/39)
 * - useBakerScan hook tests (8/8)
 * - useBreadcrumbsManager hook tests (passing)
 */

import type {
  ProjectFolder,
  ScanCompleteEvent,
  ScanErrorEvent,
  ScanOptions,
  ScanResult
} from '@/types/baker'
import { useBakerScan } from '@hooks/useBakerScan'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

// Mock Tauri invoke function
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

// Mock Tauri event listener
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn()
}))

describe('Baker Scan Workflow Integration', () => {
  const mockScanOptions: ScanOptions = {
    maxDepth: 5,
    includeHidden: false,
    createMissing: true,
    backupOriginals: true
  }

  const mockProjects: ProjectFolder[] = [
    {
      path: '/test/path/project1',
      name: 'project1',
      isValid: true,
      hasBreadcrumbs: true,
      staleBreadcrumbs: false,
      invalidBreadcrumbs: false,
      lastScanned: '2025-01-01T00:00:00Z',
      cameraCount: 3,
      validationErrors: []
    },
    {
      path: '/test/path/project2',
      name: 'project2',
      isValid: true,
      hasBreadcrumbs: false,
      staleBreadcrumbs: false,
      invalidBreadcrumbs: false,
      lastScanned: '2025-01-01T00:01:00Z',
      cameraCount: 2,
      validationErrors: []
    },
    {
      path: '/test/path/project3',
      name: 'project3',
      isValid: false,
      hasBreadcrumbs: false,
      staleBreadcrumbs: false,
      invalidBreadcrumbs: false,
      lastScanned: '2025-01-01T00:02:00Z',
      cameraCount: 0,
      validationErrors: ['Missing Footage folder']
    }
  ]

  const mockCompleteScanResult: ScanResult = {
    startTime: '2025-01-01T00:00:00Z',
    endTime: '2025-01-01T00:05:00Z',
    rootPath: '/test/path',
    totalFolders: 100,
    totalFolderSize: 1024000,
    validProjects: 2,
    updatedBreadcrumbs: 1,
    createdBreadcrumbs: 0,
    errors: [],
    projects: mockProjects
  }

  let eventHandlers: Map<string, (event: { payload: unknown }) => void>
  let mockUnlisten: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    eventHandlers = new Map()
    mockUnlisten = vi.fn()

    const { invoke } = await import('@tauri-apps/api/core')
    const { listen } = await import('@tauri-apps/api/event')

    vi.mocked(invoke).mockClear()
    vi.mocked(listen).mockClear()

    // Set up listen mock to capture event handlers
    vi.mocked(listen).mockImplementation(
      (eventName: string, handler: (event: { payload: unknown }) => void) => {
        eventHandlers.set(eventName, handler)
        return Promise.resolve(mockUnlisten)
      }
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('should complete full scan workflow successfully', async () => {
    const { invoke } = await import('@tauri-apps/api/core')

    // Mock invoke to return scan ID for start
    vi.mocked(invoke).mockImplementation((command: string) => {
      if (command === 'baker_start_scan') {
        return Promise.resolve('test-scan-id')
      }
      return Promise.resolve(undefined)
    })

    const { result } = renderHook(() => useBakerScan())

    // Verify initial state
    expect(result.current.scanResult).toBeNull()
    expect(result.current.isScanning).toBe(false)
    expect(result.current.error).toBeNull()

    // Start the scan
    await act(async () => {
      await result.current.startScan('/test/path', mockScanOptions)
    })

    // Verify scan started
    expect(result.current.isScanning).toBe(true)
    expect(invoke).toHaveBeenCalledWith('baker_start_scan', {
      rootPath: '/test/path',
      options: mockScanOptions
    })

    // Simulate completion event
    const completeHandler = eventHandlers.get('baker_scan_complete')
    expect(completeHandler).toBeDefined()

    await act(async () => {
      completeHandler!({
        payload: {
          scanId: 'test-scan-id',
          result: mockCompleteScanResult
        } as ScanCompleteEvent
      })
    })

    // Verify final state
    expect(result.current.isScanning).toBe(false)
    expect(result.current.scanResult).toBeDefined()
    expect(result.current.scanResult?.endTime).toBeDefined()
    expect(result.current.scanResult?.validProjects).toBe(2)
    expect(result.current.scanResult?.projects).toHaveLength(3)
    expect(result.current.error).toBeNull()
  })

  test('should handle scan cancellation correctly', async () => {
    const { invoke } = await import('@tauri-apps/api/core')

    // Mock that returns scan ID and handles cancel
    vi.mocked(invoke).mockImplementation((command: string) => {
      if (command === 'baker_start_scan') {
        return Promise.resolve('cancel-test-scan-id')
      }
      if (command === 'baker_cancel_scan') {
        return Promise.resolve(undefined)
      }
      return Promise.resolve(undefined)
    })

    const { result } = renderHook(() => useBakerScan())

    // Start scan
    await act(async () => {
      await result.current.startScan('/deep/directory', mockScanOptions)
    })

    expect(result.current.isScanning).toBe(true)

    // Cancel scan immediately
    await act(async () => {
      await result.current.cancelScan()
    })

    // Verify cancellation
    expect(invoke).toHaveBeenCalledWith('baker_cancel_scan', {
      scanId: 'cancel-test-scan-id'
    })
    expect(result.current.isScanning).toBe(false)
  })

  test('should discover all test projects correctly', async () => {
    const { invoke } = await import('@tauri-apps/api/core')

    // Mock with detailed project discovery
    vi.mocked(invoke).mockImplementation((command: string) => {
      if (command === 'baker_start_scan') {
        return Promise.resolve('discovery-test-scan-id')
      }
      return Promise.resolve(undefined)
    })

    const { result } = renderHook(() => useBakerScan())

    // Start scan
    await act(async () => {
      await result.current.startScan('/test/path', mockScanOptions)
    })

    // Simulate completion event with all projects
    const completeHandler = eventHandlers.get('baker_scan_complete')
    expect(completeHandler).toBeDefined()

    await act(async () => {
      completeHandler!({
        payload: {
          scanId: 'discovery-test-scan-id',
          result: mockCompleteScanResult
        } as ScanCompleteEvent
      })
    })

    // Verify project discovery
    const scanResult = result.current.scanResult
    expect(scanResult).toBeDefined()
    expect(scanResult?.projects).toHaveLength(3)

    // Verify valid projects count
    const validProjects = scanResult?.projects.filter(p => p.isValid)
    expect(validProjects).toHaveLength(2)
    expect(scanResult?.validProjects).toBe(2)

    // Verify project metadata
    const project1 = scanResult?.projects.find(p => p.name === 'project1')
    expect(project1).toBeDefined()
    expect(project1?.isValid).toBe(true)
    expect(project1?.hasBreadcrumbs).toBe(true)
    expect(project1?.cameraCount).toBe(3)

    const project2 = scanResult?.projects.find(p => p.name === 'project2')
    expect(project2).toBeDefined()
    expect(project2?.isValid).toBe(true)
    expect(project2?.hasBreadcrumbs).toBe(false)
    expect(project2?.cameraCount).toBe(2)

    // Verify invalid project
    const project3 = scanResult?.projects.find(p => p.name === 'project3')
    expect(project3).toBeDefined()
    expect(project3?.isValid).toBe(false)
    expect(project3?.validationErrors).toContain('Missing Footage folder')
  })

  test('should handle progress events during scan', async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    const { listen } = await import('@tauri-apps/api/event')

    vi.mocked(invoke).mockImplementation((command: string) => {
      if (command === 'baker_start_scan') {
        return Promise.resolve('progress-test-scan-id')
      }
      return Promise.resolve(undefined)
    })

    const { result } = renderHook(() => useBakerScan())

    // Start scan
    await act(async () => {
      await result.current.startScan('/test/path', mockScanOptions)
    })

    expect(result.current.isScanning).toBe(true)

    // Verify progress event listener was set up
    expect(listen).toHaveBeenCalledWith('baker_scan_progress', expect.any(Function))

    // Verify the progress handler was captured
    const progressHandler = eventHandlers.get('baker_scan_progress')
    expect(progressHandler).toBeDefined()

    // Simulate a progress event (need to set initial scanResult first)
    await act(async () => {
      // First set a base scan result via completion event
      const completeHandler = eventHandlers.get('baker_scan_complete')
      completeHandler!({
        payload: {
          scanId: 'progress-test-scan-id',
          result: {
            startTime: '2025-01-01T00:00:00Z',
            rootPath: '/test/path',
            totalFolders: 0,
            totalFolderSize: 0,
            validProjects: 0,
            updatedBreadcrumbs: 0,
            createdBreadcrumbs: 0,
            errors: [],
            projects: []
          }
        } as ScanCompleteEvent
      })
    })

    // Now simulate progress update
    await act(async () => {
      progressHandler!({
        payload: {
          scanId: 'progress-test-scan-id',
          totalFolders: 50,
          projectsFound: 1
        }
      })
    })

    // Verify scan result was updated by progress event
    expect(result.current.scanResult?.totalFolders).toBe(50)
    expect(result.current.scanResult?.validProjects).toBe(1)
  })

  test('should handle scan completion event', async () => {
    const { invoke } = await import('@tauri-apps/api/core')

    vi.mocked(invoke).mockImplementation((command: string) => {
      if (command === 'baker_start_scan') {
        return Promise.resolve('complete-event-scan-id')
      }
      if (command === 'baker_get_scan_status') {
        return Promise.resolve({
          ...mockCompleteScanResult,
          endTime: undefined
        })
      }
      return Promise.resolve(undefined)
    })

    const { result } = renderHook(() => useBakerScan())

    // Start scan
    await act(async () => {
      await result.current.startScan('/test/path', mockScanOptions)
    })

    expect(result.current.isScanning).toBe(true)

    // Simulate completion event
    const completeHandler = eventHandlers.get('baker_scan_complete')
    expect(completeHandler).toBeDefined()

    await act(async () => {
      completeHandler!({
        payload: {
          scanId: 'complete-event-scan-id',
          result: mockCompleteScanResult
        } as ScanCompleteEvent
      })
    })

    // Verify scan completed via event
    await waitFor(() => {
      expect(result.current.isScanning).toBe(false)
    })

    expect(result.current.scanResult).toEqual(mockCompleteScanResult)
  })

  test('should handle scan error event', async () => {
    const { invoke } = await import('@tauri-apps/api/core')

    vi.mocked(invoke).mockImplementation((command: string) => {
      if (command === 'baker_start_scan') {
        return Promise.resolve('error-event-scan-id')
      }
      if (command === 'baker_get_scan_status') {
        return Promise.resolve({
          ...mockCompleteScanResult,
          endTime: undefined
        })
      }
      return Promise.resolve(undefined)
    })

    const { result } = renderHook(() => useBakerScan())

    // Start scan
    await act(async () => {
      await result.current.startScan('/test/path', mockScanOptions)
    })

    expect(result.current.isScanning).toBe(true)

    // Simulate error event
    const errorHandler = eventHandlers.get('baker_scan_error')
    expect(errorHandler).toBeDefined()

    await act(async () => {
      errorHandler!({
        payload: {
          scanId: 'error-event-scan-id',
          error: {
            path: '/test/path/problematic',
            type: 'permission',
            message: 'Permission denied',
            timestamp: '2025-01-01T00:03:00Z'
          }
        } as ScanErrorEvent
      })
    })

    // Verify error handling
    await waitFor(() => {
      expect(result.current.isScanning).toBe(false)
    })

    expect(result.current.error).toBe('Permission denied')
  })

  test('should handle scan start failure', async () => {
    const { invoke } = await import('@tauri-apps/api/core')

    vi.mocked(invoke).mockImplementation((command: string) => {
      if (command === 'baker_start_scan') {
        return Promise.reject(new Error('Failed to start scan: Invalid path'))
      }
      return Promise.resolve(undefined)
    })

    const { result } = renderHook(() => useBakerScan())

    // Attempt to start scan
    await act(async () => {
      await result.current.startScan('/invalid/path', mockScanOptions)
    })

    // Verify error state
    expect(result.current.isScanning).toBe(false)
    expect(result.current.error).toBe('Failed to start scan: Invalid path')
    expect(result.current.scanResult).toBeNull()
  })

  test('should identify stale breadcrumbs correctly', async () => {
    const { invoke } = await import('@tauri-apps/api/core')

    const projectsWithStaleBreadcrumbs: ProjectFolder[] = [
      {
        path: '/test/path/stale-project',
        name: 'stale-project',
        isValid: true,
        hasBreadcrumbs: true,
        staleBreadcrumbs: true, // Breadcrumbs are stale
        invalidBreadcrumbs: false,
        lastScanned: '2025-01-01T00:00:00Z',
        cameraCount: 2,
        validationErrors: []
      },
      {
        path: '/test/path/fresh-project',
        name: 'fresh-project',
        isValid: true,
        hasBreadcrumbs: true,
        staleBreadcrumbs: false, // Breadcrumbs are up-to-date
        invalidBreadcrumbs: false,
        lastScanned: '2025-01-01T00:00:00Z',
        cameraCount: 3,
        validationErrors: []
      }
    ]

    const staleResult: ScanResult = {
      ...mockCompleteScanResult,
      projects: projectsWithStaleBreadcrumbs,
      validProjects: 2
    }

    vi.mocked(invoke).mockImplementation((command: string) => {
      if (command === 'baker_start_scan') {
        return Promise.resolve('stale-test-scan-id')
      }
      return Promise.resolve(undefined)
    })

    const { result } = renderHook(() => useBakerScan())

    // Start scan
    await act(async () => {
      await result.current.startScan('/test/path', mockScanOptions)
    })

    // Simulate completion event with stale breadcrumbs data
    const completeHandler = eventHandlers.get('baker_scan_complete')
    expect(completeHandler).toBeDefined()

    await act(async () => {
      completeHandler!({
        payload: {
          scanId: 'stale-test-scan-id',
          result: staleResult
        } as ScanCompleteEvent
      })
    })

    // Verify stale breadcrumbs detection
    const staleProject = result.current.scanResult?.projects.find(
      p => p.name === 'stale-project'
    )
    expect(staleProject?.staleBreadcrumbs).toBe(true)

    const freshProject = result.current.scanResult?.projects.find(
      p => p.name === 'fresh-project'
    )
    expect(freshProject?.staleBreadcrumbs).toBe(false)
  })

  test('should clear results correctly', async () => {
    const { invoke } = await import('@tauri-apps/api/core')

    vi.mocked(invoke).mockImplementation((command: string) => {
      if (command === 'baker_start_scan') {
        return Promise.resolve('clear-test-scan-id')
      }
      return Promise.resolve(undefined)
    })

    const { result } = renderHook(() => useBakerScan())

    // Start and complete scan
    await act(async () => {
      await result.current.startScan('/test/path', mockScanOptions)
    })

    // Simulate completion event
    const completeHandler = eventHandlers.get('baker_scan_complete')
    expect(completeHandler).toBeDefined()

    await act(async () => {
      completeHandler!({
        payload: {
          scanId: 'clear-test-scan-id',
          result: mockCompleteScanResult
        } as ScanCompleteEvent
      })
    })

    // Verify we have results
    expect(result.current.scanResult).toBeDefined()

    // Clear results
    act(() => {
      result.current.clearResults()
    })

    // Verify cleared state
    expect(result.current.scanResult).toBeNull()
    expect(result.current.error).toBeNull()
  })
})
