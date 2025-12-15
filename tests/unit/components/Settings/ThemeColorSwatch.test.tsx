/**
 * ThemeColorSwatch Component Tests
 *
 * Tests for the color preview swatch component.
 */

import { ThemeColorSwatch } from '@/components/Settings/ThemeColorSwatch'
import type { ThemeColorSwatch as ThemeColorSwatchType } from '@/constants/themes'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

describe('ThemeColorSwatch', () => {
  const mockColors: ThemeColorSwatchType = {
    background: '0 0% 100%',
    foreground: '224 71.4% 4.1%',
    primary: '220.9 39.3% 11%',
    accent: '220 14.3% 95.9%',
  }

  it('renders a swatch with 4 color bars', () => {
    const { container } = render(<ThemeColorSwatch colors={mockColors} />)

    const colorBars = container.querySelectorAll('div[title]')
    expect(colorBars.length).toBe(4)
  })

  it('applies correct HSL colors to each bar', () => {
    const { container } = render(<ThemeColorSwatch colors={mockColors} />)

    const backgroundBar = container.querySelector('[title="Background"]') as HTMLElement
    const foregroundBar = container.querySelector('[title="Foreground"]') as HTMLElement
    const primaryBar = container.querySelector('[title="Primary"]') as HTMLElement
    const accentBar = container.querySelector('[title="Accent"]') as HTMLElement

    // Verify background colors are set (browsers may convert HSL to RGB)
    expect(backgroundBar.style.backgroundColor).toBeTruthy()
    expect(foregroundBar.style.backgroundColor).toBeTruthy()
    expect(primaryBar.style.backgroundColor).toBeTruthy()
    expect(accentBar.style.backgroundColor).toBeTruthy()
  })

  it('has accessibility attributes', () => {
    const { container } = render(<ThemeColorSwatch colors={mockColors} />)

    const swatchContainer = container.querySelector('[role="presentation"]')
    expect(swatchContainer).toBeInTheDocument()
    expect(swatchContainer).toHaveAttribute('aria-hidden', 'true')
  })

  it('includes title attributes for each color bar', () => {
    const { container } = render(<ThemeColorSwatch colors={mockColors} />)

    expect(container.querySelector('[title="Background"]')).toBeInTheDocument()
    expect(container.querySelector('[title="Foreground"]')).toBeInTheDocument()
    expect(container.querySelector('[title="Primary"]')).toBeInTheDocument()
    expect(container.querySelector('[title="Accent"]')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(
      <ThemeColorSwatch colors={mockColors} className="custom-swatch" />
    )

    expect(container.querySelector('.custom-swatch')).toBeInTheDocument()
  })

  it('has correct default height (24px)', () => {
    const { container } = render(<ThemeColorSwatch colors={mockColors} />)

    const swatchContainer = container.querySelector('[role="presentation"]')
    expect(swatchContainer).toHaveClass('h-6') // 24px
  })

  it('has rounded corners and border', () => {
    const { container } = render(<ThemeColorSwatch colors={mockColors} />)

    const swatchContainer = container.querySelector('[role="presentation"]')
    expect(swatchContainer).toHaveClass('rounded')
    expect(swatchContainer).toHaveClass('border')
  })
})
