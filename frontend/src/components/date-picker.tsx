"use client"

import { useState } from "react"
import { LuCalendar } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { parseLocalDate, toISODate, todayISO } from "@/lib/format"
import { cn } from "@/lib/utils"

/**
 * A button showing the chosen day that opens a calendar. Value is "yyyy-MM-dd" ("" = none).
 * `max` disables later days (e.g. today, so spending can't be dated in the future).
 */
export function DatePicker({
  id,
  value,
  onChange,
  max,
  invalid,
  placeholder = "Pick a date",
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  max?: string
  invalid?: boolean
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = value ? parseLocalDate(value) : undefined
  const maxDate = max ? parseLocalDate(max) : undefined
  const today = todayISO()
  const canPickToday = !max || today <= max

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            aria-invalid={invalid}
            className={cn("w-full justify-start px-3 font-normal", !selected && "text-muted-foreground")}
          />
        }
      >
        <LuCalendar className="text-muted-foreground" />
        {selected
          ? selected.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
          : placeholder}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto gap-0 rounded-xl p-0 shadow-lg">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected ?? maxDate}
          disabled={maxDate ? { after: maxDate } : undefined}
          endMonth={maxDate}
          onSelect={(date) => {
            if (!date) return
            onChange(toISODate(date))
            setOpen(false)
          }}
          className="p-3"
        />
        {canPickToday && (
          <div className="border-t p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => {
                onChange(today)
                setOpen(false)
              }}
            >
              Today
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
