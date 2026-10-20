"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/**
 * Runs `fetcher` on mount and whenever `deps` change; exposes `reload` for after mutations. Only the
 * latest request may update state, so a slow earlier response (e.g. the month before a quick switch)
 * can't overwrite newer data.
 */
export function useApi<T>(fetcher: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const latest = useRef(0)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(fetcher, deps)

  const reload = useCallback(async () => {
    const id = ++latest.current
    setLoading(true)
    try {
      const result = await load()
      if (id !== latest.current) return
      setData(result)
      setError(null)
    } catch (e) {
      if (id !== latest.current) return
      setError(e instanceof Error ? e.message : "Something went wrong")
    } finally {
      if (id === latest.current) setLoading(false)
    }
  }, [load])

  useEffect(() => {
    reload()
  }, [reload])

  return { data, error, loading, reload }
}
