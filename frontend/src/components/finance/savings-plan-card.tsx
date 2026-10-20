"use client"

import type { IconType } from "react-icons"
import {
  LuCalendarClock,
  LuCircleAlert,
  LuCircleCheck,
  LuPencil,
  LuPiggyBank,
  LuTarget,
  LuTriangleAlert,
} from "react-icons/lu"

import { Private } from "@/components/privacy"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { dailyLimit } from "@/lib/finance-stats"
import { formatMoney } from "@/lib/format"
import { cn } from "@/lib/utils"

type Timing = "past" | "current" | "future"
type Status = "on-track" | "at-risk" | "over" | "reached" | "missed" | "planned"

// Status always pairs an icon and a label with its color, never color alone
const STATUS: Record<Status, { label: string; icon: IconType; className: string }> = {
  "on-track": { label: "On track", icon: LuCircleCheck, className: "bg-success/12 text-success" },
  reached: { label: "Goal reached", icon: LuCircleCheck, className: "bg-success/12 text-success" },
  "at-risk": {
    label: "At risk",
    icon: LuTriangleAlert,
    className: "bg-amber-500/14 text-amber-700 dark:text-amber-400",
  },
  over: { label: "Over budget", icon: LuCircleAlert, className: "bg-destructive/10 text-destructive" },
  missed: { label: "Goal missed", icon: LuCircleAlert, className: "bg-destructive/10 text-destructive" },
  planned: { label: "Planned", icon: LuCalendarClock, className: "bg-muted text-muted-foreground" },
}

export interface SavingsPlanInput {
  salary: number | null
  goal: number | null
  spent: number
  /** Everyday spending today, special items excluded (null outside the current month). */
  todaySpent: number | null
  /** Special spending dated today - spread over the days left, not counted against today's limit. */
  todaySpecial?: number
  totalDays: number
  daysElapsed: number
  /** Days left including today (current month), all days (future), 0 (past). */
  daysLeft: number
  timing: Timing
  /** Special (one-off) spending this month; already part of `spent`. */
  specialSpent: number
  /** Money in on top of the salary this month (tips, side work...). */
  extraIncome?: number
}

/** All the numbers the card shows, derived from salary, extra income, goal and spending so far. */
export function computePlan({
  salary,
  goal,
  spent,
  totalDays,
  daysElapsed,
  daysLeft,
  timing,
  specialSpent,
  todaySpent,
  extraIncome = 0,
}: SavingsPlanInput) {
  if (salary == null || goal == null) return null
  const income = salary + extraIncome
  const budget = income - goal // what can be spent this month while still saving the goal
  const leftToSpend = budget - spent
  const perDay = timing === "past" ? null : dailyLimit(leftToSpend, todaySpent, daysLeft)

  // Special spending is one-off, so only everyday spending is extrapolated over the remaining days
  let projectedSpend = spent
  if (timing === "current" && daysElapsed > 0) {
    const everydayPerDay = Math.max(spent - specialSpent, 0) / daysElapsed
    projectedSpend = spent + everydayPerDay * (totalDays - daysElapsed)
  }
  const projectedSavings = income - projectedSpend

  let status: Status
  if (timing === "past") status = income - spent >= goal ? "reached" : "missed"
  else if (leftToSpend < 0) status = "over"
  else if (timing === "future") status = "planned"
  else status = projectedSavings < goal ? "at-risk" : "on-track"

  return { budget, leftToSpend, perDay, projectedSavings, status, usedPct: budget > 0 ? spent / budget : 1 }
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "negative" | "positive" }) {
  return (
    <div className="rounded-xl bg-muted/60 px-4 py-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-lg font-bold tabular-nums",
          tone === "negative" && "text-destructive",
          tone === "positive" && "text-success"
        )}
      >
        <Private>{value}</Private>
      </p>
    </div>
  )
}

