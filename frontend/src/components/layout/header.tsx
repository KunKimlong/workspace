"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import { LuChevronRight, LuLogOut, LuMenu, LuPanelLeftClose, LuPanelLeftOpen } from "react-icons/lu"

import { useAuth } from "@/components/auth-provider"
import { PrivacyToggle } from "@/components/privacy"
import { ThemeToggle } from "@/components/theme-toggle"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { initials } from "@/lib/format"
import { findCurrent } from "./nav-items"
import { SidebarBrand, SidebarNav } from "./sidebar-nav"
import { useSidebar } from "./sidebar-state"

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { collapsed, toggle } = useSidebar()
  const { user, logout } = useAuth()
  const pathname = usePathname()
  const current = findCurrent(pathname)

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur-md md:px-8">
      <Button
        variant="ghost"
        size="icon"
        className="-ml-1 lg:hidden"
        onClick={() => setMenuOpen(true)}
        aria-label="Open menu"
      >
        <LuMenu />
      </Button>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="-ml-2 hidden text-muted-foreground hover:text-foreground lg:inline-flex"
              onClick={toggle}
              aria-label={collapsed ? "Show sidebar" : "Hide sidebar"}
              aria-expanded={!collapsed}
            />
          }
        >
          {collapsed ? <LuPanelLeftOpen /> : <LuPanelLeftClose />}
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {collapsed ? "Show sidebar" : "Hide sidebar"} <span className="opacity-60">Ctrl+B</span>
        </TooltipContent>
      </Tooltip>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-72 bg-sidebar px-4 pt-0">
          <SheetHeader className="p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SidebarBrand />
          </SheetHeader>
          <SidebarNav onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Sheet>

      {current && (
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
          {current.group && (
            <>
              <span className="text-muted-foreground">{current.group.title}</span>
              <LuChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            </>
          )}
          <span className="truncate font-semibold" aria-current="page">
            {current.page.title}
          </span>
        </nav>
      )}

      <div className="ml-auto flex items-center gap-1">
        <PrivacyToggle />
        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="icon" className="rounded-full" />}
            aria-label="Account menu"
          >
            <Avatar className="size-8">
              <AvatarFallback className="bg-secondary text-xs font-semibold text-secondary-foreground">
                {user ? initials(user.name) : "?"}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="py-2">
                <div className="font-semibold text-foreground">{user?.name}</div>
                <div className="truncate font-normal">{user?.email}</div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={logout}>
              <LuLogOut /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
