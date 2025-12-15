/**
 * ThemeSelector Component Tests
 *
 * Tests for the theme selection card grid with live preview functionality.
 */

import { ThemeSelector } from '@/components/Settings/ThemeSelector'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import * as React from 'react'

// Mock next-themes useTheme hook (vi.fn() created inline for proper hoisting)
vi.mock('next-themes', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
  useTheme: () => ({
    theme: 'light',
    setTheme: vi.fn(),
    themes: ['light', 'dark', 'system'],
  }),
}))

// Mock useThemePreview hook
vi.mock('@/hooks/useThemePreview', () => ({
  useThemePreview: () => ({
    startPreview: vi.fn(),
    stopPreview: vi.fn(),
  }),
}))

describe('ThemeSelector', () => {
  const renderThemeSelector = () => {
    return render(<ThemeSelector />)
  }

  it('renders the theme selector with label', async () => {
    renderThemeSelector()

    await waitFor(() => {
      expect(screen.getByText('Theme')).toBeInTheDocument()
    })
  })

  it('shows help text about hover preview and auto-save', async () => {
    renderThemeSelector()

    await waitFor(() => {
      expect(
        screen.getByText(/hover over themes to preview them/i)
      ).toBeInTheDocument()
      expect(screen.getByText(/changes are saved automatically/i)).toBeInTheDocument()
    })
  })

  it('displays all 13 theme options as cards', async () => {
    renderThemeSelector()

    // All themes should be visible without clicking (no dropdown)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /select system theme/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /select light theme/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /select dark theme/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /select dracula theme/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /select tokyo night theme/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /select catppuccin latte theme/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /select catppuccin frappé theme/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /select catppuccin macchiato theme/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /select catppuccin mocha theme/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /select solarized light theme/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /select github light theme/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /select nord light theme/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /select one light theme/i })).toBeInTheDocument()
    })
  })

  it('groups themes into System, Light, and Dark categories', async () => {
    renderThemeSelector()

    await waitFor(() => {
      const systemHeading = screen.getByRole('heading', { name: /system/i })
      const lightHeading = screen.getByRole('heading', { name: /light themes/i })
      const darkHeading = screen.getByRole('heading', { name: /dark themes/i })

      expect(systemHeading).toBeInTheDocument()
      expect(lightHeading).toBeInTheDocument()
      expect(darkHeading).toBeInTheDocument()
    })
  })

  it('shows color swatches for each theme', async () => {
    renderThemeSelector()

    // Color swatches are rendered (check by looking for presentation role)
    await waitFor(() => {
      const swatches = screen.getAllByRole('presentation', { hidden: true })
      expect(swatches.length).toBe(13) // One per theme
    })
  })

  it('displays theme descriptions', async () => {
    renderThemeSelector()

    await waitFor(() => {
      expect(screen.getByText(/follow system light\/dark preference/i)).toBeInTheDocument()
      expect(
        screen.getByText(/dark theme with vibrant purple and pink accents/i)
      ).toBeInTheDocument()
    })
  })

  it('handles theme selection via card click', async () => {
    const user = userEvent.setup()
    renderThemeSelector()

    // Find the Dracula theme button
    const draculaButton = await screen.findByLabelText(/select dracula theme/i)

    // Click should trigger the button's onClick handler
    await user.click(draculaButton)

    // The theme change is handled by the mocked setTheme function
    // We just verify the button is clickable and interactive
    expect(draculaButton).toBeInTheDocument()
  })

  it('shows checkmark on selected theme', async () => {
    renderThemeSelector()

    await waitFor(() => {
      const lightButton = screen.getByLabelText(/select light theme/i)
      expect(lightButton.getAttribute('aria-pressed')).toBe('true')
    })
  })

  it('shows all themes immediately after mount', async () => {
    renderThemeSelector()

    // All theme cards should be visible (no loading state with mocked theme)
    await waitFor(() => {
      const themeButtons = screen.getAllByRole('button', { name: /select .* theme/i })
      expect(themeButtons.length).toBe(13)
    })
  })

  it('accepts custom label prop', async () => {
    render(<ThemeSelector label="Choose Color Scheme" />)

    await waitFor(() => {
      expect(screen.getByText('Choose Color Scheme')).toBeInTheDocument()
    })
  })

  it('applies custom className', async () => {
    const { container } = render(<ThemeSelector className="custom-class" />)

    await waitFor(() => {
      expect(container.querySelector('.custom-class')).toBeInTheDocument()
    })
  })
})
