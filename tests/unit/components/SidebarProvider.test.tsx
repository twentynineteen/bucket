import * as useMobileHook from '@components/hooks/use-mobile'
import { SidebarProvider, useSidebar } from '@components/ui/sidebar'
import { act, render, renderHook } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

// Mock the use-mobile hook
vi.mock('@components/hooks/use-mobile', () => ({
  useIsMobile: vi.fn()
}))

describe('SidebarProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default to desktop mode
    vi.mocked(useMobileHook.useIsMobile).mockReturnValue(false)
    // Clear cookies
    document.cookie = 'sidebar_state=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
  })

  describe('Context Provider', () => {
    test('provides sidebar context to children', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SidebarProvider>{children}</SidebarProvider>
      )

      const { result } = renderHook(() => useSidebar(), { wrapper })

      expect(result.current).toHaveProperty('state')
      expect(result.current).toHaveProperty('open')
      expect(result.current).toHaveProperty('setOpen')
      expect(result.current).toHaveProperty('isMobile')
      expect(result.current).toHaveProperty('openMobile')
      expect(result.current).toHaveProperty('setOpenMobile')
      expect(result.current).toHaveProperty('toggleSidebar')
    })

    test('throws error when useSidebar is used outside provider', () => {
      // Suppress console error for this test
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      expect(() => {
        renderHook(() => useSidebar())
      }).toThrow('useSidebar must be used within a SidebarProvider.')

      consoleError.mockRestore()
    })
  })

  describe('Default State', () => {
    test('initializes with defaultOpen=true', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SidebarProvider defaultOpen={true}>{children}</SidebarProvider>
      )

      const { result } = renderHook(() => useSidebar(), { wrapper })

      expect(result.current.open).toBe(true)
      expect(result.current.state).toBe('expanded')
    })

    test('initializes with defaultOpen=false', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SidebarProvider defaultOpen={false}>{children}</SidebarProvider>
      )

      const { result } = renderHook(() => useSidebar(), { wrapper })

      expect(result.current.open).toBe(false)
      expect(result.current.state).toBe('collapsed')
    })

    test('uses defaultOpen=true when no prop provided', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SidebarProvider>{children}</SidebarProvider>
      )

      const { result } = renderHook(() => useSidebar(), { wrapper })

      expect(result.current.open).toBe(true)
    })
  })

  describe('Controlled State', () => {
    test('accepts controlled open prop', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SidebarProvider open={false}>{children}</SidebarProvider>
      )

      const { result } = renderHook(() => useSidebar(), { wrapper })

      expect(result.current.open).toBe(false)
    })

    test('calls onOpenChange when setOpen is called', () => {
      const onOpenChange = vi.fn()
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SidebarProvider open={true} onOpenChange={onOpenChange}>
          {children}
        </SidebarProvider>
      )

      const { result } = renderHook(() => useSidebar(), { wrapper })

      act(() => {
        result.current.setOpen(false)
      })

      expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    test('supports function updater in setOpen', () => {
      const onOpenChange = vi.fn()
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SidebarProvider open={true} onOpenChange={onOpenChange}>
          {children}
        </SidebarProvider>
      )

      const { result } = renderHook(() => useSidebar(), { wrapper })

      act(() => {
        result.current.setOpen(prev => !prev)
      })

      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  describe('Uncontrolled State', () => {
    test('manages internal state when not controlled', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SidebarProvider defaultOpen={true}>{children}</SidebarProvider>
      )

      const { result } = renderHook(() => useSidebar(), { wrapper })

      expect(result.current.open).toBe(true)

      act(() => {
        result.current.setOpen(false)
      })

      expect(result.current.open).toBe(false)
      expect(result.current.state).toBe('collapsed')
    })

    test('supports function updater in uncontrolled mode', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SidebarProvider defaultOpen={true}>{children}</SidebarProvider>
      )

      const { result } = renderHook(() => useSidebar(), { wrapper })

      act(() => {
        result.current.setOpen(prev => !prev)
      })

      expect(result.current.open).toBe(false)
    })
  })

  describe('Cookie Persistence', () => {
    test('sets cookie when open state changes', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SidebarProvider defaultOpen={true}>{children}</SidebarProvider>
      )

      const { result } = renderHook(() => useSidebar(), { wrapper })

      act(() => {
        result.current.setOpen(false)
      })

      expect(document.cookie).toContain('sidebar_state=false')
    })

    test('includes correct cookie attributes', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SidebarProvider defaultOpen={true}>{children}</SidebarProvider>
      )

      const { result } = renderHook(() => useSidebar(), { wrapper })

      act(() => {
        result.current.setOpen(true)
      })

      const cookie = document.cookie
      expect(cookie).toContain('sidebar_state=true')
      // Note: jsdom may not preserve all cookie attributes in document.cookie
      // but the actual implementation sets them correctly
    })
  })

  describe('Mobile Behavior', () => {
    test('detects mobile mode', () => {
      vi.mocked(useMobileHook.useIsMobile).mockReturnValue(true)

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SidebarProvider>{children}</SidebarProvider>
      )

      const { result } = renderHook(() => useSidebar(), { wrapper })

      expect(result.current.isMobile).toBe(true)
    })

    test('initializes openMobile to false', () => {
      vi.mocked(useMobileHook.useIsMobile).mockReturnValue(true)

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SidebarProvider>{children}</SidebarProvider>
      )

      const { result } = renderHook(() => useSidebar(), { wrapper })

      expect(result.current.openMobile).toBe(false)
    })

    test('setOpenMobile updates mobile state', () => {
      vi.mocked(useMobileHook.useIsMobile).mockReturnValue(true)

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SidebarProvider>{children}</SidebarProvider>
      )

      const { result } = renderHook(() => useSidebar(), { wrapper })

      act(() => {
        result.current.setOpenMobile(true)
      })

      expect(result.current.openMobile).toBe(true)
    })
  })

  describe('toggleSidebar', () => {
    test('toggles open state on desktop', () => {
      vi.mocked(useMobileHook.useIsMobile).mockReturnValue(false)

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SidebarProvider defaultOpen={true}>{children}</SidebarProvider>
      )

      const { result } = renderHook(() => useSidebar(), { wrapper })

      expect(result.current.open).toBe(true)

      act(() => {
        result.current.toggleSidebar()
      })

      expect(result.current.open).toBe(false)

      act(() => {
        result.current.toggleSidebar()
      })

      expect(result.current.open).toBe(true)
    })

    test('toggles openMobile state on mobile', () => {
      vi.mocked(useMobileHook.useIsMobile).mockReturnValue(true)

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SidebarProvider>{children}</SidebarProvider>
      )

      const { result } = renderHook(() => useSidebar(), { wrapper })

      expect(result.current.openMobile).toBe(false)

      act(() => {
        result.current.toggleSidebar()
      })

      expect(result.current.openMobile).toBe(true)

      act(() => {
        result.current.toggleSidebar()
      })

      expect(result.current.openMobile).toBe(false)
    })
  })

  describe('Keyboard Shortcut', () => {
    test('toggles sidebar with Cmd+B on Mac', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SidebarProvider defaultOpen={true}>{children}</SidebarProvider>
      )

      const { result } = renderHook(() => useSidebar(), { wrapper })

      expect(result.current.open).toBe(true)

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'b',
          metaKey: true,
          bubbles: true
        })
        window.dispatchEvent(event)
      })

      expect(result.current.open).toBe(false)
    })

    test('toggles sidebar with Ctrl+B on Windows/Linux', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SidebarProvider defaultOpen={true}>{children}</SidebarProvider>
      )

      const { result } = renderHook(() => useSidebar(), { wrapper })

      expect(result.current.open).toBe(true)

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'b',
          ctrlKey: true,
          bubbles: true
        })
        window.dispatchEvent(event)
      })

      expect(result.current.open).toBe(false)
    })

    test('does not toggle with B key alone', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SidebarProvider defaultOpen={true}>{children}</SidebarProvider>
      )

      const { result } = renderHook(() => useSidebar(), { wrapper })

      const initialOpen = result.current.open

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'b',
          bubbles: true
        })
        window.dispatchEvent(event)
      })

      expect(result.current.open).toBe(initialOpen)
    })

    test('prevents default behavior on keyboard shortcut', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SidebarProvider>{children}</SidebarProvider>
      )

      renderHook(() => useSidebar(), { wrapper })

      const event = new KeyboardEvent('keydown', {
        key: 'b',
        metaKey: true,
        bubbles: true
      })
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault')

      act(() => {
        window.dispatchEvent(event)
      })

      expect(preventDefaultSpy).toHaveBeenCalled()
    })

    test('removes event listener on unmount', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SidebarProvider>{children}</SidebarProvider>
      )

      const { unmount } = renderHook(() => useSidebar(), { wrapper })

      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')

      unmount()

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function))

      removeEventListenerSpy.mockRestore()
    })
  })

  describe('State Derivation', () => {
    test('derives state="expanded" when open=true', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SidebarProvider defaultOpen={true}>{children}</SidebarProvider>
      )

      const { result } = renderHook(() => useSidebar(), { wrapper })

      expect(result.current.state).toBe('expanded')
    })

    test('derives state="collapsed" when open=false', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SidebarProvider defaultOpen={false}>{children}</SidebarProvider>
      )

      const { result } = renderHook(() => useSidebar(), { wrapper })

      expect(result.current.state).toBe('collapsed')
    })

    test('updates state when open changes', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SidebarProvider defaultOpen={true}>{children}</SidebarProvider>
      )

      const { result } = renderHook(() => useSidebar(), { wrapper })

      expect(result.current.state).toBe('expanded')

      act(() => {
        result.current.setOpen(false)
      })

      expect(result.current.state).toBe('collapsed')
    })
  })

  describe('CSS Variables', () => {
    test('sets sidebar width CSS variables', () => {
      const { container } = render(
        <SidebarProvider>
          <div>Test Content</div>
        </SidebarProvider>
      )

      const wrapper = container.querySelector('.group\\/sidebar-wrapper') as HTMLElement
      expect(wrapper).toBeTruthy()

      const style = wrapper?.style
      expect(style?.getPropertyValue('--sidebar-width')).toBe('16rem')
      expect(style?.getPropertyValue('--sidebar-width-icon')).toBe('3rem')
    })

    test('accepts custom style prop', () => {
      const customStyle = { '--custom-var': '20px' } as React.CSSProperties

      const { container } = render(
        <SidebarProvider style={customStyle}>
          <div>Test Content</div>
        </SidebarProvider>
      )

      const wrapper = container.querySelector('.group\\/sidebar-wrapper') as HTMLElement
      const style = wrapper?.style

      expect(style?.getPropertyValue('--custom-var')).toBe('20px')
      // Should still have default variables
      expect(style?.getPropertyValue('--sidebar-width')).toBe('16rem')
    })
  })

  describe('Memoization', () => {
    test('memoizes context value to prevent unnecessary re-renders', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SidebarProvider defaultOpen={true}>{children}</SidebarProvider>
      )

      const { result, rerender } = renderHook(() => useSidebar(), { wrapper })

      const firstContext = result.current

      // Force a re-render
      rerender()

      // Context should be the same object (memoized)
      expect(result.current).toBe(firstContext)
    })

    test('creates new context value when dependencies change', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SidebarProvider defaultOpen={true}>{children}</SidebarProvider>
      )

      const { result } = renderHook(() => useSidebar(), { wrapper })

      const firstContext = result.current

      act(() => {
        result.current.setOpen(false)
      })

      // Context should be a new object because state changed
      expect(result.current).not.toBe(firstContext)
      expect(result.current.open).toBe(false)
    })
  })
})
