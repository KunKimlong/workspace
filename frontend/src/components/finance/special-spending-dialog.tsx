"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

import { DatePicker } from "@/components/date-picker"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ApiError } from "@/lib/api"
import { financeApi, type PlannedExpense, type PlannedSuggestion } from "@/lib/finance"
import { CURRENCY, formatMoney, formatMonth, todayISO } from "@/lib/format"

/** Offered until the user has history of their own. */
export const COMMON_SPECIAL_ITEMS = [
  "Fuel",
  "Soap",
  "Electricity",
  "Water",
  "Rent",
  "Internet",
  "Phone",
  "Groceries",
  "Gas",
]

type Errors = Record<string, string | undefined>

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-sm text-destructive">{message}</p> : null
}

/** Add or edit a special item. Saving records it as spent straight away. */
export function SpecialSpendingDialog({
  open,
  onOpenChange,
  item,
  defaultName,
  defaultDate,
  suggestions,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The item to edit, or null to add one. */
  item: PlannedExpense | null
  /** Pre-filled name when adding from a quick-add chip. */
  defaultName?: string
  defaultDate: string
  /** Items used before - picking one of these names fills in the amount from last time. */
  suggestions: PlannedSuggestion[]
  onSaved: () => void
}) {
  const [name, setName] = useState("")
  const [amount, setAmount] = useState("")
  const [date, setDate] = useState(defaultDate)
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)

  const findPrevious = (value: string) =>
    suggestions.find((s) => s.name.toLowerCase() === value.trim().toLowerCase())
  const previous = item ? undefined : findPrevious(name)
  const nameOptions = [
    ...suggestions.map((s) => s.name),
    ...COMMON_SPECIAL_ITEMS.filter((s) => !findPrevious(s)),
  ]

  useEffect(() => {
    if (open) {
      const prefill = defaultName ? findPrevious(defaultName) : undefined
      setName(item?.name ?? defaultName ?? "")
      setAmount(item ? String(item.amount) : prefill ? String(prefill.amount) : "")
      setDate(item?.date ?? defaultDate)
      setErrors({})
    }
    // findPrevious only reads `suggestions`, which is listed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item, defaultName, defaultDate, suggestions])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const value = amount.trim() === "" ? null : Number(amount)
    const next: Errors = {}
    if (!name.trim()) next.name = "Enter what it's for"
    if (value == null || Number.isNaN(value)) next.amount = "Enter how much you spent"
    else if (value <= 0) next.amount = "Amount must be greater than 0"
    if (!date) next.date = "Pick the day"
    else if (date > todayISO()) next.date = "Date can't be in the future"
    setErrors(next)
    if (Object.values(next).some(Boolean)) return

    setSaving(true)
    try {
      const data = { name: name.trim(), amount: value!, date }
      if (item) await financeApi.updatePlanned(item.id, data)
      else await financeApi.addPlanned(data)
      toast.success(item ? `${data.name} updated` : `${data.name} · ${formatMoney(data.amount)} added`)
      onOpenChange(false)
      onSaved()
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) setErrors(err.fieldErrors)
      else toast.error(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} className="grid gap-6" noValidate>
          <DialogHeader>
            <DialogTitle>{item ? "Edit special spending" : "Add special spending"}</DialogTitle>
            <DialogDescription>
              Saved as spent on the day you pick - it shows up in your expenses too.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2.5">
            <Label htmlFor="special-name" required className={errors.name ? "text-destructive" : undefined}>
              What for
            </Label>
            <Input
              id="special-name"
              aria-required="true"
              list="special-suggestions"
              placeholder="e.g. Fuel, Soap, Electricity"
              maxLength={100}
              value={name}
              onChange={(e) => {
                const value = e.target.value
                setName(value)
                setErrors((x) => ({ ...x, name: undefined }))
                // Picked something used before: fill in last time's amount if none typed yet
                const prev = findPrevious(value)
                if (prev && !item && amount.trim() === "") setAmount(String(prev.amount))
              }}
              aria-invalid={!!errors.name}
              autoFocus={!defaultName}
            />
            <datalist id="special-suggestions">
              {nameOptions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <FieldError message={errors.name} />
          </div>

          <div className="grid gap-6 sm:grid-cols-2 sm:gap-5">
            <div className="grid gap-2.5">
              <Label htmlFor="special-amount" required className={errors.amount ? "text-destructive" : undefined}>
                Amount ({CURRENCY})
              </Label>
              <Input
                id="special-amount"
                aria-required="true"
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value)
                  setErrors((x) => ({ ...x, amount: undefined }))
                }}
                aria-invalid={!!errors.amount}
                autoFocus={!!defaultName}
              />
              <FieldError message={errors.amount} />
            </div>
            <div className="grid gap-2.5">
              <Label htmlFor="special-date" required className={errors.date ? "text-destructive" : undefined}>
                Date
              </Label>
              <DatePicker
                id="special-date"
                value={date}
                onChange={(value) => {
                  setDate(value)
                  setErrors((x) => ({ ...x, date: undefined }))
                }}
                max={todayISO()}
                invalid={!!errors.date}
              />
              <FieldError message={errors.date} />
            </div>
          </div>

          {previous && !errors.amount && (
            <p className="-mt-2 text-sm text-muted-foreground">
              Last time ({formatMonth(previous.month)}): {formatMoney(previous.amount)}
              {amount !== String(previous.amount) && (
                <button
                  type="button"
                  className="ml-2 font-medium text-brand-text underline-offset-4 hover:underline"
                  onClick={() => setAmount(String(previous.amount))}
                >
                  Use it
                </button>
              )}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : item ? "Save changes" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
