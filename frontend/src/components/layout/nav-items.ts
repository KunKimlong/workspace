import type { IconType } from "react-icons"
import { LuChartPie, LuLayoutDashboard, LuPiggyBank, LuReceipt, LuWallet } from "react-icons/lu"

export interface NavLink {
  title: string
  href: string
  icon: IconType
}

/** A top-level entry: a link, or a group whose `children` open as a dropdown. */
export interface NavItem extends NavLink {
  children?: NavLink[]
}

export const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", href: "/", icon: LuLayoutDashboard },
  {
    title: "Finance",
    href: "/finance",
    icon: LuWallet,
    children: [
      { title: "Overview", href: "/finance", icon: LuChartPie },
      { title: "Expenses", href: "/finance/expenses", icon: LuReceipt },
      { title: "Budget & savings", href: "/finance/budget", icon: LuPiggyBank },
    ],
  },
]

/** Exact match for "/" and group roots that are also a child ("/finance"), prefix match otherwise. */
export function isActive(href: string, pathname: string, exact = false) {
  return href === "/" || exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
}

/** The page the user is on, with its group when it's inside one - for the header title. */
export function findCurrent(pathname: string): { group?: NavItem; page: NavLink } | null {
  for (const item of NAV_ITEMS) {
    if (item.children) {
      const child = item.children.find((c) => isActive(c.href, pathname, c.href === item.href))
      if (child) return { group: item, page: child }
    } else if (isActive(item.href, pathname)) {
      return { page: item }
    }
  }
  return null
}
