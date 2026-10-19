"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"

import {
  authApi,
  refreshSession,
  setSessionExpiredHandler,
  type AuthUser,
} from "@/lib/api"

type AuthStatus = "loading" | "authenticated" | "unauthenticated"

interface AuthContextValue {
  user: AuthUser | null
  status: AuthStatus
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [status, setStatus] = useState<AuthStatus>("loading")

  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser(null)
      setStatus("unauthenticated")
    })
    // Restore the session from the refresh cookie on page load
    refreshSession().then((session) => {
      setUser(session?.user ?? null)
      setStatus(session ? "authenticated" : "unauthenticated")
    })
    return () => setSessionExpiredHandler(null)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const session = await authApi.login(email, password)
    setUser(session.user)
    setStatus("authenticated")
  }, [])

  const logout = useCallback(async () => {
    await authApi.logout()
    setUser(null)
    setStatus("unauthenticated")
  }, [])

  return (
    <AuthContext.Provider value={{ user, status, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>")
  return ctx
}
