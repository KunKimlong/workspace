"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

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
import { financeApi } from "@/lib/finance"
import { CURRENCY, daysInMonth, formatMoney, formatMonth } from "@/lib/format"

type Errors = { amount?: string; savingsGoal?: string; form?: string }

const parseAmount = (value: string) => (value.trim() === "" ? null : Number(value))

export function SalaryDialog({
  open,
  onOpenChange,
  month,
  current,
  currentGoal,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  month: string
  current: number | null
  currentGoal: number | null
  onSaved: () => void
}) {
  const [amount, setAmount] = useState("")
  const [goal, setGoal] = useState("")
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setAmount(current != null ? String(current) : "")
      setGoal(currentGoal != null ? String(currentGoal) : "")
      setErrors({})
    }
  }, [open, current, currentGoal])

  const salaryValue = parseAmount(amount)
  const goalValue = parseAmount(goal)
  const spendable =
    salaryValue != null && !Number.isNaN(salaryValue) && goalValue != null && !Number.isNaN(goalValue)
      ? salaryValue - goalValue
      : null

  function validate(): Errors {
    const next: Errors = {}
    if (salaryValue == null || Number.isNaN(salaryValue)) next.amount = "Enter your salary for this month"
    else if (salaryValue < 0) next.amount = "Salary cannot be negative"
    if (goalValue != null) {
      if (Number.isNaN(goalValue) || goalValue < 0) next.savingsGoal = "Enter a positive amount"
      else if (salaryValue != null && goalValue > salaryValue)
        next.savingsGoal = "Savings goal can't be more than the salary"
    }
    return next
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const clientErrors = validate()
    setErrors(clientErrors)
    if (Object.keys(clientErrors).length) return

    setSaving(true)
    try {
      await financeApi.setSalary(month, salaryValue!, goalValue)
      toast.success(`Plan for ${formatMonth(month)} saved`)
      onOpenChange(false)
      onSaved()
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) setErrors(err.fieldErrors)
      else setErrors({ form: err instanceof Error ? err.message : "Failed to save" })
    } finally {
      setSaving(false)
    }
  }

  async function handleClear() {
    setSaving(true)
    try {
      await financeApi.clearSalary(month)
      toast.success("Salary and savings goal removed")
      onOpenChange(false)
      onSaved()
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : "Failed to remove" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} className="grid gap-6" noValidate>
          <DialogHeader>
            <DialogTitle>Salary & savings plan</DialogTitle>
            <DialogDescription>
              {formatMonth(month)} - set what comes in and how much of it you want to keep.
            </DialogDescription>
          </DialogHeader>

          {errors.form && <p className="text-sm text-destructive">{errors.form}</p>}

          <div className="grid gap-2.5">
            <Label htmlFor="salary" required className={errors.amount ? "text-destructive" : undefined}>
              Salary ({CURRENCY})
            </Label>
            <Input
              id="salary"
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
              autoFocus
            />
            {errors.amount && <p className="text-sm text-destructive">{errors.amount}</p>}
          </div>

          <div className="grid gap-2.5">
            <Label htmlFor="savings-goal" className={errors.savingsGoal ? "text-destructive" : undefined}>
              Savings goal ({CURRENCY})
              <span className="font-normal text-muted-foreground">optional</span>
            </Label>
            <Input
              id="savings-goal"
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              placeholder="How much do you want to save?"
              value={goal}
              onChange={(e) => {
                setGoal(e.target.value)
                setErrors((x) => ({ ...x, savingsGoal: undefined }))
              }}
              aria-invalid={!!errors.savingsGoal}
            />
            {errors.savingsGoal && <p className="text-sm text-destructive">{errors.savingsGoal}</p>}
          </div>

          {spendable != null && spendable >= 0 && (
            <div className="rounded-xl bg-secondary px-4 py-3 text-sm text-secondary-foreground">
              That leaves <strong className="font-semibold">{formatMoney(spendable)}</strong> to spend in{" "}
              {formatMonth(month, "long").split(" ")[0]} - about{" "}
              <strong className="font-semibold">{formatMoney(spendable / daysInMonth(month))}</strong> a day.
            </div>
          )}

          <DialogFooter className="sm:justify-between">
            {current != null ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={handleClear}
                disabled={saving}
              >
                Remove
              </Button>
            ) : (
              <span />
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save plan"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
