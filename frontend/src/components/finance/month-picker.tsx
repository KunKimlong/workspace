"use client"

import { useState } from "react"
import { LuCalendarDays, LuChevronDown, LuChevronLeft, LuChevronRight } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { currentMonth, formatMonth, shiftMonth } from "@/lib/format"
import { cn } from "@/lib/utils"

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const pad = (n: number) => String(n).padStart(2, "0")

/**
 * ‹ [October 2026 ▾] › - arrows step one month; the middle button opens a picker with a
 * month grid, year arrows, and (click the year) a 12-year grid for jumping further.
 */
export function MonthPicker({ value, onChange }: { value: string; onChange: (month: string) => void }) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<"months" | "years">("months")
  const [year, setYear] = useState(() => Number(value.slice(0, 4)))

  const selectedYear = Number(value.slice(0, 4))
  const selectedMonth = Number(value.slice(5, 7))
  const today = currentMonth()
  const todayYear = Number(today.slice(0, 4))
  const todayMonth = Number(today.slice(5, 7))
  const decadeStart = year - (year % 12)

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) {
      // Always open on the selected month's year
      setYear(selectedYear)
      setView("months")
    }
  }

  function select(month: string) {
    onChange(month)
    setOpen(false)
  }

  const cellClass = (selected: boolean, isToday: boolean) =>
    cn(
      "h-10 rounded-lg text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
      selected
        ? "bg-primary text-primary-foreground shadow-sm"
        : isToday
          ? "text-brand-text ring-1 ring-primary/40 hover:bg-accent"
          : "hover:bg-accent hover:text-accent-foreground"
    )

  return (
    <div className="flex items-center rounded-lg border bg-card shadow-card">
      <Button
        variant="ghost"
        size="icon"
        className="rounded-r-none"
        aria-label="Previous month"
        onClick={() => onChange(shiftMonth(value, -1))}
      >
        <LuChevronLeft />
      </Button>

      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger
          render={<Button variant="ghost" className="min-w-44 rounded-none border-x font-semibold" />}
          aria-label={`Choose month, currently ${formatMonth(value)}`}
        >
          <LuCalendarDays className="text-muted-foreground" />
          {formatMonth(value)}
          <LuChevronDown className="text-muted-foreground" />
        </PopoverTrigger>

        <PopoverContent align="center" className="w-80 gap-3 rounded-xl p-3 shadow-lg">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={view === "months" ? "Previous year" : "Previous 12 years"}
              onClick={() => setYear((y) => y - (view === "months" ? 1 : 12))}
            >
              <LuChevronLeft />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-base font-semibold"
              onClick={() => setView((v) => (v === "months" ? "years" : "months"))}
              aria-label={view === "months" ? `${year}, choose a year` : "Back to months"}
            >
              {view === "months" ? year : `${decadeStart} – ${decadeStart + 11}`}
              <LuChevronDown className={cn("transition-transform", view === "years" && "rotate-180")} />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={view === "months" ? "Next year" : "Next 12 years"}
              onClick={() => setYear((y) => y + (view === "months" ? 1 : 12))}
            >
              <LuChevronRight />
            </Button>
          </div>

          {view === "months" ? (
            <div className="grid grid-cols-3 gap-1.5">
              {MONTHS.map((label, i) => {
                const m = i + 1
                return (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={year === selectedYear && m === selectedMonth}
                    aria-label={formatMonth(`${year}-${pad(m)}`)}
                    className={cellClass(
                      year === selectedYear && m === selectedMonth,
                      year === todayYear && m === todayMonth
                    )}
                    onClick={() => select(`${year}-${pad(m)}`)}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {Array.from({ length: 12 }, (_, i) => decadeStart + i).map((y) => (
                <button
                  key={y}
                  type="button"
                  aria-pressed={y === year}
                  className={cellClass(y === year, y === todayYear)}
                  onClick={() => {
                    setYear(y)
                    setView("months")
                  }}
                >
                  {y}
                </button>
              ))}
            </div>
          )}

          <div className="flex justify-end border-t pt-3">
            <Button variant="outline" size="sm" onClick={() => select(today)}>
              This month
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Button
        variant="ghost"
        size="icon"
        className="rounded-l-none"
        aria-label="Next month"
        onClick={() => onChange(shiftMonth(value, 1))}
      >
        <LuChevronRight />
      </Button>
    </div>
  )
}
