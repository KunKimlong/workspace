"use client"

import { useTheme } from "next-themes"
import { LuMoon, LuSun } from "react-icons/lu"

import { Button } from "@/components/ui/button"

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      aria-label="Toggle theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <LuSun className="dark:hidden" />
      <LuMoon className="hidden dark:block" />
    </Button>
  )
}
