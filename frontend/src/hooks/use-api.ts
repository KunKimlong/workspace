"use client"

import { useCallback, useEffect, useState } from "react"

/** Runs `fetcher` on mount and whenever `deps` change; exposes `reload` for after mutations. */
export function useApi<T>(fetcher: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(fetcher, deps)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      setData(await load())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }, [load])

  useEffect(() => {
    reload()
  }, [reload])

  return { data, error, loading, reload }
}
