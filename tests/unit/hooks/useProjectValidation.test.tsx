/**
 * useProjectValidation Hook Tests
 * Purpose: Test project creation validation logic
 *
 * Responsibilities:
 * - Validate folder selection
 * - Validate project title
 * - Confirm when no files added
 * - Check folder existence and confirm overwrite
 */

import { useProjectValidation } from '@/hooks/useProjectValidation'
import { confirm } from '@tauri-apps/plugin-dialog'
import { exists, remove } from '@tauri-apps/plugin-fs'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock Tauri APIs
vi.mock('@tauri-apps/plugin-dialog', () => ({
  confirm: vi.fn()
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn(),
  remove: vi.fn()
}))

describe('useProjectValidation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.alert = vi.fn()
  })

  // ============================================================================
  // Folder Validation Tests
  // ============================================================================

  describe('validateFolder', () => {
    it('should return error when folder is empty', async () => {
      const { result } = renderHook(() => useProjectValidation())

      const validation = await result.current.validateFolder('')

      expect(validation.isValid).toBe(false)
      expect(validation.error).toBe('Please select a destination folder.')
    })

    it('should return error when folder is undefined', async () => {
      const { result } = renderHook(() => useProjectValidation())

      const validation = await result.current.validateFolder(undefined as any)

      expect(validation.isValid).toBe(false)
      expect(validation.error).toBe('Please select a destination folder.')
    })

    it('should return valid when folder is provided', async () => {
      const { result } = renderHook(() => useProjectValidation())

      const validation = await result.current.validateFolder('/valid/path')

      expect(validation.isValid).toBe(true)
      expect(validation.error).toBeUndefined()
    })
  })

  // ============================================================================
  // Title Validation Tests
  // ============================================================================

  describe('validateTitle', () => {
    it('should return error when title is empty', async () => {
      const { result } = renderHook(() => useProjectValidation())

      const validation = await result.current.validateTitle('')

      expect(validation.isValid).toBe(false)
      expect(validation.error).toBe('Please enter a project title.')
    })

    it('should return error when title is only whitespace', async () => {
      const { result } = renderHook(() => useProjectValidation())

      const validation = await result.current.validateTitle('   ')

      expect(validation.isValid).toBe(false)
      expect(validation.error).toBe('Please enter a project title.')
    })

    it('should return valid when title is provided', async () => {
      const { result } = renderHook(() => useProjectValidation())

      const validation = await result.current.validateTitle('Valid Title')

      expect(validation.isValid).toBe(true)
      expect(validation.error).toBeUndefined()
    })

    it('should return trimmed title', async () => {
      const { result } = renderHook(() => useProjectValidation())

      const validation = await result.current.validateTitle('  Trimmed Title  ')

      expect(validation.isValid).toBe(true)
      expect(validation.trimmedTitle).toBe('Trimmed Title')
    })
  })

  // ============================================================================
  // Files Validation Tests
  // ============================================================================

  describe('validateFiles', () => {
    it('should confirm when no files provided', async () => {
      const { result } = renderHook(() => useProjectValidation())

      vi.mocked(confirm).mockResolvedValueOnce(false)

      const validation = await result.current.validateFiles([])

      expect(confirm).toHaveBeenCalledWith(
        'No files have been added to the drag and drop section. Are you sure you want to create the project?'
      )
      expect(validation.isValid).toBe(false)
      expect(validation.userCancelled).toBe(true)
    })

    it('should return valid when user confirms no files', async () => {
      const { result } = renderHook(() => useProjectValidation())

      vi.mocked(confirm).mockResolvedValueOnce(true)

      const validation = await result.current.validateFiles([])

      expect(validation.isValid).toBe(true)
      expect(validation.userCancelled).toBe(false)
    })

    it('should return valid when files are provided', async () => {
      const { result } = renderHook(() => useProjectValidation())

      const files = [{ file: { path: '/test.mp4', name: 'test.mp4' }, camera: 1 }]

      const validation = await result.current.validateFiles(files)

      expect(confirm).not.toHaveBeenCalled()
      expect(validation.isValid).toBe(true)
    })
  })

  // ============================================================================
  // Folder Existence Tests
  // ============================================================================

  describe('checkFolderExists', () => {
    it('should return not exists when folder does not exist', async () => {
      const { result } = renderHook(() => useProjectValidation())

      vi.mocked(exists).mockResolvedValueOnce(false)

      const check = await result.current.checkFolderExists('/test/path')

      expect(exists).toHaveBeenCalledWith('/test/path')
      expect(check.exists).toBe(false)
      expect(check.shouldProceed).toBe(true)
    })

    it('should confirm overwrite when folder exists', async () => {
      const { result } = renderHook(() => useProjectValidation())

      vi.mocked(exists).mockResolvedValueOnce(true)
      vi.mocked(confirm).mockResolvedValueOnce(false)

      const check = await result.current.checkFolderExists('/test/path')

      expect(confirm).toHaveBeenCalledWith(
        'The folder "/test/path" already exists. Do you want to overwrite it?'
      )
      expect(check.exists).toBe(true)
      expect(check.shouldProceed).toBe(false)
    })

    it('should proceed when user confirms overwrite', async () => {
      const { result } = renderHook(() => useProjectValidation())

      vi.mocked(exists).mockResolvedValueOnce(true)
      vi.mocked(confirm).mockResolvedValueOnce(true)

      const check = await result.current.checkFolderExists('/test/path')

      expect(check.exists).toBe(true)
      expect(check.shouldProceed).toBe(true)
      expect(check.shouldRemove).toBe(true)
    })

    it('should remove existing folder when confirmed', async () => {
      const { result } = renderHook(() => useProjectValidation())

      vi.mocked(exists).mockResolvedValueOnce(true)
      vi.mocked(confirm).mockResolvedValueOnce(true)
      vi.mocked(remove).mockResolvedValueOnce(undefined)

      const check = await result.current.checkFolderExists('/test/path')

      if (check.shouldRemove) {
        await result.current.removeExistingFolder('/test/path')
      }

      expect(remove).toHaveBeenCalledWith('/test/path', { recursive: true })
    })
  })

  // ============================================================================
  // Complete Validation Tests
  // ============================================================================

  describe('validateAll', () => {
    it('should validate all inputs and return combined result', async () => {
      const { result } = renderHook(() => useProjectValidation())

      vi.mocked(exists).mockResolvedValueOnce(false)

      const validation = await result.current.validateAll({
        title: 'Test Project',
        selectedFolder: '/destination',
        files: [{ file: { path: '/test.mp4', name: 'test.mp4' }, camera: 1 }]
      })

      expect(validation.isValid).toBe(true)
      expect(validation.trimmedTitle).toBe('Test Project')
      expect(validation.projectFolder).toBe('/destination/Test Project')
    })

    it('should fail if folder is invalid', async () => {
      const { result } = renderHook(() => useProjectValidation())

      const validation = await result.current.validateAll({
        title: 'Test Project',
        selectedFolder: '',
        files: []
      })

      expect(validation.isValid).toBe(false)
      expect(validation.error).toBe('Please select a destination folder.')
    })

    it('should fail if title is invalid', async () => {
      const { result } = renderHook(() => useProjectValidation())

      const validation = await result.current.validateAll({
        title: '',
        selectedFolder: '/destination',
        files: []
      })

      expect(validation.isValid).toBe(false)
      expect(validation.error).toBe('Please enter a project title.')
    })

    it('should fail if user cancels file confirmation', async () => {
      const { result } = renderHook(() => useProjectValidation())

      vi.mocked(confirm).mockResolvedValueOnce(false) // Cancel file confirmation
      vi.mocked(exists).mockResolvedValueOnce(false)

      const validation = await result.current.validateAll({
        title: 'Test Project',
        selectedFolder: '/destination',
        files: []
      })

      expect(validation.isValid).toBe(false)
      expect(validation.userCancelled).toBe(true)
    })

    it('should fail if folder exists and user cancels overwrite', async () => {
      const { result } = renderHook(() => useProjectValidation())

      vi.mocked(confirm).mockResolvedValueOnce(true) // Confirm no files
      vi.mocked(exists).mockResolvedValueOnce(true) // Folder exists
      vi.mocked(confirm).mockResolvedValueOnce(false) // Cancel overwrite

      const validation = await result.current.validateAll({
        title: 'Test Project',
        selectedFolder: '/destination',
        files: []
      })

      expect(validation.isValid).toBe(false)
      expect(validation.userCancelled).toBe(true)
    })

    it('should succeed and remove folder if all validations pass', async () => {
      const { result } = renderHook(() => useProjectValidation())

      vi.mocked(exists).mockResolvedValueOnce(true) // Folder exists
      vi.mocked(confirm).mockResolvedValueOnce(true) // Confirm overwrite
      vi.mocked(remove).mockResolvedValueOnce(undefined)

      const validation = await result.current.validateAll({
        title: 'Test Project',
        selectedFolder: '/destination',
        files: [{ file: { path: '/test.mp4', name: 'test.mp4' }, camera: 1 }]
      })

      expect(validation.isValid).toBe(true)
      expect(validation.folderExists).toBe(true)
      expect(remove).toHaveBeenCalledWith('/destination/Test Project', {
        recursive: true
      })
    })
  })

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('error handling', () => {
    it('should handle exists check error', async () => {
      const { result } = renderHook(() => useProjectValidation())

      vi.mocked(exists).mockRejectedValueOnce(new Error('Permission denied'))

      const check = await result.current.checkFolderExists('/test/path')

      expect(check.error).toBeDefined()
      expect(check.shouldProceed).toBe(false)
    })

    it('should handle remove folder error', async () => {
      const { result } = renderHook(() => useProjectValidation())

      vi.mocked(remove).mockRejectedValueOnce(new Error('Permission denied'))

      await expect(result.current.removeExistingFolder('/test/path')).rejects.toThrow(
        'Permission denied'
      )
    })
  })
})
