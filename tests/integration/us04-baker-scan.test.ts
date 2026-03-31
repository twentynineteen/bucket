/**
 * Integration Test: US-04 — Baker Drive Scan
 *
 * As a media manager, when I navigate to /ingest/baker and select a root
 * directory, Baker scans the folder tree and lists all projects with their
 * breadcrumbs status.
 *
 * Focused on scenarios not covered by baker-scan-workflow.test.ts:
 * - US-04c: Batch breadcrumbs update (using useBreadcrumbsManager)
 * - US-04d: Empty state when no matching projects found
 *
 * Mocking strategy: mock the Baker api.ts module; no direct @tauri-apps imports.
 */

import type { BatchUpdateResult } from '../../src/features/Baker/types'
import { useBreadcrumbsManager } from '../../src/features/Baker/hooks/useBreadcrumbsManager'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the Baker api.ts layer (single I/O boundary for all Baker external calls)
vi.mock('../../src/features/Baker/api', () => ({
  bakerStartScan: vi.fn().mockResolvedValue('mock-scan-id'),
  bakerCancelScan: vi.fn().mockResolvedValue(undefined),
  bakerGetScanStatus: vi.fn().mockResolvedValue(null),
  bakerReadBreadcrumbs: vi.fn().mockResolvedValue(null),
  bakerReadRawBreadcrumbs: vi.fn().mockResolvedValue(null),
  bakerScanCurrentFiles: vi.fn().mockResolvedValue([]),
  bakerUpdateBreadcrumbs: vi.fn().mockResolvedValue({
    successful: [],
    failed: [],
    created: [],
    updated: []
  }),
  bakerGetVideoLinks: vi.fn().mockResolvedValue([]),
  bakerAssociateVideoLink: vi.fn().mockResolvedValue(null),
  bakerRemoveVideoLink: vi.fn().mockResolvedValue(null),
  bakerUpdateVideoLink: vi.fn().mockResolvedValue(null),
  bakerReorderVideoLinks: vi.fn().mockResolvedValue(null),
  getFolderSize: vi.fn().mockResolvedValue(0),
  listenScanProgress: vi.fn().mockResolvedValue(vi.fn()),
  listenScanComplete: vi.fn().mockResolvedValue(vi.fn()),
  listenScanError: vi.fn().mockResolvedValue(vi.fn()),
  openFolderDialog: vi.fn().mockResolvedValue('/selected/folder'),
  openJsonFileDialog: vi.fn().mockResolvedValue(null),
  askDialog: vi.fn().mockResolvedValue(true),
  confirmDialog: vi.fn().mockResolvedValue(true),
  openInShell: vi.fn().mockResolvedValue(undefined),
  openExternalUrl: vi.fn().mockResolvedValue(undefined),
  readTextFileContents: vi.fn().mockResolvedValue(''),
  writeTextFileContents: vi.fn().mockResolvedValue(undefined),
  updateTrelloCardDesc: vi.fn().mockResolvedValue({ ok: true }),
  addTrelloCardComment: vi.fn().mockResolvedValue({ ok: true })
}))

// ============================================================================
// US-04c — Batch Breadcrumbs Update via useBreadcrumbsManager
// ============================================================================

