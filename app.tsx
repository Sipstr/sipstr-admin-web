"use client"

import { useState, useCallback } from "react"
import { LoginPage } from "./components/LoginPage"
import { DashboardLayout } from "./components/DashboardLayout"
import { apiService } from "./services/apiService"

export interface AdminSession {
  id: string
  email: string
  role: string
  token: string
}

export default function App() {
  const [session, setSession] = useState<AdminSession | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

const handleLogin = useCallback(async (email: string, password: string) => {
  setLoading(true)
  setError(null)

  // Dummy credentials for local testing (bypass backend)
  if (email === "admin" && password === "admin") {
    setSession({ id: "local-dev", email: "admin@sipstr.com", role: "ADMIN", token: "dummy-token" })
    setLoading(false)
    return
  }

  try {
    const response = await apiService.login(email, password)
    setSession(response)
  } catch (err: any) {
    // Log raw error for debugging (backend returned message is helpful)
    console.error("login error (raw):", err)

    // Normalize into a string we can inspect
    const raw = String(err?.message ?? err ?? "")
    const lower = raw.toLowerCase()

    // Try to parse JSON message bodies like '{"message":"Invalid credentials"}'
    let parsedMessage: string | null = null
    try {
      const maybe = JSON.parse(raw)
      if (maybe && (maybe.message || maybe.error || maybe.info)) {
        parsedMessage = String(maybe.message || maybe.error || maybe.info)
      }
    } catch {
      // not JSON — ignore
    }

    const combined = (parsedMessage ? parsedMessage + " " : "") + raw
    const combLower = combined.toLowerCase()

    // Patterns signalling wrong credentials
    const authPatterns = [
      "401", "unauthorized", "invalid", "invalid credentials", "badcredentials",
      "bad credentials", "bad credentials exception", "badcredentialsexception",
      "bad credentials", "bad credential"
    ]

    // Also check common error properties that some clients use
    const status =
      err?.status ?? err?.statusCode ?? err?.response?.status ?? err?.response?.statusCode

    const isAuthFailure =
      status === 401 ||
      authPatterns.some((p) => combLower.includes(p))

    const message = isAuthFailure
      ? "Please enter correct email and password."
      : "Failed to login. Please try again later."

    setError(message)
  } finally {
    setLoading(false)
  }
}, [])


  const handleLogout = useCallback(() => {
    apiService.logout()
    setSession(null)
    setError(null)
  }, [])

  if (!session) {
    return (
      <LoginPage
        onLogin={handleLogin}
        loading={loading}
        error={error}
      />
    )
  }

  return <DashboardLayout session={session} onLogout={handleLogout} />
}
