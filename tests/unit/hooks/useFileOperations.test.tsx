/**
 * useFileOperations Hook Tests
 * Purpose: Test file moving operations with progress tracking
 *
 * Responsibilities:
 * - Setup event listeners for file copy progress
 * - Invoke file move command
 * - Handle completion callbacks
 * - Clean up event listeners
 */

import type { FootageFile } from '@/hooks/useCameraAutoRemap'
import { useFileOperations } from '@/hooks/useFileOperations'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn()
}))

describe('useFileOperations', () => {
  const mockUnlisten = vi.fn()
  const mockSetProgress = vi.fn()
  const mockSetCompleted = vi.fn()

  const mockFiles: FootageFile[] = [
    { file: { path: '/source/video1.mp4', name: 'video1.mp4' }, camera: 1 },
    { file: { path: '/source/video2.mp4', name: 'video2.mp4' }, camera: 2 }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(invoke).mockResolvedValue(undefined)
    vi.mocked(listen).mockResolvedValue(mockUnlisten)
  })

  describe('prepareFileList', () => {
    it('should convert FootageFile[] to move format', () => {
      const { result } = renderHook(() => useFileOperations())

      const prepared = result.current.prepareFileList(mockFiles)

      expect(prepared).toEqual([
        ['/source/video1.mp4', 1],
        ['/source/video2.mp4', 2]
      ])
    })

    it('should handle empty array', () => {
      const { result } = renderHook(() => useFileOperations())

      const prepared = result.current.prepareFileList([])

      expect(prepared).toEqual([])
    })
  })

  describe('setupProgressListener', () => {
    it('should setup copy_complete event listener', async () => {
      const { result } = renderHook(() => useFileOperations())

      const onComplete = vi.fn()
      await result.current.setupProgressListener(onComplete)

      expect(listen).toHaveBeenCalledWith('copy_complete', expect.any(Function))
    })

    it('should return unlisten function', async () => {
      const { result } = renderHook(() => useFileOperations())

      const unlisten = await result.current.setupProgressListener(vi.fn())

      expect(unlisten).toBe(mockUnlisten)
    })

    it('should call onComplete when event fires', async () => {
      const { result } = renderHook(() => useFileOperations())

      let eventHandler: any
      vi.mocked(listen).mockImplementation(async (event, handler) => {
        eventHandler = handler
        return mockUnlisten
      })

      const onComplete = vi.fn()
      await result.current.setupProgressListener(onComplete)

      // Simulate event firing
      eventHandler()

      expect(onComplete).toHaveBeenCalled()
    })
  })

  describe('moveFiles', () => {
    it('should invoke move_files command', async () => {
      const { result } = renderHook(() => useFileOperations())

      await result.current.moveFiles(mockFiles, '/destination/Project')

      expect(invoke).toHaveBeenCalledWith('move_files', {
        files: [
          ['/source/video1.mp4', 1],
          ['/source/video2.mp4', 2]
        ],
        baseDest: '/destination/Project'
      })
    })

    it('should handle move error', async () => {
      const { result } = renderHook(() => useFileOperations())

      vi.mocked(invoke).mockRejectedValueOnce(new Error('File not found'))

      await expect(
        result.current.moveFiles(mockFiles, '/destination/Project')
      ).rejects.toThrow('File not found')
    })
  })

  describe('moveFilesWithProgress', () => {
    it('should setup listener, move files, and call callbacks', async () => {
      const { result } = renderHook(() => useFileOperations())

      let eventHandler: any
      vi.mocked(listen).mockImplementation(async (event, handler) => {
        eventHandler = handler
        return mockUnlisten
      })

      const moveResult = await result.current.moveFilesWithProgress({
        files: mockFiles,
        projectFolder: '/destination/Project',
        setProgress: mockSetProgress,
        setCompleted: mockSetCompleted,
        onComplete: vi.fn()
      })

      expect(mockSetProgress).toHaveBeenCalledWith(0)
      expect(mockSetCompleted).toHaveBeenCalledWith(false)
      expect(invoke).toHaveBeenCalledWith('move_files', expect.any(Object))
      expect(moveResult.success).toBe(true)
      expect(moveResult.unlisten).toBe(mockUnlisten)
    })

    it('should handle optional callbacks', async () => {
      const { result } = renderHook(() => useFileOperations())

      const moveResult = await result.current.moveFilesWithProgress({
        files: mockFiles,
        projectFolder: '/destination/Project',
        onComplete: vi.fn()
      })

      expect(moveResult.success).toBe(true)
    })

    it('should cleanup on error', async () => {
      const { result } = renderHook(() => useFileOperations())

      vi.mocked(invoke).mockRejectedValueOnce(new Error('Move failed'))

      const moveResult = await result.current.moveFilesWithProgress({
        files: mockFiles,
        projectFolder: '/destination/Project',
        onComplete: vi.fn()
      })

      expect(moveResult.success).toBe(false)
      expect(moveResult.error).toContain('Move failed')
      expect(mockUnlisten).toHaveBeenCalled()
    })
  })
})
