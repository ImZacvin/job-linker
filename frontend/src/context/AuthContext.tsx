import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

import { clearTokens, login as apiLogin, register as apiRegister, verifyToken } from "@/lib/api"

interface User {
  id: number
  email: string
  full_name: string
  role: string
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, fullName: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    verifyToken()
      .then((u) => setUser(u))
      .finally(() => setLoading(false))
  }, [])

  async function login(email: string, password: string) {
    const u = await apiLogin(email, password)
    setUser(u)
  }

  async function register(email: string, password: string, fullName: string) {
    const u = await apiRegister(email, password, fullName)
    setUser(u)
  }

  function logout() {
    clearTokens()
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