export function SavingsPlanCard({ input, onEdit }: { input: SavingsPlanInput; onEdit: () => void }) {
  const plan = computePlan(input)
  const { salary, goal, spent, todaySpent, todaySpecial = 0, daysLeft, timing, specialSpent, extraIncome = 0 } = input

  if (!plan) {
    return (
      <Card>
        <CardContent className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-brand-text">
            <LuPiggyBank className="size-6" />
          </span>
          <div className="flex-1">
            <p className="text-base font-semibold">Plan your savings</p>
            <p className="text-sm text-muted-foreground">
              {salary == null
                ? "Set your salary and how much you want to save, and you'll get a daily spending limit."
                : "Decide how much of this month's salary to keep, and you'll get a daily spending limit."}
            </p>
          </div>
          <Button onClick={onEdit}>
            <LuTarget /> {salary == null ? "Set up plan" : "Add savings goal"}
          </Button>
        </CardContent>
      </Card>
    )
  }

  const status = STATUS[plan.status]
  const StatusIcon = status.icon
  const overToday = todaySpent != null && plan.perDay != null && todaySpent > plan.perDay

  return (
    <Card>
      <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10">
        {/* Left: the answer to "how much can I spend a day?" */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary/12 text-brand-text">
                <LuPiggyBank className="size-5" />
              </span>
              <p className="font-semibold">Savings plan</p>
            </div>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                status.className
              )}
            >
              <StatusIcon className="size-3.5" />
              {status.label}
            </span>
          </div>

          {timing === "past" ? (
            <div>
              <p className="text-sm text-muted-foreground">You saved</p>
              <p className="text-4xl font-bold tracking-tight tabular-nums">
                <Private>{formatMoney(salary! + extraIncome - spent)}</Private>
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm text-muted-foreground">You can spend</p>
              <p className="text-4xl font-bold tracking-tight tabular-nums">
                {formatMoney(plan.perDay!)}
                <span className="ml-1 text-lg font-semibold text-muted-foreground">/ day</span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {plan.leftToSpend < 0
                  ? "You're past this month's spending budget, so the savings goal is out of reach."
                  : `for the ${daysLeft === 1 ? "last day" : `next ${daysLeft} days`} and still reach your savings goal.`}
              </p>
            </div>
          )}

          {todaySpent != null && plan.perDay != null && (
            <div
              className={cn(
                "flex items-center justify-between rounded-xl border px-4 py-2.5 text-sm",
                overToday && "border-amber-500/40 bg-amber-500/8"
              )}
            >
              <span className="text-muted-foreground">
                Spent today
                {todaySpecial > 0 && <span className="text-xs"> (+{formatMoney(todaySpecial)} special)</span>}
              </span>
              <span className="font-semibold tabular-nums">
                <span className={cn(overToday && "text-amber-700 dark:text-amber-400")}>
                  {formatMoney(todaySpent)}
                </span>
                <span className="font-normal text-muted-foreground"> of {formatMoney(plan.perDay)}</span>
              </span>
            </div>
          )}
        </div>

        {/* Right: budget progress and the numbers behind it */}
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Spending budget</p>
              <p className="text-xs text-muted-foreground">
                {extraIncome > 0 ? "Salary plus other income, minus savings goal" : "Salary minus savings goal"}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={onEdit}>
              <LuPencil /> Edit plan
            </Button>
          </div>

          <div>
            <div
              className="h-3 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label="Spending budget used"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(Math.min(plan.usedPct, 1) * 100)}
            >
              <div
                className={cn(
                  "h-full rounded-full transition-[width]",
                  plan.usedPct > 1 ? "bg-destructive" : "bg-chart-2"
                )}
                style={{ width: `${Math.min(plan.usedPct, 1) * 100}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground tabular-nums">
              {Math.round(plan.usedPct * 100)}% of the budget used
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Stat label="Savings goal" value={formatMoney(goal!)} />
            <Stat
              label="Left to spend"
              value={formatMoney(plan.leftToSpend)}
              tone={plan.leftToSpend < 0 ? "negative" : undefined}
            />
            <Stat label="Special spending" value={formatMoney(specialSpent)} />
            <Stat
              label={timing === "current" ? "Projected savings" : timing === "past" ? "Actual savings" : "Planned savings"}
              value={formatMoney(timing === "future" ? goal! : plan.projectedSavings)}
              tone={
                timing === "future" ? undefined : plan.projectedSavings >= goal! ? "positive" : "negative"
              }
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
