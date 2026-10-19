export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:1680/api"

export interface AuthUser {
  id: number
  email: string
  name: string
  role: "ADMIN" | "USER"
}

interface TokenResponse {
  accessToken: string
  tokenType: "Bearer"
  expiresIn: number
  user: AuthUser
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public fieldErrors: Record<string, string> = {}
  ) {
    super(message)
  }
}

// The access token lives only in memory; the refresh token is an HttpOnly cookie
// the browser sends to /api/auth/* automatically (credentials: "include").
let accessToken: string | null = null
let refreshing: Promise<TokenResponse | null> | null = null
let onSessionExpired: (() => void) | null = null

/** Called by AuthProvider so it can sign the user out when a refresh fails mid-session. */
export function setSessionExpiredHandler(handler: (() => void) | null) {
  onSessionExpired = handler
}

async function send(path: string, init: RequestInit | undefined, withToken: boolean) {
  const headers = new Headers(init?.headers)
  if (init?.body) headers.set("Content-Type", "application/json")
  if (withToken && accessToken) headers.set("Authorization", `Bearer ${accessToken}`)
  try {
    return await fetch(`${API_URL}${path}`, {
      ...init,
      headers,
      credentials: "include",
      cache: "no-store",
    })
  } catch {
    throw new ApiError(
      `Cannot reach the API at ${API_URL}. Is the Spring Boot backend running?`,
      0
    )
  }
}

async function parse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(
      body.message ?? (res.status === 401 ? "Unauthorized" : res.statusText),
      res.status,
      body.errors
    )
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

/**
 * Exchanges the refresh cookie for a new access token. Concurrent callers share one
 * request, because the backend rotates the refresh token on every use.
 */
export function refreshSession(): Promise<TokenResponse | null> {
  refreshing ??= (async () => {
    try {
      const res = await send("/auth/refresh", { method: "POST" }, false)
      const data = res.ok ? ((await res.json()) as TokenResponse) : null
      accessToken = data?.accessToken ?? null
      return data
    } catch {
      accessToken = null
      return null
    } finally {
      refreshing = null
    }
  })()
  return refreshing
}

/** Authenticated JSON request; on 401 it refreshes the access token once and retries. */
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res = await send(path, init, true)
  if (res.status === 401) {
    if (await refreshSession()) {
      res = await send(path, init, true)
    } else {
      onSessionExpired?.()
    }
  }
  return parse<T>(res)
}

export const authApi = {
  async login(email: string, password: string) {
    const res = await send(
      "/auth/login",
      { method: "POST", body: JSON.stringify({ email, password }) },
      false
    )
    const data = await parse<TokenResponse>(res)
    accessToken = data.accessToken
    return data
  },

  async logout() {
    accessToken = null
    await send("/auth/logout", { method: "POST" }, false).catch(() => {})
  },

  me: () => request<AuthUser>("/auth/me"),
}
