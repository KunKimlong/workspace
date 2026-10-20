import { act, renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { useApi } from "@/hooks/use-api"

/** A promise the test settles by hand, to control which response arrives first. */
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe("useApi", () => {
  it("loads on mount", async () => {
    const { result } = renderHook(() => useApi(() => Promise.resolve("data"), []))

    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.data).toBe("data"))
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it("reports errors", async () => {
    const { result } = renderHook(() => useApi(() => Promise.reject(new Error("API down")), []))

    await waitFor(() => expect(result.current.error).toBe("API down"))
    expect(result.current.data).toBeNull()
  })

  it("ignores a slow earlier response that arrives after a newer one", async () => {
    const requests: Record<string, ReturnType<typeof deferred<string>>> = {
      "2026-09": deferred<string>(),
      "2026-10": deferred<string>(),
    }
    const { result, rerender } = renderHook(({ month }) => useApi(() => requests[month].promise, [month]), {
      initialProps: { month: "2026-09" },
    })

    rerender({ month: "2026-10" }) // the user switches month before September has loaded
    await act(async () => requests["2026-10"].resolve("October data"))
    await act(async () => requests["2026-09"].resolve("September data"))

    expect(result.current.data).toBe("October data")
    expect(result.current.loading).toBe(false)
  })

  it("ignores a stale error too", async () => {
    const first = deferred<string>()
    const second = deferred<string>()
    const { result, rerender } = renderHook(({ p }) => useApi(() => p, [p]), { initialProps: { p: first.promise } })

    rerender({ p: second.promise })
    await act(async () => second.resolve("fresh"))
    await act(async () => first.reject(new Error("old failure")))

    expect(result.current.data).toBe("fresh")
    expect(result.current.error).toBeNull()
  })
})
