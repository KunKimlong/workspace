import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const API = "http://localhost:1680/api"

const json = (status: number, body: unknown) =>
  new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })

const session = (token: string) => ({
  accessToken: token,
  tokenType: "Bearer",
  expiresIn: 900,
  user: { id: 1, email: "a@example.com", name: "A", role: "ADMIN" },
})

const fetchMock = vi.fn<typeof fetch>()

// api.ts keeps the access token in module state, so every test gets a fresh copy
async function loadApi() {
  vi.resetModules()
  return import("@/lib/api")
}

const authHeader = (call: number) =>
  new Headers(fetchMock.mock.calls[call][1]?.headers).get("Authorization")

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("request", () => {
  it("sends the access token from login", async () => {
    const api = await loadApi()
    fetchMock.mockResolvedValueOnce(json(200, session("token-1"))).mockResolvedValueOnce(json(200, { ok: true }))

    await api.authApi.login("a@example.com", "pw")
    await expect(api.request("/finance/summary?month=2026-10")).resolves.toEqual({ ok: true })

    expect(fetchMock.mock.calls[1][0]).toBe(`${API}/finance/summary?month=2026-10`)
    expect(authHeader(1)).toBe("Bearer token-1")
  })

  it("refreshes once on 401 and retries with the new token", async () => {
    const api = await loadApi()
    fetchMock
      .mockResolvedValueOnce(json(401, { message: "expired" }))
      .mockResolvedValueOnce(json(200, session("token-2")))
      .mockResolvedValueOnce(json(200, { ok: true }))

    await expect(api.request("/auth/me")).resolves.toEqual({ ok: true })

    expect(fetchMock.mock.calls[1][0]).toBe(`${API}/auth/refresh`)
    expect(authHeader(2)).toBe("Bearer token-2")
  })

  it("signs out when the refresh fails too", async () => {
    const api = await loadApi()
    const expired = vi.fn()
    api.setSessionExpiredHandler(expired)
    fetchMock.mockResolvedValueOnce(json(401, {})).mockResolvedValueOnce(json(401, {}))

    await expect(api.request("/auth/me")).rejects.toMatchObject({ status: 401 })
    expect(expired).toHaveBeenCalledOnce()
  })

  it("shares one refresh between requests that fail together (refresh tokens rotate)", async () => {
    const api = await loadApi()
    let refreshes = 0
    fetchMock.mockImplementation(async (url, init) => {
      if (String(url).endsWith("/auth/refresh")) {
        refreshes++
        return json(200, session("token-3"))
      }
      const auth = new Headers(init?.headers).get("Authorization")
      return auth === "Bearer token-3" ? json(200, { ok: true }) : json(401, {})
    })

    await Promise.all([api.request("/a"), api.request("/b"), api.request("/c")])

    expect(refreshes).toBe(1)
  })

  it("passes field errors through for forms", async () => {
    const api = await loadApi()
    fetchMock.mockResolvedValueOnce(
      json(400, { message: "Validation failed", errors: { date: "Date can't be in the future" } })
    )

    await expect(api.request("/finance/expenses", { method: "POST", body: "{}" })).rejects.toMatchObject({
      status: 400,
      fieldErrors: { date: "Date can't be in the future" },
    })
  })

  it("explains when the backend can't be reached", async () => {
    const api = await loadApi()
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"))

    await expect(api.request("/auth/me")).rejects.toMatchObject({
      status: 0,
      message: expect.stringContaining("Is the Spring Boot backend running?"),
    })
  })
})
