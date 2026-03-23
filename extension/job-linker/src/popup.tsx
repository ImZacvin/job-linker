import React, { useEffect, useState } from "react"

import Dashboard from "~components/Dashboard"
import LoginForm from "~components/LoginForm"
import { verifyToken } from "~lib/api"

import "./popup.css"

type AuthState = "loading" | "authenticated" | "unauthenticated"

function IndexPopup() {
  const [authState, setAuthState] = useState<AuthState>("loading")

  useEffect(() => {
    checkAuth()
  }, [])

  async function checkAuth() {
    const valid = await verifyToken()
    setAuthState(valid ? "authenticated" : "unauthenticated")
  }

  if (authState === "loading") {
    return (
      <div className="popup-container">
        <div className="loading">Checking authentication...</div>
      </div>
    )
  }

  return (
    <div className="popup-container">
      <header className="popup-header">
        <h1>Job Linker</h1>
      </header>

      {authState === "authenticated" ? (
        <Dashboard onAuthError={() => setAuthState("unauthenticated")} />
      ) : (
        <LoginForm onSuccess={() => setAuthState("authenticated")} />
      )}
    </div>
  )
}

export default IndexPopup
