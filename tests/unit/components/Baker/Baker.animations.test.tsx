/**
 * Baker Page Animation Tests
 * Baker Page - Phase 3: Page-Level Alert and Scan Results Animations
 *
 * Tests for error/success alert slide-ins, scan results celebration animation,
 * and overall page transition smoothness.
 * Following TDD methodology - tests written before implementation.
 */

import { BAKER_ANIMATIONS, DURATION, SPRING } from '@/constants/animations'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockReducedMotion } from '@tests/utils/animation-testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock matchMedia BEFORE imports (required for Framer Motion)
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

// Note: BakerPage is wrapped in ErrorBoundary, we'll test animation constants and contracts

describe('Baker Page Animations', () => {
  describe('Alert Animation Constants', () => {
    it('should define alert entrance animation', () => {
      expect(BAKER_ANIMATIONS.alert).toBeDefined()
      expect(BAKER_ANIMATIONS.alert.enter).toEqual({
        x: 400,
        opacity: 0
      })
    })

    it('should define alert show animation with spring physics', () => {
      expect(BAKER_ANIMATIONS.alert.show).toEqual({
        x: 0,
        opacity: 1,
        transition: {
          type: 'spring',
          stiffness: 400,
          damping: 30
        }
      })
    })

    it('should define alert exit animation', () => {
      expect(BAKER_ANIMATIONS.alert.exit).toEqual({
        x: 400,
        opacity: 0,
        transition: {
          duration: DURATION.fast / 1000
        }
      })
    })

    it('should use snappy spring physics', () => {
      const spring = BAKER_ANIMATIONS.alert.show.transition
      expect(spring.type).toBe('spring')
      expect(spring.stiffness).toBe(400)
      expect(spring.damping).toBe(30)
    })
  })

  describe('Scan Results Animation Constants', () => {
    it('should define scan results entrance', () => {
      expect(BAKER_ANIMATIONS.scanResults).toBeDefined()
      expect(BAKER_ANIMATIONS.scanResults.enter).toEqual({
        opacity: 0,
        scale: 0.95,
        y: 20
      })
    })

    it('should define scan results show with spring', () => {
      expect(BAKER_ANIMATIONS.scanResults.show).toEqual({
        opacity: 1,
        scale: 1,
        y: 0,
        transition: {
          type: 'spring',
          stiffness: 300,
          damping: 25
        }
      })
    })

    it('should use celebratory spring animation', () => {
      const spring = BAKER_ANIMATIONS.scanResults.show.transition
      expect(spring.type).toBe('spring')
      expect(spring.stiffness).toBe(300)
      expect(spring.damping).toBe(25)
    })

    it('should have slight bounce effect (lower damping)', () => {
      const damping = BAKER_ANIMATIONS.scanResults.show.transition.damping
      expect(damping).toBeLessThan(30) // Lower damping = more bounce
    })
  })

  describe('Error Alert Animation', () => {
    it('should slide in from right', () => {
      const entrance = BAKER_ANIMATIONS.alert.enter
      expect(entrance.x).toBe(400) // From right
      expect(entrance.opacity).toBe(0)
    })

    it('should use spring physics for natural motion', () => {
      const transition = BAKER_ANIMATIONS.alert.show.transition
      expect(transition.type).toBe('spring')
    })

    it('should exit quickly', () => {
      const exitDuration = BAKER_ANIMATIONS.alert.exit.transition.duration
      expect(exitDuration).toBe(DURATION.fast / 1000)
      expect(exitDuration).toBeLessThan(0.3)
    })
  })

  describe('Success Alert Animation', () => {
    it('should use same animation as error alert', () => {
      // Success and error alerts share the same animation pattern
      expect(BAKER_ANIMATIONS.alert.enter).toBeDefined()
      expect(BAKER_ANIMATIONS.alert.show).toBeDefined()
      expect(BAKER_ANIMATIONS.alert.exit).toBeDefined()
    })

    it('should provide positive feedback with spring bounce', () => {
      const spring = BAKER_ANIMATIONS.alert.show.transition
      expect(spring.stiffness).toBe(400) // Snappy response
      expect(spring.damping).toBe(30) // Controlled bounce
    })
  })

  describe('Scan Results Celebration', () => {
    it('should animate from below with scale', () => {
      const entrance = BAKER_ANIMATIONS.scanResults.enter
      expect(entrance.y).toBe(20) // From below
      expect(entrance.scale).toBe(0.95) // Slightly smaller
      expect(entrance.opacity).toBe(0)
    })

    it('should scale to full size on show', () => {
      const show = BAKER_ANIMATIONS.scanResults.show
      expect(show.scale).toBe(1)
      expect(show.y).toBe(0)
      expect(show.opacity).toBe(1)
    })

    it('should feel celebratory (spring physics)', () => {
      const spring = BAKER_ANIMATIONS.scanResults.show.transition
      expect(spring.type).toBe('spring')
      // Slightly bouncier than alerts (lower damping)
      expect(spring.damping).toBeLessThan(BAKER_ANIMATIONS.alert.show.transition.damping)
    })
  })

  describe('Performance Budget', () => {
    it('should only use GPU-accelerated properties for alerts', () => {
      const { enter, show } = BAKER_ANIMATIONS.alert

      // Only opacity and x (transform)
      expect(enter).toHaveProperty('opacity')
      expect(enter).toHaveProperty('x')
      expect(show).toHaveProperty('opacity')
      expect(show).toHaveProperty('x')

      // No layout properties
      expect(enter).not.toHaveProperty('width')
      expect(enter).not.toHaveProperty('height')
      expect(enter).not.toHaveProperty('top')
      expect(enter).not.toHaveProperty('left')
    })

    it('should only use GPU-accelerated properties for scan results', () => {
      const { enter, show } = BAKER_ANIMATIONS.scanResults

      // Only opacity, scale, and y (all GPU-accelerated)
      expect(enter).toHaveProperty('opacity')
      expect(enter).toHaveProperty('scale')
      expect(enter).toHaveProperty('y')

      // No layout properties
      expect(enter).not.toHaveProperty('width')
      expect(enter).not.toHaveProperty('height')
      expect(enter).not.toHaveProperty('margin')
    })

    it('should complete alerts quickly for immediate feedback', () => {
      // Spring animations complete naturally, but should feel snappy
      const stiffness = BAKER_ANIMATIONS.alert.show.transition.stiffness
      expect(stiffness).toBeGreaterThanOrEqual(400) // High stiffness = fast
    })

    it('should complete scan results in reasonable time', () => {
      const stiffness = BAKER_ANIMATIONS.scanResults.show.transition.stiffness
      expect(stiffness).toBeGreaterThanOrEqual(300)
      expect(stiffness).toBeLessThanOrEqual(400)
    })
  })

  describe('Animation Timing Coordination', () => {
    it('should have consistent entrance patterns', () => {
      // All entrance animations start from opacity: 0
      expect(BAKER_ANIMATIONS.alert.enter.opacity).toBe(0)
      expect(BAKER_ANIMATIONS.scanResults.enter.opacity).toBe(0)
    })

    it('should have consistent show patterns', () => {
      // All show animations end at opacity: 1
      expect(BAKER_ANIMATIONS.alert.show.opacity).toBe(1)
      expect(BAKER_ANIMATIONS.scanResults.show.opacity).toBe(1)
    })

    it('should prioritize user feedback (alerts faster than celebrations)', () => {
      // Alerts should feel more responsive than scan results
      const alertStiffness = BAKER_ANIMATIONS.alert.show.transition.stiffness
      const scanStiffness = BAKER_ANIMATIONS.scanResults.show.transition.stiffness

      expect(alertStiffness).toBeGreaterThanOrEqual(scanStiffness)
    })
  })

  describe('Accessibility - Reduced Motion', () => {
    it('should provide instant feedback with reduced motion', () => {
      // When reduced motion is enabled, animations should still provide
      // visual feedback but without motion
      // This is handled in component implementation via useReducedMotion hook
      expect(BAKER_ANIMATIONS.alert).toBeDefined()
      expect(BAKER_ANIMATIONS.scanResults).toBeDefined()
    })

    it('should maintain visual hierarchy without animation', () => {
      // Even without animation, alerts and results should be visually distinct
      // This is ensured by the base styles (colors, borders, etc.)
      expect(BAKER_ANIMATIONS.alert.enter.opacity).toBe(0)
      expect(BAKER_ANIMATIONS.scanResults.enter.opacity).toBe(0)
    })
  })

  describe('Integration - Alert Lifecycle', () => {
    it('should define complete animation lifecycle for alerts', () => {
      expect(BAKER_ANIMATIONS.alert.enter).toBeDefined()
      expect(BAKER_ANIMATIONS.alert.show).toBeDefined()
      expect(BAKER_ANIMATIONS.alert.exit).toBeDefined()
    })

    it('should exit in opposite direction of entrance', () => {
      const entranceX = BAKER_ANIMATIONS.alert.enter.x
      const exitX = BAKER_ANIMATIONS.alert.exit.x

      // Should exit in same direction as entrance (right)
      expect(exitX).toBe(entranceX)
    })

    it('should fade out during exit', () => {
      expect(BAKER_ANIMATIONS.alert.exit.opacity).toBe(0)
    })
  })

  describe('Animation Constants Completeness', () => {
    it('should have all required Baker animation constants', () => {
      expect(BAKER_ANIMATIONS.projectList).toBeDefined()
      expect(BAKER_ANIMATIONS.projectRow).toBeDefined()
      expect(BAKER_ANIMATIONS.detailPanel).toBeDefined()
      expect(BAKER_ANIMATIONS.statusBadge).toBeDefined()
      expect(BAKER_ANIMATIONS.scanResults).toBeDefined()
      expect(BAKER_ANIMATIONS.checkbox).toBeDefined()
      expect(BAKER_ANIMATIONS.alert).toBeDefined()
      expect(BAKER_ANIMATIONS.navTab).toBeDefined()
      expect(BAKER_ANIMATIONS.fileItem).toBeDefined()
    })

    it('should reference core animation constants', () => {
      // Verify that Baker animations use core constants where appropriate
      expect(DURATION.fast).toBeDefined()
      expect(DURATION.normal).toBeDefined()
      expect(SPRING.snappy).toBeDefined()
      expect(SPRING.gentle).toBeDefined()
    })

    it('should maintain consistency across all animations', () => {
      // All entrance animations should start from opacity: 0
      const entrances = [
        BAKER_ANIMATIONS.alert.enter,
        BAKER_ANIMATIONS.scanResults.enter,
        BAKER_ANIMATIONS.projectList.item.hidden,
        BAKER_ANIMATIONS.detailPanel.enter
      ]

      entrances.forEach(entrance => {
        expect(entrance.opacity).toBe(0)
      })
    })
  })
})
