/**
 * useProjectBreadcrumbs Hook Tests
 * Purpose: Test breadcrumbs generation and storage
 *
 * Responsibilities:
 * - Calculate folder size
 * - Create breadcrumbs data structure
 * - Write breadcrumbs.json file
 * - Update app store with breadcrumbs data
 */

import type { FootageFile } from '@/hooks/useCameraAutoRemap'
import { useProjectBreadcrumbs } from '@/hooks/useProjectBreadcrumbs'
import { appStore } from '@store/useAppStore'
import { invoke } from '@tauri-apps/api/core'
import { writeTextFile } from '@tauri-apps/plugin-fs'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: vi.fn()
}))

vi.mock('@store/useAppStore', () => ({
  appStore: {
    getState: vi.fn(() => ({
      setBreadcrumbs: vi.fn()
    }))
  }
}))

describe('useProjectBreadcrumbs', () => {
  const mockFiles: FootageFile[] = [
    {
      file: { path: '/source/video1.mp4', name: 'video1.mp4' },
      camera: 1
    },
    {
      file: { path: '/source/video2.mp4', name: 'video2.mp4' },
      camera: 2
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(invoke).mockResolvedValue(1024000)
    vi.mocked(writeTextFile).mockResolvedValue(undefined)
  })

  // ============================================================================
  // Folder Size Calculation Tests
  // ============================================================================

  describe('calculateFolderSize', () => {
    it('should calculate folder size successfully', async () => {
      const { result } = renderHook(() => useProjectBreadcrumbs())

      vi.mocked(invoke).mockResolvedValueOnce(2048000)

      const size = await result.current.calculateFolderSize('/test/folder')

      expect(invoke).toHaveBeenCalledWith('get_folder_size', {
        folderPath: '/test/folder'
      })
      expect(size).toBe(2048000)
    })

    it('should return undefined on calculation error', async () => {
      const { result } = renderHook(() => useProjectBreadcrumbs())

      vi.mocked(invoke).mockRejectedValueOnce(new Error('Access denied'))

      const size = await result.current.calculateFolderSize('/test/folder')

      expect(size).toBeUndefined()
    })

    it('should log warning on calculation failure', async () => {
      const { result } = renderHook(() => useProjectBreadcrumbs())
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      vi.mocked(invoke).mockRejectedValueOnce(new Error('Access denied'))

      await result.current.calculateFolderSize('/test/folder')

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to calculate folder size:',
        expect.any(Error)
      )

      consoleSpy.mockRestore()
    })
  })

  // ============================================================================
  // Breadcrumbs Data Creation Tests
  // ============================================================================

  describe('createBreadcrumbsData', () => {
    it('should create breadcrumbs with all required fields', async () => {
      const { result } = renderHook(() => useProjectBreadcrumbs())

      const breadcrumbs = await result.current.createBreadcrumbsData({
        title: 'Test Project',
        numCameras: 2,
        files: mockFiles,
        parentFolder: '/destination',
        username: 'Test User',
        folderSizeBytes: 1024000
      })

      expect(breadcrumbs).toMatchObject({
        projectTitle: 'Test Project',
        numberOfCameras: 2,
        parentFolder: '/destination',
        createdBy: 'Test User',
        folderSizeBytes: 1024000
      })
      expect(breadcrumbs.creationDateTime).toBeDefined()
      expect(breadcrumbs.files).toHaveLength(2)
    })

    it('should format files correctly', async () => {
      const { result } = renderHook(() => useProjectBreadcrumbs())

      const breadcrumbs = await result.current.createBreadcrumbsData({
        title: 'Test Project',
        numCameras: 2,
        files: mockFiles,
        parentFolder: '/destination',
        username: 'Test User'
      })

      expect(breadcrumbs.files).toEqual([
        { camera: 1, name: 'video1.mp4', path: '/source/video1.mp4' },
        { camera: 2, name: 'video2.mp4', path: '/source/video2.mp4' }
      ])
    })

    it('should use Unknown User when username not provided', async () => {
      const { result } = renderHook(() => useProjectBreadcrumbs())

      const breadcrumbs = await result.current.createBreadcrumbsData({
        title: 'Test Project',
        numCameras: 2,
        files: mockFiles,
        parentFolder: '/destination',
        username: ''
      })

      expect(breadcrumbs.createdBy).toBe('Unknown User')
    })

    it('should handle undefined folderSizeBytes', async () => {
      const { result } = renderHook(() => useProjectBreadcrumbs())

      const breadcrumbs = await result.current.createBreadcrumbsData({
        title: 'Test Project',
        numCameras: 2,
        files: mockFiles,
        parentFolder: '/destination',
        username: 'Test User',
        folderSizeBytes: undefined
      })

      expect(breadcrumbs.folderSizeBytes).toBeUndefined()
    })

    it('should create valid ISO timestamp', async () => {
      const { result } = renderHook(() => useProjectBreadcrumbs())

      const breadcrumbs = await result.current.createBreadcrumbsData({
        title: 'Test Project',
        numCameras: 2,
        files: mockFiles,
        parentFolder: '/destination',
        username: 'Test User'
      })

      // Check it's a valid ISO string
      expect(() => new Date(breadcrumbs.creationDateTime)).not.toThrow()
      expect(breadcrumbs.creationDateTime).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    it('should handle empty files array', async () => {
      const { result } = renderHook(() => useProjectBreadcrumbs())

      const breadcrumbs = await result.current.createBreadcrumbsData({
        title: 'Test Project',
        numCameras: 2,
        files: [],
        parentFolder: '/destination',
        username: 'Test User'
      })

      expect(breadcrumbs.files).toEqual([])
    })
  })

  // ============================================================================
  // Breadcrumbs File Writing Tests
  // ============================================================================

  describe('writeBreadcrumbsFile', () => {
    it('should write breadcrumbs to file with correct path', async () => {
      const { result } = renderHook(() => useProjectBreadcrumbs())

      const breadcrumbs = await result.current.createBreadcrumbsData({
        title: 'Test Project',
        numCameras: 2,
        files: mockFiles,
        parentFolder: '/destination',
        username: 'Test User'
      })

      await result.current.writeBreadcrumbsFile('/destination/Test Project', breadcrumbs)

      expect(writeTextFile).toHaveBeenCalledWith(
        '/destination/Test Project/breadcrumbs.json',
        expect.any(String)
      )
    })

    it('should write pretty-printed JSON', async () => {
      const { result } = renderHook(() => useProjectBreadcrumbs())

      const breadcrumbs = await result.current.createBreadcrumbsData({
        title: 'Test Project',
        numCameras: 2,
        files: mockFiles,
        parentFolder: '/destination',
        username: 'Test User'
      })

      await result.current.writeBreadcrumbsFile('/destination/Test Project', breadcrumbs)

      const writtenContent = vi.mocked(writeTextFile).mock.calls[0][1] as string
      expect(writtenContent).toContain('\n')
      expect(writtenContent).toContain('  ') // Check for indentation
    })

    it('should write valid JSON that can be parsed', async () => {
      const { result } = renderHook(() => useProjectBreadcrumbs())

      const breadcrumbs = await result.current.createBreadcrumbsData({
        title: 'Test Project',
        numCameras: 2,
        files: mockFiles,
        parentFolder: '/destination',
        username: 'Test User'
      })

      await result.current.writeBreadcrumbsFile('/destination/Test Project', breadcrumbs)

      const writtenContent = vi.mocked(writeTextFile).mock.calls[0][1] as string
      const parsed = JSON.parse(writtenContent)

      expect(parsed).toMatchObject({
        projectTitle: 'Test Project',
        numberOfCameras: 2
      })
    })

    it('should handle write error', async () => {
      const { result } = renderHook(() => useProjectBreadcrumbs())

      const breadcrumbs = await result.current.createBreadcrumbsData({
        title: 'Test Project',
        numCameras: 2,
        files: mockFiles,
        parentFolder: '/destination',
        username: 'Test User'
      })

      vi.mocked(writeTextFile).mockRejectedValueOnce(new Error('Disk full'))

      await expect(
        result.current.writeBreadcrumbsFile('/destination/Test Project', breadcrumbs)
      ).rejects.toThrow('Disk full')
    })
  })

  // ============================================================================
  // App Store Update Tests
  // ============================================================================

  describe('updateAppStore', () => {
    it('should call setBreadcrumbs on app store', async () => {
      const { result } = renderHook(() => useProjectBreadcrumbs())
      const mockSetBreadcrumbs = vi.fn()

      vi.mocked(appStore.getState).mockReturnValue({
        setBreadcrumbs: mockSetBreadcrumbs
      } as any)

      const breadcrumbs = await result.current.createBreadcrumbsData({
        title: 'Test Project',
        numCameras: 2,
        files: mockFiles,
        parentFolder: '/destination',
        username: 'Test User'
      })

      result.current.updateAppStore(breadcrumbs)

      expect(mockSetBreadcrumbs).toHaveBeenCalledWith(breadcrumbs)
    })

    it('should handle app store update gracefully', () => {
      const { result } = renderHook(() => useProjectBreadcrumbs())
      const mockSetBreadcrumbs = vi.fn()

      vi.mocked(appStore.getState).mockReturnValue({
        setBreadcrumbs: mockSetBreadcrumbs
      } as any)

      const breadcrumbs = {
        projectTitle: 'Test',
        numberOfCameras: 1,
        files: [],
        parentFolder: '/test',
        createdBy: 'Test',
        creationDateTime: new Date().toISOString()
      }

      expect(() => result.current.updateAppStore(breadcrumbs)).not.toThrow()
    })
  })

  // ============================================================================
  // Complete Flow Tests
  // ============================================================================

  describe('createAndSaveBreadcrumbs', () => {
    it('should calculate size, create data, write file, and update store', async () => {
      const { result } = renderHook(() => useProjectBreadcrumbs())
      const mockSetBreadcrumbs = vi.fn()

      vi.mocked(appStore.getState).mockReturnValue({
        setBreadcrumbs: mockSetBreadcrumbs
      } as any)
      vi.mocked(invoke).mockResolvedValueOnce(2048000)

      const breadcrumbsResult = await result.current.createAndSaveBreadcrumbs({
        projectFolder: '/destination/Test Project',
        title: 'Test Project',
        numCameras: 2,
        files: mockFiles,
        parentFolder: '/destination',
        username: 'Test User'
      })

      expect(invoke).toHaveBeenCalledWith('get_folder_size', {
        folderPath: '/destination/Test Project'
      })
      expect(writeTextFile).toHaveBeenCalledWith(
        '/destination/Test Project/breadcrumbs.json',
        expect.any(String)
      )
      expect(mockSetBreadcrumbs).toHaveBeenCalled()
      expect(breadcrumbsResult.success).toBe(true)
      expect(breadcrumbsResult.breadcrumbs).toBeDefined()
    })

    it('should succeed even if folder size calculation fails', async () => {
      const { result } = renderHook(() => useProjectBreadcrumbs())
      const mockSetBreadcrumbs = vi.fn()

      vi.mocked(appStore.getState).mockReturnValue({
        setBreadcrumbs: mockSetBreadcrumbs
      } as any)
      vi.mocked(invoke).mockRejectedValueOnce(new Error('Size calc failed'))

      const breadcrumbsResult = await result.current.createAndSaveBreadcrumbs({
        projectFolder: '/destination/Test Project',
        title: 'Test Project',
        numCameras: 2,
        files: mockFiles,
        parentFolder: '/destination',
        username: 'Test User'
      })

      expect(breadcrumbsResult.success).toBe(true)
      expect(breadcrumbsResult.breadcrumbs?.folderSizeBytes).toBeUndefined()
    })

    it('should return error if file write fails', async () => {
      const { result } = renderHook(() => useProjectBreadcrumbs())

      vi.mocked(writeTextFile).mockRejectedValueOnce(new Error('Write failed'))

      const breadcrumbsResult = await result.current.createAndSaveBreadcrumbs({
        projectFolder: '/destination/Test Project',
        title: 'Test Project',
        numCameras: 2,
        files: mockFiles,
        parentFolder: '/destination',
        username: 'Test User'
      })

      expect(breadcrumbsResult.success).toBe(false)
      expect(breadcrumbsResult.error).toContain('Write failed')
    })
  })

  // ============================================================================
  // Edge Cases Tests
  // ============================================================================

  describe('edge cases', () => {
    it('should handle very large folder sizes', async () => {
      const { result } = renderHook(() => useProjectBreadcrumbs())

      const largeSize = Number.MAX_SAFE_INTEGER - 1
      vi.mocked(invoke).mockResolvedValueOnce(largeSize)

      const size = await result.current.calculateFolderSize('/test/folder')

      expect(size).toBe(largeSize)
    })

    it('should handle special characters in project title', async () => {
      const { result } = renderHook(() => useProjectBreadcrumbs())

      const breadcrumbs = await result.current.createBreadcrumbsData({
        title: 'Test & Project (2024) #1',
        numCameras: 2,
        files: mockFiles,
        parentFolder: '/destination',
        username: 'Test User'
      })

      expect(breadcrumbs.projectTitle).toBe('Test & Project (2024) #1')
    })

    it('should handle many files', async () => {
      const { result } = renderHook(() => useProjectBreadcrumbs())

      const manyFiles: FootageFile[] = Array.from({ length: 100 }, (_, i) => ({
        file: { path: `/source/video${i}.mp4`, name: `video${i}.mp4` },
        camera: (i % 4) + 1
      }))

      const breadcrumbs = await result.current.createBreadcrumbsData({
        title: 'Test Project',
        numCameras: 4,
        files: manyFiles,
        parentFolder: '/destination',
        username: 'Test User'
      })

      expect(breadcrumbs.files).toHaveLength(100)
    })
  })
})
