/**
 * Register form validation tests
 *
 * B1.1 - a username shorter than 3 characters shows the schema's message.
 * B1.2 - a password shorter than 6 characters shows the schema's message.
 * B1.3 - failed validation writes no user record and does not navigate.
 */

import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'

import Register from './Register'

const renderRegister = () =>
  render(
    <MemoryRouter initialEntries={['/register']}>
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<p>Login page</p>} />
      </Routes>
    </MemoryRouter>
  )

const submit = (username: string, password: string) => {
  fireEvent.change(screen.getByPlaceholderText('Username'), {
    target: { value: username }
  })
  fireEvent.change(screen.getByPlaceholderText('Password'), {
    target: { value: password }
  })
  fireEvent.click(screen.getByRole('button', { name: 'Register' }))
}

describe('Register validation messages (B1)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('shows the username rule when the username is too short (B1.1)', async () => {
    renderRegister()

    submit('ab', 'longenough')

    expect(
      await screen.findByText('Username must be at least 3 characters')
    ).toBeInTheDocument()
  })

  it('shows the password rule when the password is too short (B1.2)', async () => {
    renderRegister()

    submit('validuser', 'short')

    expect(
      await screen.findByText('Password must be at least 6 characters')
    ).toBeInTheDocument()
  })

  it('writes no user record and does not navigate when validation fails (B1.3)', async () => {
    renderRegister()

    submit('ab', 'longenough')

    await screen.findByText('Username must be at least 3 characters')
    expect(localStorage.getItem('user_ab')).toBeNull()
    expect(screen.queryByText('Login page')).not.toBeInTheDocument()
  })
})
