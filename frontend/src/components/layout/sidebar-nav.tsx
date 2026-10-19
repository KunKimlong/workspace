"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LuChevronDown } from "react-icons/lu"

import { useAuth } from "@/components/auth-provider"
import { Logo, LogoMark } from "@/components/logo"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { initials } from "@/lib/format"
import { APP_NAME } from "@/lib/site"
import { cn } from "@/lib/utils"
import { NAV_ITEMS, isActive, type NavItem } from "./nav-items"
import { useSidebar } from "./sidebar-state"

export function SidebarBrand({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <Link
      href="/"
      className={cn("flex h-14 items-center text-[15px]", collapsed ? "justify-center" : "px-2")}
      aria-label={collapsed ? APP_NAME : undefined}
    >
      {collapsed ? <LogoMark /> : <Logo />}
    </Link>
  )
}

const itemClass = (active: boolean) =>
  cn(
    "group flex h-10 items-center gap-3 rounded-lg text-sm font-medium transition-colors",
    active
      ? "bg-sidebar-accent text-sidebar-accent-foreground"
      : "text-sidebar-foreground/75 hover:bg-muted hover:text-sidebar-foreground"
  )

const iconClass = (active: boolean) =>
  cn(
    "size-[18px] shrink-0 transition-colors",
    active ? "text-primary" : "text-muted-foreground group-hover:text-sidebar-foreground"
  )

/**
 * Expanded: links, and groups (Finance) that open as a dropdown. `collapsed` shows icons only - a
 * group's pages are listed directly - with the name in a tooltip.
 */
export function SidebarNav({ onNavigate, collapsed = false }: { onNavigate?: () => void; collapsed?: boolean }) {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-0.5">
      <p
        className={cn(
          "mb-1.5 px-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase",
          collapsed && "sr-only"
        )}
      >
        Workspace
      </p>
      {NAV_ITEMS.map((item) => {
        if (collapsed) {
          if (item.children) {
            return <CollapsedNavGroup key={item.href} item={item} pathname={pathname} />
          }
          const active = isActive(item.href, pathname)
          return (
            <Tooltip key={item.href}>
              <TooltipTrigger
                render={
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    aria-label={item.title}
                    className={cn(itemClass(active), "justify-center")}
                  />
                }
              >
                <item.icon className={iconClass(active)} />
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                {item.title}
              </TooltipContent>
            </Tooltip>
          )
        }
        if (item.children) {
          return <NavGroup key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
        }
        const active = isActive(item.href, pathname)
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(itemClass(active), "px-3")}
          >
            <item.icon className={iconClass(active)} />
            {item.title}
          </Link>
        )
      })}
    </nav>
  )
}

/** Collapsed sidebar: one icon for the group; clicking it opens its pages in a menu to the right. */
function CollapsedNavGroup({ item, pathname }: { item: NavItem; pathname: string }) {
  const router = useRouter()
  const inGroup = isActive(item.href, pathname)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={`${item.title} pages`}
            className={cn(itemClass(inGroup), "w-full justify-center")}
          />
        }
      >
        <item.icon className={iconClass(inGroup)} />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start" sideOffset={10} className="w-52">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{item.title}</DropdownMenuLabel>
          {item.children!.map((child) => {
            const active = isActive(child.href, pathname, child.href === item.href)
            return (
              <DropdownMenuItem
                key={child.href}
                onClick={() => router.push(child.href)}
                className={cn(active && "bg-sidebar-accent font-medium text-sidebar-accent-foreground")}
                aria-current={active ? "page" : undefined}
              >
                <child.icon className={cn(active && "text-primary")} />
                {child.title}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** A group button that opens its pages underneath; starts open while you're on one of them. */
function NavGroup({ item, pathname, onNavigate }: { item: NavItem; pathname: string; onNavigate?: () => void }) {
  const inGroup = isActive(item.href, pathname)
  const [open, setOpen] = useState(inGroup)
  const [prevInGroup, setPrevInGroup] = useState(inGroup)
  // Opening a page in the group from elsewhere (e.g. a link) opens the dropdown too
  if (inGroup !== prevInGroup) {
    setPrevInGroup(inGroup)
    if (inGroup) setOpen(true)
  }
  const id = `nav-group-${item.title.toLowerCase()}`

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={id}
        className={cn(
          itemClass(false),
          "w-full px-3",
          inGroup && !open && "bg-sidebar-accent text-sidebar-accent-foreground"
        )}
      >
        <item.icon className={iconClass(inGroup)} />
        <span className={cn("flex-1 text-left", inGroup && "text-sidebar-foreground")}>{item.title}</span>
        <LuChevronDown
          className={cn("size-4 text-muted-foreground transition-transform duration-200", open && "rotate-180")}
        />
      </button>
      {open && (
        <div id={id} className="mt-0.5 ml-[1.3rem] flex flex-col gap-0.5 border-l border-sidebar-border pl-2.5">
          {item.children!.map((child) => {
            const active = isActive(child.href, pathname, child.href === item.href)
            return (
              <Link
                key={child.href}
                href={child.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(itemClass(active), "h-9 px-3")}
              >
                <child.icon className={cn(iconClass(active), "size-4")} />
                {child.title}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SidebarUser({ collapsed }: { collapsed: boolean }) {
  const { user } = useAuth()
  if (!user) return null
  const avatar = (
    <Avatar className="size-9">
      <AvatarFallback className="bg-secondary text-xs font-semibold text-secondary-foreground">
        {initials(user.name)}
      </AvatarFallback>
    </Avatar>
  )
  if (collapsed) {
    return (
      <div className="flex justify-center" title={`${user.name} · ${user.email}`}>
        {avatar}
      </div>
    )
  }
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-background/60 p-2.5">
      {avatar}
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{user.name}</p>
        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
      </div>
    </div>
  )
}

/** Desktop sidebar; on small screens the header's menu button opens the same nav in a sheet. */
export function AppSidebar() {
  const { collapsed } = useSidebar()
  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-svh shrink-0 flex-col gap-4 overflow-hidden border-r border-sidebar-border bg-sidebar pb-4 transition-[width] duration-200 lg:flex",
        collapsed ? "w-[4.5rem] px-3" : "w-72 px-4"
      )}
    >
      <SidebarBrand collapsed={collapsed} />
      <SidebarNav collapsed={collapsed} />
      <div className="mt-auto">
        <SidebarUser collapsed={collapsed} />
      </div>
    </aside>
  )
}
