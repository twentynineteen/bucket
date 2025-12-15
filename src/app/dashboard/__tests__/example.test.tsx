// src/__tests__/example.test.tsx
import { render } from '@testing-library/react'
import React from 'react'
import { vi } from 'vitest'

// Mock next-themes before importing App to avoid matchMedia errors
vi.mock('next-themes', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
  useTheme: () => ({
    theme: 'light',
    setTheme: vi.fn(),
    themes: ['light', 'dark']
  })
}))

import App from '../../../App'

it('renders without crashing', () => {
  const div = document.createElement('div') // Create a new div element for the container

  // Append the custom container to body
  document.body.appendChild(div)

  // Render the App component within the created container
  const { unmount } = render(<App />, { container: div })

  // Perform tests or assertions here...

  // Clean up after test by removing the container from body and freeing up memory
  unmount()
})