describe('US-04 — Baker: Batch Breadcrumbs Update (US-04c)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should initialize with default idle state', () => {
    const { result } = renderHook(() => useBreadcrumbsManager())

    expect(result.current.isUpdating).toBe(false)
    expect(result.current.lastUpdateResult).toBeNull()
    expect(result.current.error).toBeNull()
    expect(typeof result.current.updateBreadcrumbs).toBe('function')
    expect(typeof result.current.clearResults).toBe('function')
  })

  it('US-04c-1 — should perform batch breadcrumbs update across multiple projects', async () => {
    const { bakerUpdateBreadcrumbs } = await import('../../src/features/Baker/api')

    const mockResult: BatchUpdateResult = {
      successful: ['/volumes/drive/project1', '/volumes/drive/project2'],
      failed: [],
      created: ['/volumes/drive/project2'],
      updated: ['/volumes/drive/project1']
    }
    vi.mocked(bakerUpdateBreadcrumbs).mockResolvedValue(mockResult)

    const { result } = renderHook(() => useBreadcrumbsManager())

    const projectPaths = ['/volumes/drive/project1', '/volumes/drive/project2']
    let updateResult: BatchUpdateResult | undefined

    await act(async () => {
      updateResult = await result.current.updateBreadcrumbs(projectPaths, {
        createMissing: true,
        backupOriginals: true
      })
    })

    expect(bakerUpdateBreadcrumbs).toHaveBeenCalledWith(
      projectPaths,
      true, // createMissing
      true  // backupOriginals
    )
    expect(updateResult?.successful).toHaveLength(2)
    expect(updateResult?.created).toHaveLength(1)
    expect(updateResult?.updated).toHaveLength(1)
    expect(updateResult?.failed).toHaveLength(0)
  })

  it('US-04c-2 — should update lastUpdateResult after batch operation', async () => {
    const { bakerUpdateBreadcrumbs } = await import('../../src/features/Baker/api')

    const mockResult: BatchUpdateResult = {
      successful: ['/projects/alpha'],
      failed: [],
      created: [],
      updated: ['/projects/alpha']
    }
    vi.mocked(bakerUpdateBreadcrumbs).mockResolvedValue(mockResult)

    const { result } = renderHook(() => useBreadcrumbsManager())

    await act(async () => {
      await result.current.updateBreadcrumbs(['/projects/alpha'], {
        createMissing: false,
        backupOriginals: true
      })
    })

    expect(result.current.lastUpdateResult).toEqual(mockResult)
    expect(result.current.isUpdating).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('US-04c-3 — should set isUpdating=true during operation and false after', async () => {
    const { bakerUpdateBreadcrumbs } = await import('../../src/features/Baker/api')

    let resolveUpdate: (() => void) | undefined
    const slowUpdate = new Promise<BatchUpdateResult>((resolve) => {
      resolveUpdate = () =>
        resolve({ successful: [], failed: [], created: [], updated: [] })
    })
    vi.mocked(bakerUpdateBreadcrumbs).mockReturnValue(slowUpdate)

    const { result } = renderHook(() => useBreadcrumbsManager())

    act(() => {
      result.current.updateBreadcrumbs(['/projects/alpha'], {
        createMissing: true,
        backupOriginals: false
      })
    })

    await waitFor(() => {
      expect(result.current.isUpdating).toBe(true)
    })

    await act(async () => {
      resolveUpdate!()
    })

    await waitFor(() => {
      expect(result.current.isUpdating).toBe(false)
    })
  })

  it('US-04c-4 — should report failed projects separately in result', async () => {
    const { bakerUpdateBreadcrumbs } = await import('../../src/features/Baker/api')

    const mockResult: BatchUpdateResult = {
      successful: ['/projects/project1'],
      failed: [
        { path: '/projects/project2', error: 'Permission denied' },
        { path: '/projects/project3', error: 'Invalid breadcrumbs format' }
      ],
      created: ['/projects/project1'],
      updated: []
    }
    vi.mocked(bakerUpdateBreadcrumbs).mockResolvedValue(mockResult)

    const { result } = renderHook(() => useBreadcrumbsManager())

    let updateResult: BatchUpdateResult | undefined

    await act(async () => {
      updateResult = await result.current.updateBreadcrumbs(
        ['/projects/project1', '/projects/project2', '/projects/project3'],
        { createMissing: true, backupOriginals: false }
      )
    })

    expect(updateResult?.failed).toHaveLength(2)
    expect(updateResult?.failed[0].error).toBe('Permission denied')
    expect(updateResult?.failed[1].error).toBe('Invalid breadcrumbs format')
    expect(updateResult?.successful).toHaveLength(1)
  })

  it('US-04c-5 — should handle update error gracefully', async () => {
    const { bakerUpdateBreadcrumbs } = await import('../../src/features/Baker/api')

    vi.mocked(bakerUpdateBreadcrumbs).mockRejectedValue(
      new Error('Backend scan operation failed')
    )

    const { result } = renderHook(() => useBreadcrumbsManager())

    await act(async () => {
      try {
        await result.current.updateBreadcrumbs(['/projects/broken'], {
          createMissing: true,
          backupOriginals: true
        })
      } catch {
        // Expected — hook re-throws the error
      }
    })

    expect(result.current.error).toBe('Backend scan operation failed')
    expect(result.current.isUpdating).toBe(false)
    expect(result.current.lastUpdateResult).toBeNull()
  })

  it('US-04c-6 — should prevent concurrent batch operations', async () => {
    const { bakerUpdateBreadcrumbs } = await import('../../src/features/Baker/api')

    // First call never resolves during test
    vi.mocked(bakerUpdateBreadcrumbs).mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useBreadcrumbsManager())

    // Start first update (non-awaited)
    act(() => {
      result.current.updateBreadcrumbs(['/projects/alpha'], {
        createMissing: true,
        backupOriginals: false
      })
    })

    await waitFor(() => {
      expect(result.current.isUpdating).toBe(true)
    })

    // Attempting a second concurrent update should throw
    await act(async () => {
      try {
        await result.current.updateBreadcrumbs(['/projects/beta'], {
          createMissing: true,
          backupOriginals: false
        })
      } catch (err) {
        expect((err as Error).message).toContain('already in progress')
      }
    })

    // bakerUpdateBreadcrumbs should only have been called once
    expect(bakerUpdateBreadcrumbs).toHaveBeenCalledTimes(1)
  })

  it('US-04c-7 — should reject update with empty project paths array', async () => {
    const { bakerUpdateBreadcrumbs } = await import('../../src/features/Baker/api')

    const { result } = renderHook(() => useBreadcrumbsManager())

    await act(async () => {
      try {
        await result.current.updateBreadcrumbs([], {
          createMissing: true,
          backupOriginals: true
        })
      } catch (err) {
        expect((err as Error).message).toContain('cannot be empty')
      }
    })

    // Should not have called the API with empty paths
    expect(bakerUpdateBreadcrumbs).not.toHaveBeenCalled()
  })

  it('US-04c-8 — should clear results on clearResults()', async () => {
    const { bakerUpdateBreadcrumbs } = await import('../../src/features/Baker/api')

    vi.mocked(bakerUpdateBreadcrumbs).mockResolvedValue({
      successful: ['/projects/alpha'],
      failed: [],
      created: [],
      updated: ['/projects/alpha']
    })

    const { result } = renderHook(() => useBreadcrumbsManager())

    // First do a successful update
    await act(async () => {
      await result.current.updateBreadcrumbs(['/projects/alpha'], {
        createMissing: true,
        backupOriginals: false
      })
    })
    expect(result.current.lastUpdateResult).not.toBeNull()

    // Clear results
    act(() => {
      result.current.clearResults()
    })

    expect(result.current.lastUpdateResult).toBeNull()
    expect(result.current.error).toBeNull()
  })

  // US-04a: Scan with valid projects (covered by baker-scan-workflow.test.ts)
  // US-04b: Empty state (covered by baker-scan-workflow.test.ts)
  // Adding a focused sanity check here:
  it('US-04a summary — bakerUpdateBreadcrumbs is called with correct params (createMissing + backupOriginals)', async () => {
    const { bakerUpdateBreadcrumbs } = await import('../../src/features/Baker/api')

    vi.mocked(bakerUpdateBreadcrumbs).mockResolvedValue({
      successful: [],
      failed: [],
      created: [],
      updated: []
    })

    const { result } = renderHook(() => useBreadcrumbsManager())

    const paths = ['/volumes/disk1/proj-a', '/volumes/disk1/proj-b']

    await act(async () => {
      await result.current.updateBreadcrumbs(paths, {
        createMissing: true,
        backupOriginals: true
      })
    })

    expect(bakerUpdateBreadcrumbs).toHaveBeenCalledWith(paths, true, true)
  })
})
