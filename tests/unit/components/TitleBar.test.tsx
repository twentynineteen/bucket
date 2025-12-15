import { TitleBar } from '@components/TitleBar'
import { render } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

// Mock navigator.platform
const mockNavigator = (platform: string) => {
  Object.defineProperty(window.navigator, 'platform', {
    value: platform,
    configurable: true,
    writable: true
  })
}

describe('TitleBar Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Platform Detection', () => {
    test('renders on macOS platform', () => {
      mockNavigator('MacIntel')

      const { container } = render(<TitleBar />)

      expect(container.querySelector('[data-tauri-drag-region]')).toBeInTheDocument()
    })

    test('does not render on Windows platform', () => {
      mockNavigator('Win32')

      const { container } = render(<TitleBar />)

      expect(container.querySelector('[data-tauri-drag-region]')).not.toBeInTheDocument()
    })

    test('does not render on Linux platform', () => {
      mockNavigator('Linux x86_64')

      const { container } = render(<TitleBar />)

      expect(container.querySelector('[data-tauri-drag-region]')).not.toBeInTheDocument()
    })
  })

  describe('Performance Optimizations', () => {
    beforeEach(() => {
      mockNavigator('MacIntel')
    })

    test('does not use backdrop-blur for better drag performance', () => {
      const { container } = render(<TitleBar />)

      const dragRegion = container.querySelector('[data-tauri-drag-region]')
      expect(dragRegion).toBeInTheDocument()

      // Verify no backdrop blur classes that would hurt drag performance
      expect(dragRegion?.className).not.toContain('backdrop-blur')
    })

    test('uses solid background instead of semi-transparent with blur', () => {
      const { container } = render(<TitleBar />)

      const dragRegion = container.querySelector('[data-tauri-drag-region]')
      expect(dragRegion).toBeInTheDocument()

      // Should use solid background (bg-background) not semi-transparent (bg-background/95)
      expect(dragRegion?.className).toContain('bg-background')
      // Verify it's not using opacity variants
      expect(dragRegion?.className).not.toMatch(/bg-background\/\d+/)
    })

    test('does not use WebkitAppRegion to avoid dual drag handler conflict', () => {
      const { container } = render(<TitleBar />)

      const dragRegion = container.querySelector('[data-tauri-drag-region]')
      expect(dragRegion).toBeInTheDocument()

      // Should only use data-tauri-drag-region, not WebkitAppRegion
      const style = (dragRegion as HTMLElement)?.style
      expect(style?.WebkitAppRegion).toBeFalsy()
    })

    test('has willChange performance hint for smooth dragging', () => {
      const { container } = render(<TitleBar />)

      const dragRegion = container.querySelector('[data-tauri-drag-region]')
      expect(dragRegion).toBeInTheDocument()

      const style = (dragRegion as HTMLElement)?.style
      expect(style?.willChange).toBe('transform')
    })
  })

  describe('Draggable Region', () => {
    beforeEach(() => {
      mockNavigator('MacIntel')
    })

    test('has data-tauri-drag-region attribute', () => {
      const { container } = render(<TitleBar />)

      const dragRegion = container.querySelector('[data-tauri-drag-region]')
      expect(dragRegion).toBeInTheDocument()
      expect(dragRegion).toHaveAttribute('data-tauri-drag-region')
    })

    test('has correct positioning for macOS traffic lights', () => {
      const { container } = render(<TitleBar />)

      const dragRegion = container.querySelector('[data-tauri-drag-region]')
      expect(dragRegion).toBeInTheDocument()

      // Check inline style for proper traffic light spacing
      const style = (dragRegion as HTMLElement)?.style
      expect(style?.paddingLeft).toBe('80px')
    })

    test('has fixed positioning at top of viewport', () => {
      const { container } = render(<TitleBar />)

      const dragRegion = container.querySelector('[data-tauri-drag-region]')
      expect(dragRegion).toBeInTheDocument()

      // Verify fixed positioning classes
      expect(dragRegion).toHaveClass('fixed')
      expect(dragRegion).toHaveClass('top-0')
      expect(dragRegion).toHaveClass('left-0')
      expect(dragRegion).toHaveClass('right-0')
    })

    test('has high z-index to stay above content', () => {
      const { container } = render(<TitleBar />)

      const dragRegion = container.querySelector('[data-tauri-drag-region]')
      expect(dragRegion).toBeInTheDocument()

      expect(dragRegion).toHaveClass('z-50')
    })

    test('has correct height', () => {
      const { container } = render(<TitleBar />)

      const dragRegion = container.querySelector('[data-tauri-drag-region]')
      expect(dragRegion).toBeInTheDocument()

      expect(dragRegion).toHaveClass('h-14')
    })
  })

  describe('Content', () => {
    beforeEach(() => {
      mockNavigator('MacIntel')
    })

    test('renders "Bucket" title', () => {
      const { container } = render(<TitleBar />)

      const title = container.querySelector('span')
      expect(title).toBeInTheDocument()
      expect(title?.textContent).toBe('Bucket')
    })

    test('title text exists and is properly styled', () => {
      const { container } = render(<TitleBar />)

      const titleContainer = container.querySelector('.text-sm.font-medium')
      expect(titleContainer).toBeInTheDocument()
    })
  })

  describe('Visual Styling', () => {
    beforeEach(() => {
      mockNavigator('MacIntel')
    })

    test('has border at bottom', () => {
      const { container } = render(<TitleBar />)

      const dragRegion = container.querySelector('[data-tauri-drag-region]')
      expect(dragRegion).toBeInTheDocument()

      expect(dragRegion).toHaveClass('border-b')
    })

    test('has subtle border color', () => {
      const { container } = render(<TitleBar />)

      const dragRegion = container.querySelector('[data-tauri-drag-region]')
      expect(dragRegion).toBeInTheDocument()

      expect(dragRegion).toHaveClass('border-border/50')
    })

    test('has flexbox layout', () => {
      const { container } = render(<TitleBar />)

      const dragRegion = container.querySelector('[data-tauri-drag-region]')
      expect(dragRegion).toBeInTheDocument()

      expect(dragRegion).toHaveClass('flex')
      expect(dragRegion).toHaveClass('items-center')
    })

    test('has horizontal padding', () => {
      const { container } = render(<TitleBar />)

      const dragRegion = container.querySelector('[data-tauri-drag-region]')
      expect(dragRegion).toBeInTheDocument()

      expect(dragRegion).toHaveClass('px-4')
    })
  })

  describe('Layout Structure', () => {
    beforeEach(() => {
      mockNavigator('MacIntel')
    })

    test('has spacer for flexible layout', () => {
      const { container } = render(<TitleBar />)

      const spacer = container.querySelector('.flex-1')
      expect(spacer).toBeInTheDocument()
    })

    test('title has subtle text color', () => {
      const { container } = render(<TitleBar />)

      const titleContainer = container.querySelector('.text-sm.font-medium')
      expect(titleContainer).toBeInTheDocument()

      expect(titleContainer).toHaveClass('text-foreground/70')
    })

    test('title is vertically centered with adjustment', () => {
      const { container } = render(<TitleBar />)

      const titleContainer = container.querySelector('.text-sm.font-medium')
      expect(titleContainer).toBeInTheDocument()

      const style = (titleContainer as HTMLElement)?.style
      expect(style?.marginTop).toBe('-12px')
    })
  })
})
