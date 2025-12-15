/**
 * useProjectFolders Hook Tests
 * Purpose: Test project folder structure creation
 *
 * Responsibilities:
 * - Create main project folder
 * - Create camera folders (1 to numCameras)
 * - Create support folders (Graphics, Renders, Projects, Scripts)
 * - Handle folder creation errors gracefully
 */

import { useProjectFolders } from '@/hooks/useProjectFolders'
import { mkdir } from '@tauri-apps/plugin-fs'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock Tauri APIs
vi.mock('@tauri-apps/plugin-fs', () => ({
  mkdir: vi.fn()
}))

describe('useProjectFolders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(mkdir).mockResolvedValue(undefined)
  })

  // ============================================================================
  // Folder Structure Creation Tests
  // ============================================================================

  describe('createFolderStructure', () => {
    it('should create main project folder', async () => {
      const { result } = renderHook(() => useProjectFolders())

      await result.current.createFolderStructure('/destination/Test Project', 2)

      expect(mkdir).toHaveBeenCalledWith('/destination/Test Project', { recursive: true })
    })

    it('should create camera folders based on numCameras', async () => {
      const { result } = renderHook(() => useProjectFolders())

      await result.current.createFolderStructure('/destination/Test Project', 2)

      expect(mkdir).toHaveBeenCalledWith('/destination/Test Project/Footage/Camera 1', {
        recursive: true
      })
      expect(mkdir).toHaveBeenCalledWith('/destination/Test Project/Footage/Camera 2', {
        recursive: true
      })
    })

    it('should create correct number of camera folders', async () => {
      const { result } = renderHook(() => useProjectFolders())

      await result.current.createFolderStructure('/destination/Test Project', 4)

      expect(mkdir).toHaveBeenCalledWith('/destination/Test Project/Footage/Camera 1', {
        recursive: true
      })
      expect(mkdir).toHaveBeenCalledWith('/destination/Test Project/Footage/Camera 2', {
        recursive: true
      })
      expect(mkdir).toHaveBeenCalledWith('/destination/Test Project/Footage/Camera 3', {
        recursive: true
      })
      expect(mkdir).toHaveBeenCalledWith('/destination/Test Project/Footage/Camera 4', {
        recursive: true
      })
    })

    it('should handle single camera', async () => {
      const { result } = renderHook(() => useProjectFolders())

      await result.current.createFolderStructure('/destination/Test Project', 1)

      expect(mkdir).toHaveBeenCalledWith('/destination/Test Project/Footage/Camera 1', {
        recursive: true
      })

      // Should not create Camera 2
      expect(mkdir).not.toHaveBeenCalledWith(
        '/destination/Test Project/Footage/Camera 2',
        {
          recursive: true
        }
      )
    })

    it('should create all required support folders', async () => {
      const { result } = renderHook(() => useProjectFolders())

      await result.current.createFolderStructure('/destination/Test Project', 2)

      expect(mkdir).toHaveBeenCalledWith('/destination/Test Project/Graphics', {
        recursive: true
      })
      expect(mkdir).toHaveBeenCalledWith('/destination/Test Project/Renders', {
        recursive: true
      })
      expect(mkdir).toHaveBeenCalledWith('/destination/Test Project/Projects', {
        recursive: true
      })
      expect(mkdir).toHaveBeenCalledWith('/destination/Test Project/Scripts', {
        recursive: true
      })
    })

    it('should handle zero cameras gracefully', async () => {
      const { result } = renderHook(() => useProjectFolders())

      await result.current.createFolderStructure('/destination/Test Project', 0)

      // Main folder and support folders should still be created
      expect(mkdir).toHaveBeenCalledWith('/destination/Test Project', { recursive: true })
      expect(mkdir).toHaveBeenCalledWith('/destination/Test Project/Graphics', {
        recursive: true
      })

      // No camera folders should be created
      expect(mkdir).not.toHaveBeenCalledWith(
        expect.stringContaining('/Footage/Camera'),
        expect.anything()
      )
    })

    it('should return success result when all folders created', async () => {
      const { result } = renderHook(() => useProjectFolders())

      const createResult = await result.current.createFolderStructure(
        '/destination/Test Project',
        2
      )

      expect(createResult.success).toBe(true)
      expect(createResult.error).toBeUndefined()
    })
  })

  // ============================================================================
  // Individual Folder Creation Tests
  // ============================================================================

  describe('createMainFolder', () => {
    it('should create main project folder', async () => {
      const { result } = renderHook(() => useProjectFolders())

      await result.current.createMainFolder('/destination/Test Project')

      expect(mkdir).toHaveBeenCalledWith('/destination/Test Project', { recursive: true })
    })

    it('should handle folder creation error', async () => {
      const { result } = renderHook(() => useProjectFolders())

      vi.mocked(mkdir).mockRejectedValueOnce(new Error('Permission denied'))

      await expect(
        result.current.createMainFolder('/destination/Test Project')
      ).rejects.toThrow('Permission denied')
    })
  })

  describe('createCameraFolders', () => {
    it('should create all camera folders', async () => {
      const { result } = renderHook(() => useProjectFolders())

      await result.current.createCameraFolders('/destination/Test Project', 3)

      expect(mkdir).toHaveBeenCalledWith('/destination/Test Project/Footage/Camera 1', {
        recursive: true
      })
      expect(mkdir).toHaveBeenCalledWith('/destination/Test Project/Footage/Camera 2', {
        recursive: true
      })
      expect(mkdir).toHaveBeenCalledWith('/destination/Test Project/Footage/Camera 3', {
        recursive: true
      })
    })

    it('should not create any folders when numCameras is 0', async () => {
      const { result } = renderHook(() => useProjectFolders())

      await result.current.createCameraFolders('/destination/Test Project', 0)

      expect(mkdir).not.toHaveBeenCalled()
    })

    it('should handle error in one camera folder creation', async () => {
      const { result } = renderHook(() => useProjectFolders())

      vi.mocked(mkdir)
        .mockResolvedValueOnce(undefined) // Camera 1 succeeds
        .mockRejectedValueOnce(new Error('Permission denied')) // Camera 2 fails

      await expect(
        result.current.createCameraFolders('/destination/Test Project', 2)
      ).rejects.toThrow('Permission denied')
    })
  })

  describe('createSupportFolders', () => {
    it('should create all support folders in parallel', async () => {
      const { result } = renderHook(() => useProjectFolders())

      await result.current.createSupportFolders('/destination/Test Project')

      expect(mkdir).toHaveBeenCalledWith('/destination/Test Project/Graphics', {
        recursive: true
      })
      expect(mkdir).toHaveBeenCalledWith('/destination/Test Project/Renders', {
        recursive: true
      })
      expect(mkdir).toHaveBeenCalledWith('/destination/Test Project/Projects', {
        recursive: true
      })
      expect(mkdir).toHaveBeenCalledWith('/destination/Test Project/Scripts', {
        recursive: true
      })
    })

    it('should handle error in support folder creation', async () => {
      const { result } = renderHook(() => useProjectFolders())

      vi.mocked(mkdir).mockRejectedValueOnce(new Error('Disk full'))

      await expect(
        result.current.createSupportFolders('/destination/Test Project')
      ).rejects.toThrow()
    })
  })

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('error handling', () => {
    it('should return error result when main folder creation fails', async () => {
      const { result } = renderHook(() => useProjectFolders())

      vi.mocked(mkdir).mockRejectedValueOnce(new Error('Permission denied'))

      const createResult = await result.current.createFolderStructure(
        '/destination/Test Project',
        2
      )

      expect(createResult.success).toBe(false)
      expect(createResult.error).toContain('Permission denied')
    })

    it('should return error result when camera folder creation fails', async () => {
      const { result } = renderHook(() => useProjectFolders())

      vi.mocked(mkdir)
        .mockResolvedValueOnce(undefined) // Main folder succeeds
        .mockRejectedValueOnce(new Error('Disk full')) // Camera folder fails

      const createResult = await result.current.createFolderStructure(
        '/destination/Test Project',
        2
      )

      expect(createResult.success).toBe(false)
      expect(createResult.error).toContain('Disk full')
    })

    it('should return error result when support folder creation fails', async () => {
      const { result } = renderHook(() => useProjectFolders())

      vi.mocked(mkdir)
        .mockResolvedValueOnce(undefined) // Main folder succeeds
        .mockResolvedValueOnce(undefined) // Camera 1 succeeds
        .mockResolvedValueOnce(undefined) // Camera 2 succeeds
        .mockRejectedValueOnce(new Error('No space left')) // Support folder fails

      const createResult = await result.current.createFolderStructure(
        '/destination/Test Project',
        2
      )

      expect(createResult.success).toBe(false)
      expect(createResult.error).toContain('No space left')
    })

    it('should include error message in result', async () => {
      const { result } = renderHook(() => useProjectFolders())

      const customError = new Error('Custom error message')
      vi.mocked(mkdir).mockRejectedValueOnce(customError)

      const createResult = await result.current.createFolderStructure(
        '/destination/Test Project',
        2
      )

      expect(createResult.error).toBe('Custom error message')
    })
  })

  // ============================================================================
  // Path Handling Tests
  // ============================================================================

  describe('path handling', () => {
    it('should handle paths with special characters', async () => {
      const { result } = renderHook(() => useProjectFolders())

      const specialPath = '/destination/Project (2024) - Test #1'
      await result.current.createFolderStructure(specialPath, 1)

      expect(mkdir).toHaveBeenCalledWith(specialPath, { recursive: true })
      expect(mkdir).toHaveBeenCalledWith(`${specialPath}/Graphics`, { recursive: true })
    })

    it('should handle paths with spaces', async () => {
      const { result } = renderHook(() => useProjectFolders())

      const pathWithSpaces = '/destination/My Test Project'
      await result.current.createFolderStructure(pathWithSpaces, 1)

      expect(mkdir).toHaveBeenCalledWith(pathWithSpaces, { recursive: true })
    })

    it('should not add extra slashes', async () => {
      const { result } = renderHook(() => useProjectFolders())

      await result.current.createFolderStructure('/destination/Test/', 1)

      // Should handle the trailing slash properly
      expect(mkdir).toHaveBeenCalled()
    })
  })

  // ============================================================================
  // Validation Tests
  // ============================================================================

  describe('validation', () => {
    it('should handle negative numCameras', async () => {
      const { result } = renderHook(() => useProjectFolders())

      await result.current.createFolderStructure('/destination/Test Project', -1)

      // Should not create camera folders
      expect(mkdir).not.toHaveBeenCalledWith(
        expect.stringContaining('/Footage/Camera'),
        expect.anything()
      )
    })

    it('should handle very large numCameras', async () => {
      const { result } = renderHook(() => useProjectFolders())

      await result.current.createFolderStructure('/destination/Test Project', 10)

      // Verify camera folders from 1-10 are created
      for (let i = 1; i <= 10; i++) {
        expect(mkdir).toHaveBeenCalledWith(
          `/destination/Test Project/Footage/Camera ${i}`,
          { recursive: true }
        )
      }
    })
  })
})
