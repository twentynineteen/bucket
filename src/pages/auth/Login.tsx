import { useAuth } from '@hooks/useAuth'
import { createNamespacedLogger } from '@utils/logger'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'

const logger = createNamespacedLogger('Login')

const loginSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters')
})

const Login: React.FC = () => {
  const { login, isAuthenticated } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate() // To navigate after login

  const handleLogin = async () => {
    setError(null) // Clear previous errors

    if (!username || !password) {
      setError('Please enter both username and password')
      return
    }

    try {
      logger.log('Validating creds.')
      loginSchema.parse({ username, password })
      const fakeToken = `token_${username}` // Simulating a token
      await login(fakeToken, username)
      navigate('/') // Navigate to home after successful login
    } catch {
      setError('Invalid username or password format')
    }
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col rounded-xl bg-white p-6 shadow-md">
      <h2 className="mb-4 text-xl font-semibold">Login</h2>
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
        onClick={handleLogin}
        className="bg-primary text-primary-foreground hover:bg-primary/90 w-full rounded p-2"
      >
        Login
      </button>
      <p className="mt-3">
        No account? click{' '}
        <Link to="/register" className="text-primary font-bold">
          here
        </Link>{' '}
        to register
      </p>
      {isAuthenticated ? <p>authenticated!</p> : <p>not authenticated</p>}
    </div>
  )
}

export default Login
