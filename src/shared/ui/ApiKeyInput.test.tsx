import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ApiKeyInput from './ApiKeyInput'

describe('ApiKeyInput', () => {
  it('masks a secret until Show is pressed', async () => {
    render(
      <ApiKeyInput id="key" apiKey="secret-123" setApiKey={vi.fn()} onSave={vi.fn()} />
    )

    const input = screen.getByDisplayValue('secret-123')
    expect(input).toHaveAttribute('type', 'password')

    await userEvent.click(screen.getByRole('button', { name: 'Show' }))
    expect(input).toHaveAttribute('type', 'text')
  })

  it('shows a plain value as text with no Show toggle', () => {
    render(
      <ApiKeyInput
        id="url"
        inputType="text"
        apiKey="http://localhost:11434"
        setApiKey={vi.fn()}
        onSave={vi.fn()}
      />
    )

    expect(screen.getByDisplayValue('http://localhost:11434')).toHaveAttribute(
      'type',
      'text'
    )
    expect(screen.queryByRole('button', { name: 'Show' })).not.toBeInTheDocument()
  })
})
