"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"
import { LuEye, LuEyeOff } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

const STORAGE_KEY = "amounts-hidden"

const PrivacyContext = createContext<{ hidden: boolean; toggle: () => void } | null>(null)

/**
 * Whether sensitive amounts (balance, salary, savings, monthly totals) are blurred. Hidden by default and
 * remembered per browser. Today's numbers - what's left to spend today and the daily limit - always show.
 */
export function PrivacyProvider({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(true)

  useEffect(() => {
    try {
      setHidden(localStorage.getItem(STORAGE_KEY) !== "0")
    } catch {
      // storage unavailable - stay hidden
    }
  }, [])

  const toggle = useCallback(() => {
    setHidden((h) => {
      try {
        localStorage.setItem(STORAGE_KEY, h ? "0" : "1")
      } catch {
        // not remembered, still toggles
      }
      return !h
    })
  }, [])

  return <PrivacyContext.Provider value={{ hidden, toggle }}>{children}</PrivacyContext.Provider>
}

export function usePrivacy() {
  const ctx = useContext(PrivacyContext)
  if (!ctx) throw new Error("usePrivacy must be used inside <PrivacyProvider>")
  return ctx
}

/** Blurs a sensitive amount while amounts are hidden; screen readers hear "hidden" instead. */
export function Private({ children, className }: { children: React.ReactNode; className?: string }) {
  const { hidden } = usePrivacy()
  if (!hidden) return <>{children}</>
  return (
    <>
      <span aria-hidden="true" className={cn(// Scales with the font size, so big headline numbers get a strong enough blur
          "pointer-events-none blur-[0.45em] select-none", className)}>
        {children}
      </span>
      <span className="sr-only">hidden</span>
    </>
  )
}

/** For places that can't be blurred, like chart axes and tooltips: the text itself is masked. */
export const MASK = "•••••"

export function PrivacyToggle() {
  const { hidden, toggle } = usePrivacy()
  const label = hidden ? "Show amounts" : "Hide amounts"
  return (
    <Tooltip>
      <TooltipTrigger
        render={<Button variant="ghost" size="icon" onClick={toggle} aria-label={label} aria-pressed={!hidden} />}
      >
        {hidden ? <LuEyeOff /> : <LuEye />}
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}
