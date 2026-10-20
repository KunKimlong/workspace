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
import { financeApi, type Balance } from "@/lib/finance"
import { addDays, CURRENCY, todayISO } from "@/lib/format"

type Errors = Record<string, string | undefined>

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-sm text-destructive">{message}</p> : null
}

const parseAmount = (value: string) => (value.trim() === "" ? null : Number(value))

/** Handles a save: field errors stay in the form, anything else becomes a toast. */
async function save(run: () => Promise<unknown>, setErrors: (e: Errors) => void, fallback: string) {
  try {
    await run()
    return true
  } catch (err) {
    if (err instanceof ApiError && Object.keys(err.fieldErrors).length) setErrors(err.fieldErrors)
    else toast.error(err instanceof Error ? err.message : fallback)
    return false
  }
}

/** When the next pay is expected and how much to leave untouched until then. */
export function PayPlanDialog({
  open,
  onOpenChange,
  balance,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  balance: Balance | null
  onSaved: () => void
}) {
  const [nextPayDate, setNextPayDate] = useState("")
  const [keep, setKeep] = useState("")
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setNextPayDate(balance?.nextPayDate ?? "")
      setKeep(balance?.keepAmount != null ? String(balance.keepAmount) : "")
      setErrors({})
    }
  }, [open, balance])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const keepAmount = parseAmount(keep)
    const next: Errors = {}
    if (!nextPayDate) next.nextPayDate = "Pick when you expect your next pay"
    else if (nextPayDate <= todayISO()) next.nextPayDate = "Pick a day after today"
    if (keepAmount != null && (Number.isNaN(keepAmount) || keepAmount < 0)) next.keepAmount = "Enter 0 or more"
    setErrors(next)
    if (Object.values(next).some(Boolean)) return

    setSaving(true)
    const ok = await save(() => financeApi.setPayPlan(nextPayDate, keepAmount), setErrors, "Failed to save")
    setSaving(false)
    if (ok) {
      toast.success("Plan saved")
      onOpenChange(false)
      onSaved()
    }
  }

  async function handleRemove() {
    setSaving(true)
    const ok = await save(() => financeApi.clearPayPlan(), setErrors, "Failed to remove")
    setSaving(false)
    if (ok) {
      toast.success("Plan removed - back to budgeting by month")
      onOpenChange(false)
      onSaved()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} className="grid gap-6" noValidate>
          <DialogHeader>
            <DialogTitle>Budget until your next pay</DialogTitle>
            <DialogDescription>
              Your balance is spread over the days until money comes in again, so you get a daily limit even
              when your pay has no fixed day.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 sm:grid-cols-2 sm:gap-5">
            <div className="grid gap-2.5">
              <Label htmlFor="next-pay" required className={errors.nextPayDate ? "text-destructive" : undefined}>
                Next pay expected
              </Label>
              <DatePicker
                id="next-pay"
                value={nextPayDate}
                onChange={(value) => {
                  setNextPayDate(value)
                  setErrors((x) => ({ ...x, nextPayDate: undefined }))
                }}
                min={addDays(todayISO(), 1)}
                invalid={!!errors.nextPayDate}
              />
              <FieldError message={errors.nextPayDate} />
            </div>
            <div className="grid gap-2.5">
              <Label htmlFor="keep-amount" className={errors.keepAmount ? "text-destructive" : undefined}>
                Keep untouched ({CURRENCY})
              </Label>
              <Input
                id="keep-amount"
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                placeholder="Optional"
                value={keep}
                onChange={(e) => {
                  setKeep(e.target.value)
                  setErrors((x) => ({ ...x, keepAmount: undefined }))
                }}
                aria-invalid={!!errors.keepAmount}
              />
              <FieldError message={errors.keepAmount} />
            </div>
          </div>
          <p className="-mt-2 text-sm text-muted-foreground">
            Pick your best guess - you can move the date any time, and recording a pay asks for the next one.
          </p>

          <DialogFooter className="sm:justify-between">
            {balance?.nextPayDate ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={handleRemove}
                disabled={saving}
              >
                Remove plan
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

/**
 * Money in on a day that isn't the pay (tips, side work, selling something). It adds to the balance and
 * the month's budget, so the daily limit goes up; the pay plan stays as it is.
 */
export function ExtraIncomeDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [amount, setAmount] = useState("")
  const [receivedOn, setReceivedOn] = useState("")
  const [note, setNote] = useState("")
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setAmount("")
      setReceivedOn(todayISO())
      setNote("")
      setErrors({})
    }
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const value = parseAmount(amount)
    const next: Errors = {}
    if (value == null || Number.isNaN(value)) next.amount = "Enter how much came in"
    else if (value <= 0) next.amount = "Amount must be greater than 0"
    if (!receivedOn) next.receivedOn = "Pick the day"
    else if (receivedOn > todayISO()) next.receivedOn = "Date can't be in the future"
    setErrors(next)
    if (Object.values(next).some(Boolean)) return

    setSaving(true)
    const ok = await save(
      () => financeApi.addExtraIncome({ amount: value!, receivedOn, note: note.trim() || undefined }),
      setErrors,
      "Failed to save"
    )
    setSaving(false)
    if (ok) {
      toast.success("Income added")
      onOpenChange(false)
      onSaved()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} className="grid gap-6" noValidate>
          <DialogHeader>
            <DialogTitle>Add income</DialogTitle>
            <DialogDescription>
              Money that came in besides your pay - tips, side work, something you sold. It&apos;s added to the
              money you have, so your daily limit goes up.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 sm:grid-cols-2 sm:gap-5">
            <div className="grid gap-2.5">
              <Label htmlFor="extra-amount" required className={errors.amount ? "text-destructive" : undefined}>
                Amount ({CURRENCY})
              </Label>
              <Input
                id="extra-amount"
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
              <FieldError message={errors.amount} />
            </div>
            <div className="grid gap-2.5">
              <Label htmlFor="extra-date" required className={errors.receivedOn ? "text-destructive" : undefined}>
                Received on
              </Label>
              <DatePicker
                id="extra-date"
                value={receivedOn}
                onChange={(value) => {
                  setReceivedOn(value)
                  setErrors((x) => ({ ...x, receivedOn: undefined }))
                }}
                max={todayISO()}
                invalid={!!errors.receivedOn}
              />
              <FieldError message={errors.receivedOn} />
            </div>
          </div>

          <div className="grid gap-2.5">
            <Label htmlFor="extra-note">Note</Label>
            <Input
              id="extra-note"
              placeholder="e.g. Tips, Delivery, Sold old phone"
              maxLength={100}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <p className="-mt-2 text-sm text-muted-foreground">
            Got your regular pay? Use Got paid instead - it also asks when the next one is expected.
          </p>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Add income"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** "I got paid": adds the money to the balance and asks when the next pay is expected. */
export function IncomeDialog({
  open,
  onOpenChange,
  balance,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  balance: Balance | null
  onSaved: () => void
}) {
  const [amount, setAmount] = useState("")
  const [receivedOn, setReceivedOn] = useState("")
  const [nextPayDate, setNextPayDate] = useState("")
  const [note, setNote] = useState("")
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      const today = todayISO()
      setAmount("")
      setReceivedOn(today)
      // Keep a plan date that's still ahead; one that has passed is the pay being recorded now
      setNextPayDate(balance?.nextPayDate && balance.nextPayDate > today ? balance.nextPayDate : "")
      setNote("")
      setErrors({})
    }
  }, [open, balance])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const value = parseAmount(amount)
    const today = todayISO()
    const next: Errors = {}
    if (value == null || Number.isNaN(value)) next.amount = "Enter how much you received"
    else if (value <= 0) next.amount = "Amount must be greater than 0"
    if (!receivedOn) next.receivedOn = "Pick the day"
    else if (receivedOn > today) next.receivedOn = "Date can't be in the future"
    if (!nextPayDate) next.nextPayDate = "Pick when you expect your next pay"
    else if (nextPayDate <= today) next.nextPayDate = "Pick a day after today"
    setErrors(next)
    if (Object.values(next).some(Boolean)) return

    setSaving(true)
    const ok = await save(
      () => financeApi.recordIncome({ amount: value!, receivedOn, nextPayDate, note: note.trim() || undefined }),
      setErrors,
      "Failed to save"
    )
    setSaving(false)
    if (ok) {
      toast.success("Pay added to your balance")
      onOpenChange(false)
      onSaved()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} className="grid gap-6" noValidate>
          <DialogHeader>
            <DialogTitle>Got paid</DialogTitle>
            <DialogDescription>
              It&apos;s added to what&apos;s left of your balance, and your daily limit now runs until the next pay.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 sm:grid-cols-2 sm:gap-5">
            <div className="grid gap-2.5">
              <Label htmlFor="income-amount" required className={errors.amount ? "text-destructive" : undefined}>
                Amount ({CURRENCY})
              </Label>
              <Input
                id="income-amount"
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
              <FieldError message={errors.amount} />
            </div>
            <div className="grid gap-2.5">
              <Label htmlFor="income-date" required className={errors.receivedOn ? "text-destructive" : undefined}>
                Received on
              </Label>
              <DatePicker
                id="income-date"
                value={receivedOn}
                onChange={(value) => {
                  setReceivedOn(value)
                  setErrors((x) => ({ ...x, receivedOn: undefined }))
                }}
                max={todayISO()}
                invalid={!!errors.receivedOn}
              />
              <FieldError message={errors.receivedOn} />
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 sm:gap-5">
            <div className="grid gap-2.5">
              <Label htmlFor="income-next" required className={errors.nextPayDate ? "text-destructive" : undefined}>
                Next pay expected
              </Label>
              <DatePicker
                id="income-next"
                value={nextPayDate}
                onChange={(value) => {
                  setNextPayDate(value)
                  setErrors((x) => ({ ...x, nextPayDate: undefined }))
                }}
                min={addDays(todayISO(), 1)}
                invalid={!!errors.nextPayDate}
              />
              <FieldError message={errors.nextPayDate} />
            </div>
            <div className="grid gap-2.5">
              <Label htmlFor="income-note">Note</Label>
              <Input
                id="income-note"
                placeholder="e.g. Salary, Freelance"
                maxLength={100}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Add pay"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
