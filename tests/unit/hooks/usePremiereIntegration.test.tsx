/**
 * usePremiereIntegration Hook Tests
 * Purpose: Test Premiere Pro template integration
 *
 * Responsibilities:
 * - Copy Premiere Pro project template
 * - Show completion dialog
 * - Open project folder
 * - Handle UI state (loading, messages)
 */

import { usePremiereIntegration } from '@/hooks/usePremiereIntegration'
import { invoke } from '@tauri-apps/api/core'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

describe('usePremiereIntegration', () => {
  const mockSetLoading = vi.fn()
  const mockSetMessage = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(invoke).mockResolvedValue('Success')
  })

  describe('copyPremiereTemplate', () => {
    it('should invoke copy_premiere_project command', async () => {
      const { result } = renderHook(() => usePremiereIntegration())

      await result.current.copyPremiereTemplate({
        projectFolder: '/destination/Test Project',
        projectTitle: 'Test Project',
        setLoading: mockSetLoading,
        setMessage: mockSetMessage
      })

      expect(invoke).toHaveBeenCalledWith('copy_premiere_project', {
        destinationFolder: '/destination/Test Project/Projects/',
        newTitle: 'Test Project'
      })
    })

    it('should set loading state during copy', async () => {
      const { result } = renderHook(() => usePremiereIntegration())

      const promise = result.current.copyPremiereTemplate({
        projectFolder: '/destination/Test Project',
        projectTitle: 'Test Project',
        setLoading: mockSetLoading,
        setMessage: mockSetMessage
      })

      expect(mockSetLoading).toHaveBeenCalledWith(true)

      await promise

      expect(mockSetLoading).toHaveBeenCalledWith(false)
    })

    it('should set success message', async () => {
      const { result } = renderHook(() => usePremiereIntegration())

      vi.mocked(invoke).mockResolvedValueOnce('Template copied successfully')

      await result.current.copyPremiereTemplate({
        projectFolder: '/destination/Test Project',
        projectTitle: 'Test Project',
        setLoading: mockSetLoading,
        setMessage: mockSetMessage
      })

      expect(mockSetMessage).toHaveBeenCalledWith('Success: Template copied successfully')
    })

    it('should handle copy error', async () => {
      const { result } = renderHook(() => usePremiereIntegration())

      vi.mocked(invoke).mockRejectedValueOnce(new Error('Template not found'))

      await result.current.copyPremiereTemplate({
        projectFolder: '/destination/Test Project',
        projectTitle: 'Test Project',
        setLoading: mockSetLoading,
        setMessage: mockSetMessage
      })

      expect(mockSetMessage).toHaveBeenCalledWith('Error: Error: Template not found')
      expect(mockSetLoading).toHaveBeenCalledWith(false)
    })

    it('should clear message initially', async () => {
      const { result } = renderHook(() => usePremiereIntegration())

      await result.current.copyPremiereTemplate({
        projectFolder: '/destination/Test Project',
        projectTitle: 'Test Project',
        setLoading: mockSetLoading,
        setMessage: mockSetMessage
      })

      expect(mockSetMessage).toHaveBeenCalledWith('')
    })
  })

  describe('showCompletionDialog', () => {
    it('should invoke show_confirmation_dialog command', async () => {
      const { result } = renderHook(() => usePremiereIntegration())

      await result.current.showCompletionDialog({
        projectFolder: '/destination/Test Project',
        projectTitle: 'Test Project'
      })

      expect(invoke).toHaveBeenCalledWith('show_confirmation_dialog', {
        message: 'Do you want to open the project folder now?',
        title: 'Transfer complete!',
        destination: '/destination/Test Project'
      })
    })

    it('should handle dialog error gracefully', async () => {
      const { result } = renderHook(() => usePremiereIntegration())
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      vi.mocked(invoke).mockRejectedValueOnce(new Error('Dialog failed'))

      await result.current.showCompletionDialog({
        projectFolder: '/destination/Test Project',
        projectTitle: 'Test Project'
      })

      expect(consoleSpy).toHaveBeenCalledWith('Error:', expect.any(Error))
      consoleSpy.mockRestore()
    })
  })

  describe('handlePostCompletion', () => {
    it('should copy template and show dialog', async () => {
      const { result } = renderHook(() => usePremiereIntegration())

      await result.current.handlePostCompletion({
        projectFolder: '/destination/Test Project',
        projectTitle: 'Test Project',
        setLoading: mockSetLoading,
        setMessage: mockSetMessage
      })

      // Verify template was copied
      expect(invoke).toHaveBeenCalledWith(
        'copy_premiere_project',
        expect.objectContaining({
          newTitle: 'Test Project'
        })
      )

      // Verify dialog was shown
      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith(
          'show_confirmation_dialog',
          expect.objectContaining({
            title: 'Transfer complete!'
          })
        )
      })
    })

    it('should handle errors in post-completion flow', async () => {
      const { result } = renderHook(() => usePremiereIntegration())

      vi.mocked(invoke).mockRejectedValueOnce(new Error('Copy failed'))

      await result.current.handlePostCompletion({
        projectFolder: '/destination/Test Project',
        projectTitle: 'Test Project',
        setLoading: mockSetLoading,
        setMessage: mockSetMessage
      })

      expect(mockSetMessage).toHaveBeenCalledWith(expect.stringContaining('Error'))
    })
  })
})
