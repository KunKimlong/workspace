/** ISO 4217 code, e.g. USD or VND. Set NEXT_PUBLIC_CURRENCY in .env.local to change it. */
export const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY ?? "USD"

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: CURRENCY })
const compactMoney = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: CURRENCY,
  notation: "compact",
  maximumFractionDigits: 1,
})

export const formatMoney = (value: number) => money.format(value)
export const formatCompactMoney = (value: number) => compactMoney.format(value)

const pad = (n: number) => String(n).padStart(2, "0")

// Dates are handled as local "yyyy-MM-dd" / "yyyy-MM" strings to avoid UTC day shifts.

export const toISODate = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const todayISO = () => toISODate(new Date())

export const currentMonth = () => todayISO().slice(0, 7)

/** Parses "yyyy-MM-dd" (or "yyyy-MM") as a local date. */
export function parseLocalDate(value: string) {
  const [y, m, d = 1] = value.split("-").map(Number)
  return new Date(y, m - 1, d)
}

/** Whole days from one "yyyy-MM-dd" to another (negative if `to` is earlier). */
export const daysBetween = (from: string, to: string) =>
  Math.round((parseLocalDate(to).getTime() - parseLocalDate(from).getTime()) / 86_400_000)

/** "yyyy-MM-dd" plus `days`. */
export function addDays(date: string, days: number) {
  const d = parseLocalDate(date)
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

export function shiftMonth(month: string, delta: number) {
  const d = parseLocalDate(month)
  d.setMonth(d.getMonth() + delta)
  return toISODate(d).slice(0, 7)
}

export const daysInMonth = (month: string) => {
  const d = parseLocalDate(month)
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}

export const formatMonth = (month: string, style: "long" | "short" = "long") =>
  parseLocalDate(month).toLocaleDateString("en-US", {
    month: style,
    year: style === "long" ? "numeric" : "2-digit",
  })

export const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

/** An ISO instant as e.g. "Oct 16, 2:05 PM" in the viewer's time zone. */
export const formatDateTime = (instant: string) =>
  new Date(instant).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })

export const formatDay = (date: string) =>
  parseLocalDate(date).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
