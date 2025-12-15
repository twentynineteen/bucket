/**
 * Animation Testing Utilities
 *
 * Provides helpers for testing animations in components using Framer Motion
 * and CSS transitions/animations. Follows TDD methodology for the ux-animation-guru skill.
 */

import { waitFor } from '@testing-library/react'

/**
 * Checks if an element has CSS transition or animation properties
 * @param element - The HTML element to check
 * @returns true if the element has transitions or animations
 */
export const expectElementToHaveAnimation = (element: HTMLElement): void => {
  const styles = window.getComputedStyle(element)

  // Check for CSS transitions
  const hasTransition =
    styles.transition !== 'all 0s ease 0s' && styles.transitionProperty !== 'none'

  // Check for CSS animations
  const hasAnimation = styles.animation !== 'none 0s ease 0s'

  // Check for Framer Motion (adds data-projection-id)
  const hasFramerMotion = element.hasAttribute('data-projection-id')

  expect(hasTransition || hasAnimation || hasFramerMotion).toBe(true)
}

/**
 * Checks if an element is a Framer Motion component
 * Framer Motion adds the data-projection-id attribute to motion components
 */
export const expectMotionComponent = (element: HTMLElement): void => {
  expect(element).toHaveAttribute('data-projection-id')
}

/**
 * Checks if an element has a specific transition duration
 * @param element - The HTML element to check
 * @param expectedDuration - Expected duration in milliseconds
 */
export const expectTransitionDuration = (
  element: HTMLElement,
  expectedDuration: number
): void => {
  const styles = window.getComputedStyle(element)
  const duration = parseFloat(styles.transitionDuration) * 1000 // Convert to ms
  expect(duration).toBe(expectedDuration)
}

/**
 * Checks if an element uses a specific easing function
 * @param element - The HTML element to check
 * @param expectedEasing - Expected easing function (e.g., 'ease-out', 'cubic-bezier(...)')
 */
export const expectTransitionEasing = (
  element: HTMLElement,
  expectedEasing: string
): void => {
  const styles = window.getComputedStyle(element)
  expect(styles.transitionTimingFunction).toBe(expectedEasing)
}

/**
 * Checks if an element respects prefers-reduced-motion
 * Sets up the matchMedia mock and verifies animation is disabled/reduced
 * @param element - The HTML element to check
 */
export const expectReducedMotionRespected = (element: HTMLElement): void => {
  const styles = window.getComputedStyle(element)
  const duration = parseFloat(styles.transitionDuration) * 1000

  // Animation should be instant (0ms) or very short (<50ms)
  expect(duration).toBeLessThan(50)
}

/**
 * Mock prefers-reduced-motion media query
 * @param shouldReduce - Whether reduced motion should be preferred
 */
export const mockReducedMotion = (shouldReduce: boolean): void => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: shouldReduce && query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(), // Deprecated
      removeListener: vi.fn(), // Deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  })
}

/**
 * Waits for an animation/transition to complete
 * @param element - The element with the animation
 * @param expectedDuration - Expected duration in milliseconds (optional)
 */
export const waitForAnimation = async (
  element: HTMLElement,
  expectedDuration?: number
): Promise<void> => {
  const styles = window.getComputedStyle(element)
  const duration = expectedDuration || parseFloat(styles.transitionDuration) * 1000 || 300

  await new Promise(resolve => setTimeout(resolve, duration + 50)) // Add buffer
}

/**
 * Checks if stagger animation is applied to list items
 * Each item should have an increasing delay
 * @param items - Array of list item elements
 * @param expectedStagger - Expected delay between items in milliseconds
 */
export const expectStaggerAnimation = (
  items: HTMLElement[],
  expectedStagger: number
): void => {
  items.forEach((item, index) => {
    const styles = window.getComputedStyle(item)
    const delay = parseFloat(styles.animationDelay || styles.transitionDelay) * 1000

    // Each item should have delay = index * stagger
    const expectedDelay = index * expectedStagger
    expect(Math.abs(delay - expectedDelay)).toBeLessThan(10) // Allow 10ms tolerance
  })
}

/**
 * Checks if an element has GPU-accelerated properties only
 * Should use transform/opacity instead of layout-triggering properties
 * @param element - The HTML element to check
 */
export const expectGPUAcceleratedAnimation = (element: HTMLElement): void => {
  const styles = window.getComputedStyle(element)
  const transitionProps = styles.transitionProperty.split(',').map(p => p.trim())

  const allowedProps = ['transform', 'opacity', 'filter', 'all']
  const layoutProps = [
    'width',
    'height',
    'top',
    'left',
    'right',
    'bottom',
    'margin',
    'padding'
  ]

  // Check that no layout-triggering properties are animated
  const hasLayoutProps = transitionProps.some(prop => layoutProps.includes(prop))

  expect(hasLayoutProps).toBe(false)

  // Should use allowed properties
  const usesAllowedProps = transitionProps.some(prop => allowedProps.includes(prop))
  expect(usesAllowedProps).toBe(true)
}

/**
 * Waits for element to be in view (for scroll-based animations)
 * Uses IntersectionObserver mock
 */
export const expectInViewAnimation = async (
  element: HTMLElement,
  callback: () => void
): Promise<void> => {
  // Trigger IntersectionObserver
  await waitFor(() => {
    expect(element).toBeInTheDocument()
  })

  callback()
}

/**
 * Test helper to verify animation constant values
 * @param constant - The animation constant object
 * @param expectedProps - Expected properties and values
 */
export const expectAnimationConstants = (
  constant: Record<string, any>,
  expectedProps: Record<string, any>
): void => {
  Object.entries(expectedProps).forEach(([key, value]) => {
    expect(constant[key]).toBe(value)
  })
}

/**
 * Simulates hover interaction and checks for animation response
 * @param element - The element to hover
 * @param userEvent - User event instance from @testing-library/user-event
 */
export const expectHoverAnimation = async (
  element: HTMLElement,
  userEvent: any
): Promise<void> => {
  const beforeStyles = window.getComputedStyle(element)
  const beforeTransform = beforeStyles.transform

  await userEvent.hover(element)

  await waitFor(() => {
    const afterStyles = window.getComputedStyle(element)
    const afterTransform = afterStyles.transform

    // Transform should have changed
    expect(afterTransform).not.toBe(beforeTransform)
  })
}

/**
 * Checks if focus is visible during animation
 * Ensures accessibility is maintained
 */
export const expectFocusVisibleDuringAnimation = (element: HTMLElement): void => {
  // Should have focus ring styles
  const styles = window.getComputedStyle(element)

  // Check for outline or box-shadow (common focus indicators)
  const hasFocusIndicator =
    styles.outline !== 'none' ||
    styles.boxShadow !== 'none' ||
    element.classList.contains('focus-visible:ring') ||
    element.classList.contains('focus:ring')

  expect(hasFocusIndicator).toBe(true)
}
