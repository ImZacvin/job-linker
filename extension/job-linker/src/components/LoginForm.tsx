import React, { useState, type FormEvent } from "react"

import { API_BASE_URL } from "~config"
import { setTokens } from "~lib/api"

interface LoginFormProps {
  onSuccess: () => void
}

export default function LoginForm({ onSuccess }: LoginFormProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      })

      if (!res.ok) {
        const { error } = await res.json()
        throw new Error(error || "Login failed")
      }

      const { data } = await res.json()
      await setTokens({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken
      })
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-form">
      <div className="login-icon">🔒</div>
      <h2>Sign In</h2>
      <p>Login to access your saved jobs</p>

      <form onSubmit={handleSubmit}>
        {error && <div className="login-error">{error}</div>}
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>

      <p className="login-hint">
        Don't have an account?{" "}
        <a href="http://localhost:5173/register" target="_blank" rel="noopener noreferrer">
          Register on web app
        </a>
      </p>
    </div>
  )
}
