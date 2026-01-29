import { CreateProjectStep } from '@/pages/BuildProject/CreateProjectStep'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

describe('CreateProjectStep', () => {
  const mockOnCreateProject = vi.fn()

  const defaultProps = {
    showSuccess: false,
    title: 'Test Project',
    selectedFolder: '/path/to/folder',
    onCreateProject: mockOnCreateProject
  }

  it('renders the create project button when not showing success', () => {
    render(<CreateProjectStep {...defaultProps} />)

    expect(screen.getByRole('button', { name: /create project/i })).toBeInTheDocument()
  })

  it('does not render the button when showing success', () => {
    render(<CreateProjectStep {...defaultProps} showSuccess={true} />)

    expect(screen.queryByRole('button', { name: /create project/i })).not.toBeInTheDocument()
  })

  it('disables the button when title is empty', () => {
    render(<CreateProjectStep {...defaultProps} title="" />)

    const button = screen.getByRole('button', { name: /create project/i })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('title', 'Please enter a project title and select a folder')
  })

  it('disables the button when folder is not selected', () => {
    render(<CreateProjectStep {...defaultProps} selectedFolder="" />)

    const button = screen.getByRole('button', { name: /create project/i })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('title', 'Please enter a project title and select a folder')
  })

  it('disables the button when loading', () => {
    render(<CreateProjectStep {...defaultProps} isLoading={true} />)

    const button = screen.getByRole('button', { name: /creating project/i })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('title', 'Project creation in progress...')
  })

  it('shows "Creating Project..." text when loading', () => {
    render(<CreateProjectStep {...defaultProps} isLoading={true} />)

    expect(screen.getByText('Creating Project...')).toBeInTheDocument()
  })

  it('shows "Create Project" text when not loading', () => {
    render(<CreateProjectStep {...defaultProps} isLoading={false} />)

    const button = screen.getByRole('button', { name: /create project/i })
    expect(button).toHaveTextContent('Create Project')
  })

  it('enables the button when title and folder are provided and not loading', () => {
    render(<CreateProjectStep {...defaultProps} isLoading={false} />)

    const button = screen.getByRole('button', { name: /create project/i })
    expect(button).not.toBeDisabled()
  })

  it('calls onCreateProject when button is clicked', async () => {
    const user = userEvent.setup()
    render(<CreateProjectStep {...defaultProps} />)

    const button = screen.getByRole('button', { name: /create project/i })
    await user.click(button)

    expect(mockOnCreateProject).toHaveBeenCalledTimes(1)
  })

  it('prevents multiple clicks when loading', async () => {
    const user = userEvent.setup()
    render(<CreateProjectStep {...defaultProps} isLoading={true} />)

    const button = screen.getByRole('button', { name: /creating project/i })

    // Button should be disabled, so click should not fire
    await user.click(button)

    expect(mockOnCreateProject).not.toHaveBeenCalled()
  })

  it('has correct accessibility attributes when disabled', () => {
    render(<CreateProjectStep {...defaultProps} title="" />)

    const button = screen.getByRole('button', { name: /create project/i })
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).toHaveAttribute('aria-describedby', 'create-btn-requirements')
  })

  it('has correct accessibility description when loading', () => {
    render(<CreateProjectStep {...defaultProps} isLoading={true} />)

    const description = screen.getByText('Project creation in progress')
    expect(description).toBeInTheDocument()
    expect(description).toHaveClass('sr-only')
  })
})
