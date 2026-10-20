"use client"

import { LuBanknote, LuCalendarClock, LuPencil } from "react-icons/lu"

import { useFinance } from "@/components/finance/finance-context"
import { Private } from "@/components/privacy"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { FinanceStats, TodayBudget } from "@/lib/finance-stats"
import { formatDay, formatMoney } from "@/lib/format"
import { cn } from "@/lib/utils"

function Stat({ label, children, tone }: { label: string; children: React.ReactNode; tone?: "negative" }) {
  return (
    <div className="rounded-xl bg-muted/60 px-4 py-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-lg font-bold tabular-nums", tone === "negative" && "text-destructive")}>
        {children}
      </p>
    </div>
  )
}

/**
 * Budgeting the balance until the next pay - for pay with no fixed day. Shows the plan, or how to set
 * it up. The pay received is listed in the Income card.
 */
export function PayPlanCard({ stats, budget }: { stats: FinanceStats; budget: TodayBudget | null }) {
  const { openBalance, openPayPlan, openIncome } = useFinance()
  const balance = stats.balance
  const plan = balance?.nextPayDate ? balance : null

  return (
    <Card>
      <CardContent className="grid gap-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/12 text-brand-text">
              <LuCalendarClock className="size-5" />
            </span>
            <div>
              <p className="font-semibold">Until next pay</p>
              <p className="text-xs text-muted-foreground">For pay that doesn&apos;t come on a fixed day</p>
            </div>
          </div>
          {balance && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={openIncome}>
                <LuBanknote /> Got paid
              </Button>
              <Button variant="outline" size="sm" onClick={openPayPlan}>
                <LuPencil /> {plan ? "Edit plan" : "Set next pay"}
              </Button>
            </div>
          )}
        </div>

        {!balance ? (
          <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            Add the money you have now, then tell us when you expect your next pay - it&apos;s spread over the
            days until then.
            <Button size="sm" onClick={openBalance}>
              Set balance
            </Button>
          </div>
        ) : !plan ? (
          <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            Set when you expect your next pay to budget your balance until then. Until you do, the daily limit
            comes from this month&apos;s salary.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Next pay">
              {formatDay(plan.nextPayDate!)}
              <span className="block text-xs font-medium text-muted-foreground">
                {budget?.mode === "pay"
                  ? `in ${budget.daysLeft} day${budget.daysLeft === 1 ? "" : "s"}`
                  : "expected by now"}
              </span>
            </Stat>
            <Stat label="To spend until then" tone={budget?.mode === "pay" && budget.spendable < 0 ? "negative" : undefined}>
              <Private>{formatMoney(plan.remaining - (plan.keepAmount ?? 0))}</Private>
            </Stat>
            <Stat label="Kept untouched">
              {plan.keepAmount ? <Private>{formatMoney(plan.keepAmount)}</Private> : "Nothing"}
            </Stat>
            <Stat label="Per day">
              {budget?.mode === "pay" ? formatMoney(budget.perDay) : "—"}
            </Stat>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
