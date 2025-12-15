/**
 * Shared framer-motion mock for all tests
 * Import this at the top of any test file that uses components with framer-motion
 */
import React from 'react'
import { vi } from 'vitest'

export const setupFramerMotionMock = () => {
  vi.mock('framer-motion', () => ({
    motion: new Proxy(
      {},
      {
        get: (_, prop) => {
          const Component = React.forwardRef<any, any>((props, ref) => {
            const { children, ...rest } = props
            return React.createElement(prop as string, { ...rest, ref }, children)
          })
          Component.displayName = `motion.${String(prop)}`
          return Component
        }
      }
    ),
    AnimatePresence: ({ children }: any) => children
  }))
}
