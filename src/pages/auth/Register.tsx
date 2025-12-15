import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'

import { logger } from '@/utils/logger'

const registerSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters')
})

export default function Register() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate() // Get the navigation function

  async function handleRegister() {
    setError(null) // Clear previous errors

    // Validate user input
    const result = registerSchema.safeParse({ username, password })
    if (!result.success) {
      setError(result.error.errors[0].message) // Show validation error
      return
    }

    try {
      // Check if user already exists
      const existingUser = localStorage.getItem(`user_${username}`)
      if (existingUser) {
        setError('Username already taken.')
        return
      }

      // Store user credentials in localStorage (simple approach, not secure)
      const userData = JSON.stringify({ username, password })
      localStorage.setItem(`user_${username}`, userData)

      // Redirect to login page after successful registration
      navigate('/login')
    } catch (err) {
      logger.error('Registration failed:', err)
      setError('An error occurred while registering. Please try again.')
    }
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col rounded-xl bg-white p-6 shadow-md">
      <h2 className="mb-4 text-xl font-semibold">Register</h2>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <input
        type="text"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        className="mb-2 w-full rounded border p-2"
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="mb-2 w-full rounded border p-2"
      />
      <button
        onClick={handleRegister}
        className="bg-primary text-primary-foreground hover:bg-primary/90 w-full rounded p-2"
      >
        Register
      </button>
      <p className="mt-3">
        Registered? Click{' '}
        <Link to="/login" className="text-primary font-bold">
          here
        </Link>{' '}
        to log in.
      </p>
    </div>
  )
}
