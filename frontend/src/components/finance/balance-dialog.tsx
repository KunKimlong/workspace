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
import { financeApi, type Balance } from "@/lib/finance"
import { CURRENCY, formatMoney } from "@/lib/format"

/** Enter the money you have right now; expenses added afterwards are taken off it. */
export function BalanceDialog({
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
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setAmount(balance ? String(balance.amount) : "")
      setError(undefined)
    }
  }, [open, balance])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const value = amount.trim() === "" ? null : Number(amount)
    if (value == null || Number.isNaN(value)) return setError("Enter how much money you have")
    if (value < 0) return setError("Balance cannot be negative")

    setSaving(true)
    try {
      await financeApi.setBalance(value)
      toast.success(`Balance set to ${formatMoney(value)}`)
      onOpenChange(false)
      onSaved()
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors.amount) setError(err.fieldErrors.amount)
      else toast.error(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  async function handleClear() {
    setSaving(true)
    try {
      await financeApi.clearBalance()
      toast.success("Balance removed")
      onOpenChange(false)
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} className="grid gap-6" noValidate>
          <DialogHeader>
            <DialogTitle>Current balance</DialogTitle>
            <DialogDescription>
              How much money you have right now - bank and cash together. Remaining balance adds what&apos;s
              left of this month&apos;s salary on top.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2.5">
            <Label htmlFor="balance" required className={error ? "text-destructive" : undefined}>
              Balance ({CURRENCY})
            </Label>
            <Input
              id="balance"
              aria-required="true"
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value)
                setError(undefined)
              }}
              aria-invalid={!!error}
              autoFocus
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter className="sm:justify-between">
            {balance ? (
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
                {saving ? "Saving..." : "Save balance"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
