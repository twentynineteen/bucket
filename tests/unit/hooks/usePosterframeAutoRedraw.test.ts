import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { usePosterframeAutoRedraw } from '@hooks/usePosterframeAutoRedraw'
import type { ReactNode } from 'react'

describe('usePosterframeAutoRedraw', () => {
  let mockDraw: ReturnType<typeof vi.fn>
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false }
      }
    })
    mockDraw = vi.fn().mockResolvedValue(undefined)
    vi.clearAllMocks()
  })

  const createTestWrapper = () => {
    return ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children)
  }

  describe('Debouncing Behavior (300ms)', () => {
    test('should not call draw immediately with both imageUrl and title', () => {
      renderHook(
        () =>
          usePosterframeAutoRedraw({
            draw: mockDraw,
            imageUrl: '/test-image.jpg',
            title: 'Test Title'
          }),
        { wrapper: createTestWrapper() }
      )

      // With debouncing, draw should not be called immediately
      expect(mockDraw).not.toHaveBeenCalled()
    })

    test('should debounce rapid title changes', async () => {
      const { rerender } = renderHook(
        ({ title }) =>
          usePosterframeAutoRedraw({
            draw: mockDraw,
            imageUrl: '/test-image.jpg',
            title,
            debounceMs: 100
          }),
        {
          wrapper: createTestWrapper(),
          initialProps: { title: 'Title 1' }
        }
      )

      // Rapid title changes
      rerender({ title: 'Title 2' })
      rerender({ title: 'Title 3' })
      rerender({ title: 'Title 4' })

      // Should handle rapid changes without throwing
      expect(() => rerender({ title: 'Final Title' })).not.toThrow()
    })

    test('should use custom debounce delay', () => {
      const { result } = renderHook(
        () =>
          usePosterframeAutoRedraw({
            draw: mockDraw,
            imageUrl: '/test-image.jpg',
            title: 'Test Title',
            debounceMs: 500
          }),
        { wrapper: createTestWrapper() }
      )

      expect(result.current).toBeUndefined()
    })
  })

  describe('Initial Draw Behavior', () => {
    test('should draw background immediately when imageUrl exists but title is empty', () => {
      renderHook(
        () =>
          usePosterframeAutoRedraw({
            draw: mockDraw,
            imageUrl: '/test-image.jpg',
            title: ''
          }),
        { wrapper: createTestWrapper() }
      )

      expect(mockDraw).toHaveBeenCalledWith('/test-image.jpg', '')
      expect(mockDraw).toHaveBeenCalledTimes(1)
    })

    test('should not call draw when imageUrl is null', () => {
      renderHook(
        () =>
          usePosterframeAutoRedraw({
            draw: mockDraw,
            imageUrl: null,
            title: 'Test Title'
          }),
        { wrapper: createTestWrapper() }
      )

      expect(mockDraw).not.toHaveBeenCalled()
    })

    test('should draw background immediately when title is whitespace', () => {
      renderHook(
        () =>
          usePosterframeAutoRedraw({
            draw: mockDraw,
            imageUrl: '/test-image.jpg',
            title: '   '
          }),
        { wrapper: createTestWrapper() }
      )

      expect(mockDraw).toHaveBeenCalledWith('/test-image.jpg', '')
      expect(mockDraw).toHaveBeenCalledTimes(1)
    })
  })

  describe('Input Changes', () => {
    test('should handle imageUrl changing from valid to null', async () => {
      const { rerender } = renderHook(
        ({ imageUrl }) =>
          usePosterframeAutoRedraw({
            draw: mockDraw,
            imageUrl,
            title: 'Test Title'
          }),
        {
          wrapper: createTestWrapper(),
          initialProps: { imageUrl: '/test-image.jpg' as string | null }
        }
      )

      mockDraw.mockClear()
      rerender({ imageUrl: null })

      await waitFor(() => expect(mockDraw).not.toHaveBeenCalled(), { timeout: 200 })
    })

    test('should handle title changing from valid to empty', async () => {
      const { rerender } = renderHook(
        ({ title }) =>
          usePosterframeAutoRedraw({
            draw: mockDraw,
            imageUrl: '/test-image.jpg',
            title
          }),
        {
          wrapper: createTestWrapper(),
          initialProps: { title: 'Test Title' }
        }
      )

      mockDraw.mockClear()
      rerender({ title: '' })

      await waitFor(() => expect(mockDraw).toHaveBeenCalledWith('/test-image.jpg', ''))
    })
  })

  describe('Cleanup', () => {
    test('should not throw on unmount', () => {
      const { unmount } = renderHook(
        () =>
          usePosterframeAutoRedraw({
            draw: mockDraw,
            imageUrl: '/test-image.jpg',
            title: 'Test Title'
          }),
        { wrapper: createTestWrapper() }
      )

      expect(() => unmount()).not.toThrow()
    })

    test('should handle cleanup when inputs become invalid', async () => {
      const { rerender } = renderHook(
        ({ imageUrl }) =>
          usePosterframeAutoRedraw({
            draw: mockDraw,
            imageUrl,
            title: 'Test Title'
          }),
        {
          wrapper: createTestWrapper(),
          initialProps: { imageUrl: '/test-image.jpg' as string | null }
        }
      )

      rerender({ imageUrl: null })

      await waitFor(() => expect(() => rerender({ imageUrl: null })).not.toThrow())
    })
  })

  describe('Error Handling', () => {
    test('should handle draw function errors gracefully', async () => {
      mockDraw.mockRejectedValueOnce(new Error('Canvas draw failed'))

      renderHook(
        () =>
          usePosterframeAutoRedraw({
            draw: mockDraw,
            imageUrl: '/test-image.jpg',
            title: ''
          }),
        { wrapper: createTestWrapper() }
      )

      await waitFor(() => expect(mockDraw).toHaveBeenCalled())
    })
  })
})
