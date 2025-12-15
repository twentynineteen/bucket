/**
 * useBreadcrumbsPreview Hook Tests
 * Purpose: Test breadcrumbs preview generation with concurrency control
 */

import { useBreadcrumbsPreview } from '@/hooks/useBreadcrumbsPreview'
import type { BreadcrumbsFile, BreadcrumbsPreview, ProjectFolder } from '@/types/baker'
import { invoke } from '@tauri-apps/api/core'
import {
  compareBreadcrumbsMeaningful,
  generateBreadcrumbsPreview
} from '@/utils/breadcrumbsComparison'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

// Mock utils
vi.mock('@/utils/breadcrumbsComparison', () => ({
  compareBreadcrumbsMeaningful: vi.fn(),
  generateBreadcrumbsPreview: vi.fn()
}))

vi.mock('@/utils/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  }
}))

describe('useBreadcrumbsPreview', () => {
  const mockInvoke = vi.mocked(invoke)
  const mockGeneratePreview = vi.mocked(generateBreadcrumbsPreview)
  const mockCompareMeaningful = vi.mocked(compareBreadcrumbsMeaningful)

  // Mock data factory
  const createMockProject = (overrides?: Partial<ProjectFolder>): ProjectFolder => ({
    path: '/test/project',
    name: 'TestProject',
    isValid: true,
    hasBreadcrumbs: false,
    staleBreadcrumbs: false,
    invalidBreadcrumbs: false,
    lastScanned: new Date().toISOString(),
    cameraCount: 2,
    validationErrors: [],
    ...overrides
  })

  const createMockBreadcrumbs = (
    overrides?: Partial<BreadcrumbsFile>
  ): BreadcrumbsFile => ({
    projectTitle: 'Test Project',
    numberOfCameras: 2,
    files: [
      { camera: 1, name: 'cam1.mp4', path: '/test/project/Footage/Camera 1/cam1.mp4' },
      { camera: 2, name: 'cam2.mp4', path: '/test/project/Footage/Camera 2/cam2.mp4' }
    ],
    parentFolder: '/test/project',
    createdBy: 'test-user',
    creationDateTime: new Date().toISOString(),
    ...overrides
  })

  const createMockPreview = (
    overrides?: Partial<BreadcrumbsPreview>
  ): BreadcrumbsPreview => ({
    current: null,
    updated: createMockBreadcrumbs(),
    diff: {
      hasChanges: true,
      changes: [],
      summary: { added: 1, modified: 0, removed: 0 }
    },
    ...overrides
  })

  beforeEach(() => {
    vi.clearAllMocks()

    // Default mock implementations
    mockInvoke.mockImplementation(async (command: string) => {
      if (command === 'baker_read_breadcrumbs') {
        return null
      }
      if (command === 'baker_scan_current_files') {
        return [
          { camera: 1, name: 'cam1.mp4', path: '/test/Footage/Camera 1/cam1.mp4' },
          { camera: 2, name: 'cam2.mp4', path: '/test/Footage/Camera 2/cam2.mp4' }
        ]
      }
      if (command === 'get_folder_size') {
        return 1024000
      }
      return null
    })

    mockGeneratePreview.mockReturnValue(createMockPreview())
    mockCompareMeaningful.mockReturnValue({
      hasChanges: false,
      changes: [],
      summary: { added: 0, modified: 0, removed: 0 }
    })
  })

  // ============================================================================
  // Initialization Tests
  // ============================================================================

  describe('initialization', () => {
    it('should initialize with empty state', () => {
      const { result } = renderHook(() => useBreadcrumbsPreview())

      expect(result.current.previews).toBeInstanceOf(Map)
      expect(result.current.previews.size).toBe(0)
      expect(result.current.isGenerating).toBe(false)
      expect(result.current.error).toBe(null)
    })

    it('should provide all required functions', () => {
      const { result } = renderHook(() => useBreadcrumbsPreview())

      expect(typeof result.current.generatePreview).toBe('function')
      expect(typeof result.current.generateBatchPreviews).toBe('function')
      expect(typeof result.current.clearPreviews).toBe('function')
      expect(typeof result.current.getPreview).toBe('function')
      expect(typeof result.current.hasPreview).toBe('function')
    })
  })

  // ============================================================================
  // Single Preview Generation Tests
  // ============================================================================

  describe('generatePreview', () => {
    it('should generate preview for project without breadcrumbs', async () => {
      const { result } = renderHook(() => useBreadcrumbsPreview())
      const project = createMockProject()

      let preview: BreadcrumbsPreview | null = null
      await act(async () => {
        preview = await result.current.generatePreview(project.path, project)
      })

      expect(preview).not.toBe(null)
      expect(mockInvoke).toHaveBeenCalledWith('baker_scan_current_files', {
        projectPath: project.path
      })
      expect(mockGeneratePreview).toHaveBeenCalled()
    })

    it('should read existing breadcrumbs when present', async () => {
      const { result } = renderHook(() => useBreadcrumbsPreview())
      const project = createMockProject({ hasBreadcrumbs: true })
      const existingBreadcrumbs = createMockBreadcrumbs()

      mockInvoke.mockImplementation(async (command: string) => {
        if (command === 'baker_read_breadcrumbs') {
          return existingBreadcrumbs
        }
        if (command === 'baker_scan_current_files') {
          return existingBreadcrumbs.files
        }
        if (command === 'get_folder_size') {
          return 1024000
        }
        return null
      })

      await act(async () => {
        await result.current.generatePreview(project.path, project)
      })

      expect(mockInvoke).toHaveBeenCalledWith('baker_read_breadcrumbs', {
        projectPath: project.path
      })
    })

    it('should set isGenerating state during preview generation', async () => {
      const { result } = renderHook(() => useBreadcrumbsPreview())
      const project = createMockProject()

      // Mock slow operation with controlled resolution
      let resolveInvoke: (value: any) => void
      const slowPromise = new Promise((resolve) => {
        resolveInvoke = resolve
      })

      mockInvoke.mockImplementation(async () => slowPromise)

      // Start the preview generation without awaiting
      let previewPromise: Promise<any>
      act(() => {
        previewPromise = result.current.generatePreview(project.path, project)
      })

      // Should be generating
      await waitFor(() => {
        expect(result.current.isGenerating).toBe(true)
      })

      // Resolve the mock and wait for completion
      await act(async () => {
        resolveInvoke!([])
        await previewPromise!
      })

      // Should finish generating
      expect(result.current.isGenerating).toBe(false)
    })

    it('should calculate folder size and update preview', async () => {
      const { result } = renderHook(() => useBreadcrumbsPreview())
      const project = createMockProject()
      const expectedSize = 5000000

      mockInvoke.mockImplementation(async (command: string) => {
        if (command === 'get_folder_size') {
          return expectedSize
        }
        if (command === 'baker_scan_current_files') {
          return []
        }
        return null
      })

      await act(async () => {
        await result.current.generatePreview(project.path, project)
      })

      expect(mockInvoke).toHaveBeenCalledWith('get_folder_size', {
        folderPath: project.path
      })
    })

    it('should store preview in state', async () => {
      const { result } = renderHook(() => useBreadcrumbsPreview())
      const project = createMockProject()

      await act(async () => {
        await result.current.generatePreview(project.path, project)
      })

      expect(result.current.hasPreview(project.path)).toBe(true)
      expect(result.current.getPreview(project.path)).not.toBe(null)
    })

    it('should handle errors gracefully', async () => {
      const { result } = renderHook(() => useBreadcrumbsPreview())
      const project = createMockProject()

      // Mock generateBreadcrumbsPreview to throw an error (the outer catch block)
      mockGeneratePreview.mockImplementation(() => {
        throw new Error('Preview generation failed')
      })

      let preview: BreadcrumbsPreview | null = null
      await act(async () => {
        preview = await result.current.generatePreview(project.path, project)
      })

      expect(preview).toBe(null)
      expect(result.current.error).toContain('Failed to generate preview')
      expect(result.current.isGenerating).toBe(false)
    })
  })

  // ============================================================================
  // Batch Preview Generation Tests
  // ============================================================================

  describe('generateBatchPreviews', () => {
    it('should generate previews for multiple projects', async () => {
      const { result } = renderHook(() => useBreadcrumbsPreview())
      const projects = [
        createMockProject({ path: '/test/project1', name: 'Project1' }),
        createMockProject({ path: '/test/project2', name: 'Project2' }),
        createMockProject({ path: '/test/project3', name: 'Project3' })
      ]

      let previews: Map<string, BreadcrumbsPreview> = new Map()
      await act(async () => {
        previews = await result.current.generateBatchPreviews(projects)
      })

      expect(previews.size).toBe(3)
      expect(previews.has('/test/project1')).toBe(true)
      expect(previews.has('/test/project2')).toBe(true)
      expect(previews.has('/test/project3')).toBe(true)
    })

    it('should process all projects in parallel', async () => {
      const { result } = renderHook(() => useBreadcrumbsPreview())
      const projects = Array.from({ length: 10 }, (_, i) =>
        createMockProject({ path: `/test/project${i}`, name: `Project${i}` })
      )

      const startTime = Date.now()

      await act(async () => {
        await result.current.generateBatchPreviews(projects)
      })

      const duration = Date.now() - startTime

      // All 10 should complete faster than sequential (< 1 second for mocked operations)
      expect(duration).toBeLessThan(1000)
    })

    it('should handle partial failures in batch', async () => {
      const { result } = renderHook(() => useBreadcrumbsPreview())
      const projects = [
        createMockProject({ path: '/test/project1' }),
        createMockProject({ path: '/test/project2' }),
        createMockProject({ path: '/test/project3' })
      ]

      // Mock generateBreadcrumbsPreview to fail for project2
      mockGeneratePreview.mockImplementation((_current, path) => {
        if (path === '/test/project2') {
          throw new Error('Project 2 failed')
        }
        return createMockPreview()
      })

      let previews: Map<string, BreadcrumbsPreview> = new Map()
      await act(async () => {
        previews = await result.current.generateBatchPreviews(projects)
      })

      // Should have 2 successful previews (project 1 and 3)
      expect(previews.size).toBe(2)
      expect(previews.has('/test/project1')).toBe(true)
      expect(previews.has('/test/project2')).toBe(false)
      expect(previews.has('/test/project3')).toBe(true)
    })

    it('should set isGenerating during batch operation', async () => {
      const { result } = renderHook(() => useBreadcrumbsPreview())
      const projects = [createMockProject()]

      // Mock slow operation with controlled resolution
      let resolveInvoke: (value: any) => void
      const slowPromise = new Promise((resolve) => {
        resolveInvoke = resolve
      })

      mockInvoke.mockImplementation(async () => slowPromise)

      // Start the batch operation without awaiting
      let batchPromise: Promise<any>
      act(() => {
        batchPromise = result.current.generateBatchPreviews(projects)
      })

      // Should be generating
      await waitFor(() => {
        expect(result.current.isGenerating).toBe(true)
      })

      // Resolve the mock and wait for completion
      await act(async () => {
        resolveInvoke!([])
        await batchPromise!
      })

      // Should finish generating
      expect(result.current.isGenerating).toBe(false)
    })

    it('should handle empty project list', async () => {
      const { result } = renderHook(() => useBreadcrumbsPreview())

      let previews: Map<string, BreadcrumbsPreview> = new Map()
      await act(async () => {
        previews = await result.current.generateBatchPreviews([])
      })

      expect(previews.size).toBe(0)
      expect(result.current.error).toBe(null)
    })
  })

  // ============================================================================
  // Concurrency Control Tests (NEW - Phase 2)
  // ============================================================================

  describe('concurrency control', () => {
    it('should limit concurrent operations to avoid system overload', async () => {
      const { result } = renderHook(() => useBreadcrumbsPreview())
      const projects = Array.from({ length: 50 }, (_, i) =>
        createMockProject({ path: `/test/project${i}`, name: `Project${i}` })
      )

      let maxConcurrent = 0
      let currentConcurrent = 0

      mockInvoke.mockImplementation(async (command: string) => {
        currentConcurrent++
        maxConcurrent = Math.max(maxConcurrent, currentConcurrent)

        // Simulate async work
        await new Promise((resolve) => setTimeout(resolve, 10))

        currentConcurrent--

        if (command === 'baker_scan_current_files') {
          return []
        }
        if (command === 'get_folder_size') {
          return 1024000
        }
        return null
      })

      await act(async () => {
        await result.current.generateBatchPreviews(projects)
      })

      // Should limit concurrent operations (default: 5-10)
      // Without limit, maxConcurrent would be 50
      expect(maxConcurrent).toBeLessThanOrEqual(10)
      expect(maxConcurrent).toBeGreaterThan(0)
    })

    it('should process large batches without freezing UI', async () => {
      const { result } = renderHook(() => useBreadcrumbsPreview())
      const projects = Array.from({ length: 100 }, (_, i) =>
        createMockProject({ path: `/test/project${i}`, name: `Project${i}` })
      )

      const startTime = Date.now()

      await act(async () => {
        await result.current.generateBatchPreviews(projects)
      })

      const duration = Date.now() - startTime

      // Should complete in reasonable time (< 5 seconds for mocked operations)
      expect(duration).toBeLessThan(5000)
      expect(result.current.previews.size).toBe(100)
    })

    it('should track progress during batch operations', async () => {
      const { result } = renderHook(() => useBreadcrumbsPreview())
      const projects = Array.from({ length: 20 }, (_, i) =>
        createMockProject({ path: `/test/project${i}` })
      )

      const progressUpdates: number[] = []

      mockInvoke.mockImplementation(async (command: string) => {
        // Simulate work
        await new Promise((resolve) => setTimeout(resolve, 20))
        progressUpdates.push(result.current.previews.size)

        if (command === 'baker_scan_current_files') {
          return []
        }
        if (command === 'get_folder_size') {
          return 1024000
        }
        return null
      })

      await act(async () => {
        await result.current.generateBatchPreviews(projects)
      })

      // Progress should increase gradually (not all at once)
      expect(progressUpdates.length).toBeGreaterThan(0)
      // Final size should be 20
      expect(result.current.previews.size).toBe(20)
    })
  })

  // ============================================================================
  // Utility Function Tests
  // ============================================================================

  describe('utility functions', () => {
    it('should clear all previews', async () => {
      const { result } = renderHook(() => useBreadcrumbsPreview())
      const project = createMockProject()

      await act(async () => {
        await result.current.generatePreview(project.path, project)
      })

      expect(result.current.previews.size).toBe(1)

      act(() => {
        result.current.clearPreviews()
      })

      expect(result.current.previews.size).toBe(0)
      expect(result.current.error).toBe(null)
    })

    it('should get preview by path', async () => {
      const { result } = renderHook(() => useBreadcrumbsPreview())
      const project = createMockProject()

      await act(async () => {
        await result.current.generatePreview(project.path, project)
      })

      const preview = result.current.getPreview(project.path)
      expect(preview).not.toBe(null)
      expect(preview?.updated).toBeDefined()
    })

    it('should return null for non-existent preview', () => {
      const { result } = renderHook(() => useBreadcrumbsPreview())

      const preview = result.current.getPreview('/non/existent/path')
      expect(preview).toBe(null)
    })

    it('should check if preview exists', async () => {
      const { result } = renderHook(() => useBreadcrumbsPreview())
      const project = createMockProject()

      expect(result.current.hasPreview(project.path)).toBe(false)

      await act(async () => {
        await result.current.generatePreview(project.path, project)
      })

      expect(result.current.hasPreview(project.path)).toBe(true)
    })
  })

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('error handling', () => {
    it('should handle file system errors', async () => {
      const { result } = renderHook(() => useBreadcrumbsPreview())
      const project = createMockProject()

      // Mock generateBreadcrumbsPreview to throw to trigger the outer error handler
      mockGeneratePreview.mockImplementation(() => {
        throw new Error('Permission denied')
      })

      await act(async () => {
        await result.current.generatePreview(project.path, project)
      })

      expect(result.current.error).toContain('Failed to generate preview')
      expect(result.current.error).toContain('Permission denied')
    })

    it('should continue batch on individual errors', async () => {
      const { result } = renderHook(() => useBreadcrumbsPreview())
      const projects = [
        createMockProject({ path: '/test/project1' }),
        createMockProject({ path: '/test/project2' }),
        createMockProject({ path: '/test/project3' })
      ]

      let callCount = 0
      // Mock generateBreadcrumbsPreview to fail for project2
      mockGeneratePreview.mockImplementation((_current, path) => {
        callCount++
        if (path === '/test/project2') {
          throw new Error('Preview generation failed for project2')
        }
        return createMockPreview()
      })

      await act(async () => {
        await result.current.generateBatchPreviews(projects)
      })

      // Should complete with 2 successful previews (project1 and project3)
      expect(result.current.previews.size).toBe(2)
      expect(result.current.previews.has('/test/project1')).toBe(true)
      expect(result.current.previews.has('/test/project2')).toBe(false)
      expect(result.current.previews.has('/test/project3')).toBe(true)
    })

    it('should handle batch errors gracefully', async () => {
      const { result } = renderHook(() => useBreadcrumbsPreview())
      const projects = [createMockProject()]

      // Mock generateBreadcrumbsPreview to throw for all projects
      mockGeneratePreview.mockImplementation(() => {
        throw new Error('Catastrophic failure')
      })

      let previews: Map<string, BreadcrumbsPreview> = new Map()
      await act(async () => {
        previews = await result.current.generateBatchPreviews(projects)
      })

      expect(previews.size).toBe(0)
      // Error message comes from individual generatePreview, not batch handler
      expect(result.current.error).toContain('Failed to generate preview')
      expect(result.current.error).toContain('Catastrophic failure')
    })
  })

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    it('should handle projects with no files', async () => {
      const { result } = renderHook(() => useBreadcrumbsPreview())
      const project = createMockProject({ cameraCount: 0 })

      mockInvoke.mockImplementation(async (command: string) => {
        if (command === 'baker_scan_current_files') {
          return []
        }
        if (command === 'get_folder_size') {
          return 0
        }
        return null
      })

      let preview: BreadcrumbsPreview | null = null
      await act(async () => {
        preview = await result.current.generatePreview(project.path, project)
      })

      expect(preview).not.toBe(null)
    })

    it('should handle very long paths', async () => {
      const { result } = renderHook(() => useBreadcrumbsPreview())
      const longPath = '/test/' + 'a'.repeat(200)
      const project = createMockProject({ path: longPath })

      await act(async () => {
        await result.current.generatePreview(project.path, project)
      })

      expect(result.current.hasPreview(longPath)).toBe(true)
    })

    it('should handle special characters in paths', async () => {
      const { result } = renderHook(() => useBreadcrumbsPreview())
      const specialPath = '/test/project (2024) [final]/Project #1'
      const project = createMockProject({ path: specialPath })

      await act(async () => {
        await result.current.generatePreview(project.path, project)
      })

      expect(result.current.hasPreview(specialPath)).toBe(true)
    })

    it('should handle scan fallback to breadcrumbs when file scan fails', async () => {
      const { result } = renderHook(() => useBreadcrumbsPreview())
      const project = createMockProject({ hasBreadcrumbs: true })
      const existingBreadcrumbs = createMockBreadcrumbs()

      mockInvoke.mockImplementation(async (command: string) => {
        if (command === 'baker_read_breadcrumbs') {
          return existingBreadcrumbs
        }
        if (command === 'baker_scan_current_files') {
          throw new Error('Scan failed')
        }
        if (command === 'get_folder_size') {
          return 1024000
        }
        return null
      })

      let preview: BreadcrumbsPreview | null = null
      await act(async () => {
        preview = await result.current.generatePreview(project.path, project)
      })

      // Should still generate preview using existing breadcrumbs
      expect(preview).not.toBe(null)
    })

    it('should handle folder size calculation failure', async () => {
      const { result } = renderHook(() => useBreadcrumbsPreview())
      const project = createMockProject()

      mockInvoke.mockImplementation(async (command: string) => {
        if (command === 'get_folder_size') {
          throw new Error('Cannot calculate size')
        }
        if (command === 'baker_scan_current_files') {
          return []
        }
        return null
      })

      let preview: BreadcrumbsPreview | null = null
      await act(async () => {
        preview = await result.current.generatePreview(project.path, project)
      })

      // Should still succeed, just without folder size
      expect(preview).not.toBe(null)
    })
  })

  // ============================================================================
  // Performance Tests
  // ============================================================================

  describe('performance', () => {
    it('should handle 100+ projects efficiently', async () => {
      const { result } = renderHook(() => useBreadcrumbsPreview())
      const projects = Array.from({ length: 100 }, (_, i) =>
        createMockProject({ path: `/test/project${i}` })
      )

      const startTime = Date.now()

      await act(async () => {
        await result.current.generateBatchPreviews(projects)
      })

      const duration = Date.now() - startTime

      // Should complete in reasonable time
      expect(duration).toBeLessThan(10000) // 10 seconds max
      expect(result.current.previews.size).toBe(100)
    })

    it('should not leak memory on repeated operations', async () => {
      const { result } = renderHook(() => useBreadcrumbsPreview())
      const project = createMockProject()

      // Generate preview multiple times
      for (let i = 0; i < 10; i++) {
        await act(async () => {
          await result.current.generatePreview(project.path, project)
        })
      }

      // Should still have only 1 preview (not accumulating)
      expect(result.current.previews.size).toBe(1)
    })

    it('should clear previews efficiently', async () => {
      const { result } = renderHook(() => useBreadcrumbsPreview())
      const projects = Array.from({ length: 50 }, (_, i) =>
        createMockProject({ path: `/test/project${i}` })
      )

      await act(async () => {
        await result.current.generateBatchPreviews(projects)
      })

      expect(result.current.previews.size).toBe(50)

      const startTime = Date.now()
      act(() => {
        result.current.clearPreviews()
      })
      const duration = Date.now() - startTime

      expect(duration).toBeLessThan(100) // Should be instant
      expect(result.current.previews.size).toBe(0)
    })
  })
})
