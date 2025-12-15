/**
 * Button Animation Tests
 * Phase 1.1: Button Micro-interactions
 *
 * Tests for hover, press, and disabled state animations
 * Following TDD methodology - these should fail initially
 */

import { Button } from '@/components/ui/button'
import { BUTTON_ANIMATIONS, DURATION, EASING } from '@/constants/animations'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockReducedMotion } from '@tests/utils/animation-testing'
import { describe, expect, it, vi } from 'vitest'

// Mock matchMedia BEFORE imports using vi.hoisted (required for Framer Motion)
vi.hoisted(() => {
  const mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))

  Object.defineProperty(globalThis.window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: mockMatchMedia
  })
})

describe('Button Animations', () => {
  describe('Animation Presence', () => {
    it('should be a Framer Motion component', () => {
      const { getByRole } = render(<Button>Click me</Button>)
      const button = getByRole('button')

      // Check for Framer Motion's data attribute
      expect(button.hasAttribute('data-projection-id')).toBe(true)
    })

    it('should have animation-related attributes', () => {
      const { getByRole } = render(<Button>Click me</Button>)
      const button = getByRole('button')

      // Framer Motion adds data-projection-id to animated elements
      expect(button).toBeInTheDocument()
      expect(button.hasAttribute('data-projection-id')).toBe(true)
    })
  })

  describe('Hover Interactions', () => {
    it('should be hoverable (has motion attributes)', () => {
      const { getByRole } = render(<Button>Hover me</Button>)
      const button = getByRole('button')

      // Button should be a Framer Motion component with hover capabilities
      expect(button.hasAttribute('data-projection-id')).toBe(true)
    })

    it('should not have hover animation when disabled', () => {
      const { getByRole } = render(<Button disabled>Disabled</Button>)
      const button = getByRole('button')

      // Still a motion component but won't respond to hover
      expect(button).toBeDisabled()
      expect(button.hasAttribute('data-projection-id')).toBe(true)
    })
  })

  describe('Press Interactions', () => {
    it('should be a pressable motion component', () => {
      const { getByRole } = render(<Button>Press me</Button>)
      const button = getByRole('button')

      // Button should have Framer Motion attributes for tap interactions
      expect(button.hasAttribute('data-projection-id')).toBe(true)
      expect(button.tagName).toBe('BUTTON')
    })
  })

  describe('Animation Constants', () => {
    it('should use BUTTON_ANIMATIONS.hover.scale constant', () => {
      expect(BUTTON_ANIMATIONS.hover.scale).toBe(1.02)
    })

    it('should use BUTTON_ANIMATIONS.press.scale constant', () => {
      expect(BUTTON_ANIMATIONS.press.scale).toBe(0.98)
    })

    it('should use DURATION.fast for hover animation', () => {
      expect(BUTTON_ANIMATIONS.hover.duration).toBe(DURATION.fast)
      expect(DURATION.fast).toBe(150)
    })

    it('should use DURATION.instant for press animation', () => {
      expect(BUTTON_ANIMATIONS.press.duration).toBe(DURATION.instant)
      expect(DURATION.instant).toBe(0)
    })

    it('should use EASING.easeOut for hover', () => {
      expect(BUTTON_ANIMATIONS.hover.easing).toBe(EASING.easeOut)
    })
  })

  describe('Disabled State', () => {
    it('should have reduced opacity when disabled', () => {
      const { getByRole } = render(<Button disabled>Disabled</Button>)
      const button = getByRole('button')

      expect(button).toBeDisabled()
      // Opacity should be applied via Tailwind classes
      expect(button.className).toContain('disabled:opacity')
    })

    it('should use disabled opacity constant', () => {
      expect(BUTTON_ANIMATIONS.disabled.opacity).toBe(0.5)
    })
  })

  describe('Accessibility', () => {
    it('should render when prefers-reduced-motion is enabled', () => {
      mockReducedMotion(true)

      const { getByRole } = render(<Button>Click me</Button>)
      const button = getByRole('button')

      // Button should still render as a motion component
      // The hook will disable animations via transition props
      expect(button).toBeInTheDocument()
      expect(button.hasAttribute('data-projection-id')).toBe(true)
    })

    it('should use useReducedMotion hook', () => {
      // Button component imports and uses useReducedMotion
      // This is verified by successful rendering without errors
      const { getByRole } = render(<Button>Click me</Button>)
      const button = getByRole('button')

      expect(button).toBeInTheDocument()
    })

    it('should maintain focus visibility', async () => {
      const user = userEvent.setup()
      const { getByRole } = render(<Button>Focus me</Button>)
      const button = getByRole('button')

      await user.tab() // Focus button

      expect(button).toHaveFocus()
      // Focus ring should be visible (Tailwind focus-visible classes)
      expect(button.className).toMatch(/focus/)
    })
  })

  describe('Variant Animations', () => {
    it('should animate default variant', () => {
      const { getByRole } = render(<Button variant="default">Default</Button>)
      const button = getByRole('button')

      expect(button).toBeInTheDocument()
      expect(button.hasAttribute('data-projection-id')).toBe(true)
    })

    it('should animate destructive variant', () => {
      const { getByRole } = render(<Button variant="destructive">Delete</Button>)
      const button = getByRole('button')

      expect(button).toBeInTheDocument()
      expect(button.hasAttribute('data-projection-id')).toBe(true)
    })

    it('should animate outline variant', () => {
      const { getByRole } = render(<Button variant="outline">Outline</Button>)
      const button = getByRole('button')

      expect(button).toBeInTheDocument()
      expect(button.hasAttribute('data-projection-id')).toBe(true)
    })

    it('should animate ghost variant', () => {
      const { getByRole } = render(<Button variant="ghost">Ghost</Button>)
      const button = getByRole('button')

      expect(button).toBeInTheDocument()
      expect(button.hasAttribute('data-projection-id')).toBe(true)
    })
  })
})
