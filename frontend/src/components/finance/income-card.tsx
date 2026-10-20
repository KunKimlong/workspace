"use client"

import { useState } from "react"
import { LuBanknote, LuHandCoins, LuPlus, LuTrash2 } from "react-icons/lu"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { useFinance } from "@/components/finance/finance-context"
import { Private } from "@/components/privacy"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { financeApi, type Income } from "@/lib/finance"
import { formatDay, formatMoney, formatMonth, todayISO } from "@/lib/format"
import { cn } from "@/lib/utils"

/**
 * Money that came in during the viewed month: pay ("Got paid") and extra income on any day. Like
 * spending, only today's extra income can be deleted; pay is fixed by updating the balance instead.
 */
export function IncomeCard({ month, incomes, canAdd }: { month: string; incomes: Income[]; canAdd: boolean }) {
  const { openExtraIncome, reload } = useFinance()
  const [deleting, setDeleting] = useState<Income | null>(null)
  const today = todayISO()

  async function handleDelete() {
    if (!deleting) return
    try {
      await financeApi.deleteIncome(deleting.id)
      toast.success("Income deleted")
      reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete")
    } finally {
      setDeleting(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-success/12 text-success">
            <LuHandCoins className="size-5" />
          </span>
          Income
        </CardTitle>
        <CardDescription>Your pay, and money in besides it - extra income adds to what you can spend.</CardDescription>
        {canAdd && (
          <CardAction>
            <Button variant="outline" size="sm" onClick={openExtraIncome}>
              <LuPlus /> Add income
            </Button>
          </CardAction>
        )}
      </CardHeader>

      <CardContent>
        {incomes.length === 0 ? (
          <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            {canAdd
              ? `No income recorded in ${formatMonth(month)}.`
              : `${formatMonth(month)} hasn't started yet - income can only be added up to today.`}
          </p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {incomes.map((i) => {
              const isPay = i.kind === "PAY"
              const locked = isPay || i.receivedOn < today
              const Icon = isPay ? LuBanknote : LuHandCoins
              return (
                <li key={i.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <Icon className={cn("size-4 shrink-0", isPay ? "text-chart-1" : "text-success")} />
                  <span className="min-w-0 flex-1 truncate">
                    {i.note ?? (isPay ? "Pay" : "Income")}
                    <span className="text-muted-foreground">
                      {" · "}
                      {formatDay(i.receivedOn)}
                      {isPay && i.note && " · pay"}
                    </span>
                  </span>
                  <span className="font-medium tabular-nums text-success">
                    +<Private>{formatMoney(i.amount)}</Private>
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="-mr-1 text-muted-foreground hover:text-destructive"
                    aria-label={
                      isPay
                        ? "Pay can't be deleted - update your balance instead"
                        : locked
                          ? "Income from a past day can't be deleted"
                          : `Delete ${i.note ?? "income"}`
                    }
                    title={
                      isPay
                        ? "Pay can't be deleted - update your balance instead"
                        : locked
                          ? "Income from past days is locked"
                          : undefined
                    }
                    disabled={locked}
                    onClick={() => setDeleting(i)}
                  >
                    <LuTrash2 />
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete income?"
        description={
          deleting ? `${deleting.note ?? "Income"} · ${formatMoney(deleting.amount)} on ${formatDay(deleting.receivedOn)}` : ""
        }
        onConfirm={handleDelete}
      />
    </Card>
  )
}
