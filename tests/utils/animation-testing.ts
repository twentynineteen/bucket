/**
 * Animation Testing Utilities
 *
 * Provides the `mockReducedMotion` helper used by component tests that render
 * Framer Motion elements. The original 13-export module was reduced to this
 * single helper under issue #236: the other twelve had zero consumers after
 * #219 and #233 removed the animation-constants test blocks that used them.
 */

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
