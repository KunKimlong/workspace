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
import { financeApi, type Expense } from "@/lib/finance"
import { CURRENCY, todayISO } from "@/lib/format"

interface FormState {
  date: string
  amount: string
  reason: string
}

export function ExpenseDialog({
  open,
  onOpenChange,
  expense,
  defaultDate,
  reasonSuggestions,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The expense to edit, or null to add a new one. */
  expense: Expense | null
  defaultDate: string
  /** Earlier reasons, offered as autocomplete. */
  reasonSuggestions: string[]
  onSaved: () => void
}) {
  const [form, setForm] = useState<FormState>({ date: defaultDate, amount: "", reason: "" })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(
        expense
          ? { date: expense.date, amount: String(expense.amount), reason: expense.reason }
          : { date: defaultDate, amount: "", reason: "" }
      )
      setErrors({})
    }
  }, [open, expense, defaultDate])

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.date > todayISO()) {
      setErrors({ date: "Date can't be in the future" })
      return
    }
    setSaving(true)
    const payload = {
      date: form.date,
      amount: form.amount.trim() === "" ? (null as unknown as number) : Number(form.amount),
      reason: form.reason,
    }
    try {
      if (expense) {
        await financeApi.updateExpense(expense.id, payload)
        toast.success("Expense updated")
      } else {
        await financeApi.addExpense(payload)
        toast.success("Expense added")
      }
      onOpenChange(false)
      onSaved()
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) {
        setErrors(err.fieldErrors)
      } else {
        toast.error(err instanceof Error ? err.message : "Failed to save expense")
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} className="grid gap-6" noValidate>
          <DialogHeader>
            <DialogTitle>{expense ? "Edit expense" : "Add expense"}</DialogTitle>
            <DialogDescription>What did you spend, and on what?</DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 sm:grid-cols-2 sm:gap-5">
            <div className="grid gap-2.5">
              <Label htmlFor="amount" required>Amount ({CURRENCY})</Label>
              <Input
                id="amount"
                aria-required="true"
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={form.amount}
                onChange={set("amount")}
                aria-invalid={!!errors.amount}
                autoFocus
              />
              {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
            </div>
            <div className="grid gap-2.5">
              <Label htmlFor="date" required>Date</Label>
              <DatePicker
                id="date"
                value={form.date}
                onChange={(date) => {
                  setForm((f) => ({ ...f, date }))
                  setErrors((x) => ({ ...x, date: "" }))
                }}
                max={todayISO()}
                invalid={!!errors.date}
              />
              {errors.date && <p className="text-xs text-destructive">{errors.date}</p>}
            </div>
          </div>

          <div className="grid gap-2.5">
            <Label htmlFor="reason" required>Reason</Label>
            <Input
              id="reason"
              aria-required="true"
              list="reason-suggestions"
              placeholder="e.g. Lunch, Groceries, Rent"
              maxLength={200}
              value={form.reason}
              onChange={set("reason")}
              aria-invalid={!!errors.reason}
            />
            <datalist id="reason-suggestions">
              {reasonSuggestions.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
            {errors.reason && <p className="text-xs text-destructive">{errors.reason}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : expense ? "Save changes" : "Add expense"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
