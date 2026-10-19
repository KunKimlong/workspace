"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"

const STORAGE_KEY = "sidebar-collapsed"

const SidebarContext = createContext<{ collapsed: boolean; toggle: () => void } | null>(null)

/** Whether the desktop sidebar is collapsed to icons; remembered per browser, Ctrl/Cmd+B toggles it. */
export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "1")
    } catch {
      // storage unavailable - start expanded
    }
  }, [])

  const toggle = useCallback(() => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(STORAGE_KEY, c ? "0" : "1")
      } catch {
        // not remembered, still toggles
      }
      return !c
    })
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "b" && (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [toggle])

  return <SidebarContext.Provider value={{ collapsed, toggle }}>{children}</SidebarContext.Provider>
}

export function useSidebar() {
  const ctx = useContext(SidebarContext)
  if (!ctx) throw new Error("useSidebar must be used inside <SidebarProvider>")
  return ctx
}
