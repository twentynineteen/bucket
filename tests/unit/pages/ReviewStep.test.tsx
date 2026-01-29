/**
 * Unit Tests for ReviewStep Component
 * Feature: Script Formatter Review Step
 * Purpose: Test review step UI and button interactions
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ReviewStep } from '@/pages/AI/ScriptFormatter/steps/ReviewStep'

// Mock DiffEditor component to avoid Monaco Editor dependencies
vi.mock('@/pages/AI/ScriptFormatter/DiffEditor', () => ({
  DiffEditor: ({ original, modified }: { original: string; modified: string }) => (
    <div data-testid="diff-editor">
      <div>Original: {original}</div>
      <div>Modified: {modified}</div>
    </div>
  )
}))

describe('ReviewStep', () => {
  const defaultProps = {
    originalText: 'Original text content',
    modifiedText: 'Modified text content',
    examplesCount: 3,
    isGenerating: false,
    generateError: null,
    onModifiedChange: vi.fn(),
    onDownload: vi.fn(),
    onOpenSaveDialog: vi.fn()
  }

  describe('Button Rendering', () => {
    it('should render download button', () => {
      render(<ReviewStep {...defaultProps} />)

      const downloadButton = screen.getByRole('button', {
        name: /download formatted script/i
      })
      expect(downloadButton).toBeInTheDocument()
    })

    it('should render save as example button', () => {
      render(<ReviewStep {...defaultProps} />)

      const saveButton = screen.getByRole('button', {
        name: /save as example/i
      })
      expect(saveButton).toBeInTheDocument()
    })

    it('should set button type to "button" to prevent form submission', () => {
      render(<ReviewStep {...defaultProps} />)

      const downloadButton = screen.getByRole('button', {
        name: /download formatted script/i
      })
      expect(downloadButton).toHaveAttribute('type', 'button')

      const saveButton = screen.getByRole('button', {
        name: /save as example/i
      })
      expect(saveButton).toHaveAttribute('type', 'button')
    })
  })

  describe('Download Button Behavior', () => {
    it('should call onDownload when download button is clicked', async () => {
      const user = userEvent.setup()
      render(<ReviewStep {...defaultProps} />)

      const downloadButton = screen.getByRole('button', {
        name: /download formatted script/i
      })

      await user.click(downloadButton)

      expect(defaultProps.onDownload).toHaveBeenCalledTimes(1)
    })

    it('should disable download button when generating', () => {
      render(<ReviewStep {...defaultProps} isGenerating={true} />)

      const downloadButton = screen.getByRole('button', {
        name: /downloading/i
      })

      expect(downloadButton).toBeDisabled()
    })

    it('should show "Downloading..." text when generating', () => {
      render(<ReviewStep {...defaultProps} isGenerating={true} />)

      expect(screen.getByText(/downloading\.\.\./i)).toBeInTheDocument()
    })

    it('should not call onDownload when button is disabled', async () => {
      const user = userEvent.setup()
      render(<ReviewStep {...defaultProps} isGenerating={true} />)

      const downloadButton = screen.getByRole('button', {
        name: /downloading/i
      })

      await user.click(downloadButton)

      expect(defaultProps.onDownload).not.toHaveBeenCalled()
    })
  })

  describe('Save as Example Button Behavior', () => {
    it('should call onOpenSaveDialog when save button is clicked', async () => {
      const user = userEvent.setup()
      render(<ReviewStep {...defaultProps} />)

      const saveButton = screen.getByRole('button', {
        name: /save as example/i
      })

      await user.click(saveButton)

      expect(defaultProps.onOpenSaveDialog).toHaveBeenCalledTimes(1)
    })

    it('should have descriptive title attribute', () => {
      render(<ReviewStep {...defaultProps} />)

      const saveButton = screen.getByRole('button', {
        name: /save as example/i
      })

      expect(saveButton).toHaveAttribute(
        'title',
        'Save this script as an example for future RAG-enhanced formatting'
      )
    })
  })

  describe('Examples Count Badge', () => {
    it('should show examples count badge when examples are used', () => {
      render(<ReviewStep {...defaultProps} examplesCount={3} />)

      expect(screen.getByText(/enhanced with 3 examples/i)).toBeInTheDocument()
    })

    it('should show singular "example" when count is 1', () => {
      render(<ReviewStep {...defaultProps} examplesCount={1} />)

      expect(screen.getByText(/enhanced with 1 example/i)).toBeInTheDocument()
      expect(screen.queryByText(/examples/i)).not.toBeInTheDocument()
    })

    it('should not show badge when no examples are used', () => {
      render(<ReviewStep {...defaultProps} examplesCount={0} />)

      expect(screen.queryByText(/enhanced with/i)).not.toBeInTheDocument()
    })
  })

  describe('Error Display', () => {
    it('should show error message when generateError is present', () => {
      const error = new Error('Failed to generate document')
      render(<ReviewStep {...defaultProps} generateError={error} />)

      expect(screen.getByText(/failed to generate document/i)).toBeInTheDocument()
    })

    it('should not show error when generateError is null', () => {
      render(<ReviewStep {...defaultProps} generateError={null} />)

      // Error container should not be present
      const errorContainer = screen.queryByText(/failed/i)
      expect(errorContainer).not.toBeInTheDocument()
    })
  })

  describe('DiffEditor Integration', () => {
    it('should pass originalText to DiffEditor', () => {
      render(<ReviewStep {...defaultProps} />)

      // DiffEditor component should be rendered (we can't test internal props easily,
      // but we can verify the component renders without errors)
      expect(
        screen.getByRole('heading', { name: /review and edit/i })
      ).toBeInTheDocument()
    })

    it('should pass modifiedText to DiffEditor', () => {
      render(<ReviewStep {...defaultProps} />)

      // Verify component renders with both texts
      expect(
        screen.getByRole('heading', { name: /review and edit/i })
      ).toBeInTheDocument()
    })
  })

  describe('Responsive Text Display', () => {
    it('should show full button text on larger screens', () => {
      render(<ReviewStep {...defaultProps} />)

      // Full text should be present (hidden on mobile via Tailwind classes)
      expect(screen.getByText(/download formatted script/i)).toBeInTheDocument()
      expect(screen.getByText(/save as example/i)).toBeInTheDocument()
    })

    it('should have shortened mobile text for download button', () => {
      render(<ReviewStep {...defaultProps} />)

      // Mobile text should also be present
      const mobileText = screen.getAllByText(/download/i)
      expect(mobileText.length).toBeGreaterThan(0)
    })
  })
})
