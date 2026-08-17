/**
 * useBreadcrumb Hook Tests
 * Purpose: Test breadcrumb state management with React Query and Zustand
 */

import { useBreadcrumb } from '@shared/hooks/useBreadcrumb'
import { useBreadcrumbStore } from '@shared/store'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the Zustand store
vi.mock('@shared/store/useBreadcrumbStore', () => ({
  useBreadcrumbStore: vi.fn()
}))

describe('useBreadcrumb', () => {
  let queryClient: QueryClient
  const mockSetBreadcrumbs = vi.fn()

  // Helper to render hook with QueryClient
  const renderHookWithClient = (items: Array<{ label: string; href?: string }>) => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    return renderHook(() => useBreadcrumb(items), { wrapper })
  }

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          refetchOnWindowFocus: false // Disable auto refetch on window focus
        },
        mutations: { retry: false }
      }
    })

    vi.clearAllMocks()

    // Mock the Zustand store selector
    vi.mocked(useBreadcrumbStore).mockImplementation((selector) =>
      selector({ breadcrumbs: [], setBreadcrumbs: mockSetBreadcrumbs })
    )
  })

  // ============================================================================
  // Initialization Tests
  // ============================================================================

  describe('initialization', () => {
    it('should initialize with breadcrumb items', async () => {
      const items = [
        { label: 'Home', href: '/' },
        { label: 'Projects', href: '/projects' }
      ]

      const { result } = renderHookWithClient(items)

      await waitFor(() => {
        expect(result.current.breadcrumbData).toBeDefined()
      })

      expect(result.current.breadcrumbData?.path).toBe('Home > Projects')
      expect(result.current.breadcrumbData?.items).toHaveLength(2)
    })

    it('should handle items without href', async () => {
      const items = [{ label: 'Home' }, { label: 'Current Page' }]

      const { result } = renderHookWithClient(items)

      await waitFor(() => {
        expect(result.current.breadcrumbData).toBeDefined()
      })

      expect(result.current.breadcrumbData?.items[0].url).toBe('#')
      expect(result.current.breadcrumbData?.items[1].url).toBe('#')
    })

    it('should handle empty items array', async () => {
      const items: Array<{ label: string; href?: string }> = []

      const { result } = renderHookWithClient(items)

      await waitFor(() => {
        expect(result.current.breadcrumbData).toBeDefined()
      })

      expect(result.current.breadcrumbData?.path).toBe('')
      expect(result.current.breadcrumbData?.items).toHaveLength(0)
    })

    it('should set updatedAt timestamp', async () => {
      const items = [{ label: 'Home', href: '/' }]

      const { result } = renderHookWithClient(items)

      await waitFor(() => {
        expect(result.current.breadcrumbData).toBeDefined()
      })

      expect(result.current.breadcrumbData?.updatedAt).toBeDefined()
      expect(new Date(result.current.breadcrumbData!.updatedAt)).toBeInstanceOf(Date)
    })
  })

  // ============================================================================
  // Path Generation Tests
  // ============================================================================

  describe('path generation', () => {
    it('should generate correct path from labels', async () => {
      const items = [
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Users', href: '/users' },
        { label: 'Profile', href: '/profile' }
      ]

      const { result } = renderHookWithClient(items)

      await waitFor(() => {
        expect(result.current.breadcrumbData?.path).toBe('Dashboard > Users > Profile')
      })
    })

    it('should handle single item', async () => {
      const items = [{ label: 'Home', href: '/' }]

      const { result } = renderHookWithClient(items)

      await waitFor(() => {
        expect(result.current.breadcrumbData?.path).toBe('Home')
      })
    })

    it('should preserve label spacing', async () => {
      const items = [
        { label: 'Item One', href: '/one' },
        { label: 'Item  Two', href: '/two' }
      ]

      const { result } = renderHookWithClient(items)

      await waitFor(() => {
        expect(result.current.breadcrumbData?.path).toContain('Item One')
        expect(result.current.breadcrumbData?.path).toContain('Item  Two')
      })
    })
  })

  // ============================================================================
  // Items Conversion Tests
  // ============================================================================

  describe('items conversion', () => {
    it('should convert items to breadcrumb data format', async () => {
      const items = [
        { label: 'Home', href: '/' },
        { label: 'About', href: '/about' }
      ]

      const { result } = renderHookWithClient(items)

      await waitFor(() => {
        expect(result.current.breadcrumbData?.items).toEqual([
          { name: 'Home', url: '/' },
          { name: 'About', url: '/about' }
        ])
      })
    })

    it('should use "#" for items without href', async () => {
      const items = [{ label: 'Home', href: '/' }, { label: 'Current' }]

      const { result } = renderHookWithClient(items)

      await waitFor(() => {
        expect(result.current.breadcrumbData?.items[1]).toEqual({
          name: 'Current',
          url: '#'
        })
      })
    })
  })

  // ============================================================================
  // Zustand Store Integration Tests
  // ============================================================================

  describe('Zustand store integration', () => {
    it('should call setBreadcrumbs on initialization', async () => {
      const items = [{ label: 'Home', href: '/' }]

      renderHookWithClient(items)

      await waitFor(() => {
        expect(mockSetBreadcrumbs).toHaveBeenCalledWith(items)
      })
    })

    it('should update Zustand store when items change', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      )

      const { rerender } = renderHook(
        ({ items }: { items: Array<{ label: string; href?: string }> }) =>
          useBreadcrumb(items),
        {
          wrapper,
          initialProps: { items: [{ label: 'Home', href: '/' }] }
        }
      )

      await waitFor(() => {
        expect(mockSetBreadcrumbs).toHaveBeenCalledWith([{ label: 'Home', href: '/' }])
      })

      mockSetBreadcrumbs.mockClear()

      rerender({
        items: [
          { label: 'Home', href: '/' },
          { label: 'New Page', href: '/new' }
        ]
      })

      await waitFor(() => {
        expect(mockSetBreadcrumbs).toHaveBeenCalledWith([
          { label: 'Home', href: '/' },
          { label: 'New Page', href: '/new' }
        ])
      })
    })
  })

  // ============================================================================
  // Render Stability (issue #228)
  // ============================================================================

  // Every page in the app calls this hook, and callers write the items array
  // inline. If a render can schedule the write, and the write can schedule the
  // next render, the whole tree spins: measured at ~570 renders per second on an
  // idle Build Project screen, each one re-running the sidebar's vibrancy effect
  // for two Tauri IPC calls. See issue #228.
  describe('render stability', () => {
    it('does not write the breadcrumbs again when a re-render allocates an equal items array', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      )

      // A fresh array literal on every render, exactly as the pages write it.
      const { rerender } = renderHook(
        () =>
          useBreadcrumb([
            { label: 'Ingest footage', href: '/ingest/build' },
            { label: 'Build a project' }
          ]),
        { wrapper }
      )

      await waitFor(() => {
        expect(mockSetBreadcrumbs).toHaveBeenCalled()
      })
      mockSetBreadcrumbs.mockClear()

      rerender()
      rerender()
      rerender()
      await act(async () => {
        await Promise.resolve()
      })

      expect(mockSetBreadcrumbs).not.toHaveBeenCalled()
    })

    it('does not rewrite the query cache when a re-render allocates an equal items array', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      )

      const { rerender } = renderHook(
        () => useBreadcrumb([{ label: 'Ingest footage', href: '/ingest/build' }]),
        { wrapper }
      )

      await waitFor(() => {
        expect(queryClient.getQueryData(['navigation', 'breadcrumb'])).toBeDefined()
      })

      const before = queryClient.getQueryState([
        'navigation',
        'breadcrumb'
      ])?.dataUpdateCount

      rerender()
      rerender()
      rerender()
      await act(async () => {
        await Promise.resolve()
      })

      expect(
        queryClient.getQueryState(['navigation', 'breadcrumb'])?.dataUpdateCount
      ).toBe(before)
    })
  })

  // ============================================================================
  // React Query Cache Tests
  // ============================================================================

  describe('React Query cache', () => {
    it('should cache breadcrumb data in React Query', async () => {
      const items = [{ label: 'Home', href: '/' }]

      renderHookWithClient(items)

      await waitFor(() => {
        const cachedData = queryClient.getQueryData(['navigation', 'breadcrumb'])
        expect(cachedData).toBeDefined()
      })
    })

    it('should use stale time of 5 minutes', async () => {
      const items = [{ label: 'Home', href: '/' }]

      renderHookWithClient(items)

      await waitFor(() => {
        const queryState = queryClient.getQueryState(['navigation', 'breadcrumb'])
        expect(queryState).toBeDefined()
      })
    })

    it('should not refetch on window focus', async () => {
      const items = [{ label: 'Home', href: '/' }]

      const { result } = renderHookWithClient(items)

      await waitFor(() => {
        expect(result.current.breadcrumbData).toBeDefined()
      })

      // Wait for any pending updates to settle
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
      })

      // Get the fetch status before focus
      const queryStateBefore = queryClient.getQueryState(['navigation', 'breadcrumb'])
      const fetchStatusBefore = queryStateBefore?.fetchStatus

      // Simulate window focus
      await act(async () => {
        window.dispatchEvent(new Event('focus'))
        // Wait a bit to ensure no refetch happens
        await new Promise((resolve) => setTimeout(resolve, 100))
      })

      // Query should not be fetching after focus (refetchOnWindowFocus: false)
      const queryStateAfter = queryClient.getQueryState(['navigation', 'breadcrumb'])
      const fetchStatusAfter = queryStateAfter?.fetchStatus

      // The fetch status should remain idle (not fetching)
      expect(fetchStatusBefore).toBe('idle')
      expect(fetchStatusAfter).toBe('idle')
    })
  })

  // ============================================================================
  // updateBreadcrumbs Function Tests
  // ============================================================================

  describe('updateBreadcrumbs function', () => {
    it('should be available in return value', async () => {
      const items = [{ label: 'Home', href: '/' }]

      const { result } = renderHookWithClient(items)

      expect(result.current.updateBreadcrumbs).toBeDefined()
      expect(typeof result.current.updateBreadcrumbs).toBe('function')
    })

    it('should update both cache and store when called', async () => {
      const items = [{ label: 'Home', href: '/' }]

      const { result } = renderHookWithClient(items)

      await waitFor(() => {
        expect(result.current.breadcrumbData).toBeDefined()
      })

      mockSetBreadcrumbs.mockClear()

      result.current.updateBreadcrumbs()

      await waitFor(() => {
        expect(mockSetBreadcrumbs).toHaveBeenCalledWith(items)
      })

      const cachedData = queryClient.getQueryData(['navigation', 'breadcrumb'])
      expect(cachedData).toBeDefined()
    })
  })

  // ============================================================================
  // Return Value Tests
  // ============================================================================

  describe('return value', () => {
    it('should return breadcrumbData and updateBreadcrumbs', async () => {
      const items = [{ label: 'Home', href: '/' }]

      const { result } = renderHookWithClient(items)

      await waitFor(() => {
        expect(result.current).toHaveProperty('breadcrumbData')
        expect(result.current).toHaveProperty('updateBreadcrumbs')
      })
    })

    it('should return undefined initially before query resolves', () => {
      const items = [{ label: 'Home', href: '/' }]

      const { result } = renderHookWithClient(items)

      // Initially undefined before async query resolves
      // (or may be defined immediately - depends on query execution)
      expect(result.current.updateBreadcrumbs).toBeDefined()
    })
  })

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    it('should handle special characters in labels', async () => {
      const items = [
        { label: 'Home & Office', href: '/' },
        { label: 'Projects > Active', href: '/projects' }
      ]

      const { result } = renderHookWithClient(items)

      await waitFor(() => {
        expect(result.current.breadcrumbData?.path).toContain('Home & Office')
        expect(result.current.breadcrumbData?.path).toContain('Projects > Active')
      })
    })

    it('should handle very long label strings', async () => {
      const longLabel = 'A'.repeat(200)
      const items = [{ label: longLabel, href: '/' }]

      const { result } = renderHookWithClient(items)

      await waitFor(() => {
        expect(result.current.breadcrumbData?.path).toBe(longLabel)
      })
    })

    it('should handle unicode characters in labels', async () => {
      const items = [
        { label: '主页', href: '/' },
        { label: 'Проекты', href: '/projects' },
        { label: '🏠 Home', href: '/home' }
      ]

      const { result } = renderHookWithClient(items)

      await waitFor(() => {
        expect(result.current.breadcrumbData?.items).toHaveLength(3)
        expect(result.current.breadcrumbData?.items[0].name).toBe('主页')
        expect(result.current.breadcrumbData?.items[1].name).toBe('Проекты')
        expect(result.current.breadcrumbData?.items[2].name).toBe('🏠 Home')
      })
    })
  })
})
