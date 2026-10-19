"use client"

import Link from "next/link"
import type { IconType } from "react-icons"
import {
  LuArrowRight,
  LuCircleAlert,
  LuCircleCheck,
  LuCoins,
  LuLandmark,
  LuPiggyBank,
  LuPlus,
  LuReceipt,
  LuTarget,
  LuTriangleAlert,
  LuWallet,
} from "react-icons/lu"

import { useAuth } from "@/components/auth-provider"
import { FinanceProvider, useFinance, type FinanceStats } from "@/components/finance/finance-context"
import { ExpensesTable, FinancePageSkeleton, ProgressBar, StatCard } from "@/components/finance/finance-ui"
import { computePlan, dailyLimit } from "@/components/finance/savings-plan-card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatMoney, formatMonth } from "@/lib/format"
import { cn } from "@/lib/utils"

function greeting(hour: number) {
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

export default function DashboardPage() {
  const { user } = useAuth()
  const now = new Date()
  const firstName = user?.name.split(" ")[0]

  return (
    <>
      <div className="mb-6">
        <p className="text-sm font-medium text-muted-foreground">
          {now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">
          {greeting(now.getHours())}
          {firstName && `, ${firstName}`}
        </h1>
      </div>
      {/* Always the current month - the Finance pages are where other months are browsed */}
      <FinanceProvider>
        <DashboardContent />
      </FinanceProvider>
    </>
  )
}

function DashboardContent() {
  const { month, summary, expenses, stats } = useFinance()
  if (!summary || !stats || !expenses) return <FinancePageSkeleton cards={3} />

  const plan = computePlan(stats)
  // Daily limit: from the savings plan if there is one, else the remaining salary spread over the days left
  const perDay =
    plan?.perDay ??
    (stats.remainingSalary != null && stats.daysLeft > 0
      ? dailyLimit(stats.remainingSalary, stats.todaySpent, stats.daysLeft)
      : null)
  const moneyLeft = stats.remainingBalance ?? stats.remainingSalary
  const budget = stats.salary != null ? stats.salary - (stats.goal ?? 0) : null

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-5">
        <TodayCard stats={stats} perDay={perDay} />
        <AttentionCard stats={stats} perDay={perDay} plan={plan} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title="Money left"
          value={moneyLeft != null ? formatMoney(moneyLeft) : "—"}
          icon={LuCoins}
          accent="balance"
          tone={moneyLeft != null && moneyLeft < 0 ? "negative" : undefined}
          hint={
            stats.remainingBalance != null
              ? "Balance + remaining salary"
              : stats.remainingSalary != null
                ? "Remaining salary this month"
                : "Set your salary or balance to see this"
          }
        />
        <StatCard
          title={`Spent in ${formatMonth(month, "long").split(" ")[0]}`}
          value={formatMoney(stats.spent)}
          icon={LuReceipt}
          accent="spent"
          hint={
            budget != null && budget > 0
              ? `${Math.round((stats.spent / budget) * 100)}% of your ${formatMoney(budget)} budget`
              : `${summary.expenseCount} expense${summary.expenseCount === 1 ? "" : "s"}`
          }
        >
          {budget != null && budget > 0 && (
            <ProgressBar value={(stats.spent / budget) * 100} label="Spending budget used" danger={stats.spent > budget} />
          )}
        </StatCard>
        <StatCard
          title="Savings goal"
          value={stats.goal != null ? formatMoney(stats.goal) : "Not set"}
          icon={LuPiggyBank}
          accent="remaining"
          hint={
            plan && stats.goal != null
              ? `On pace to save ${formatMoney(Math.max(plan.projectedSavings, 0))} this month`
              : "Pick an amount to keep from your salary"
          }
        >
          {plan && stats.goal != null && stats.goal > 0 && (
            <div
              className="h-1.5 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label="Projected savings against goal"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(Math.min(Math.max(plan.projectedSavings / stats.goal, 0), 1) * 100)}
            >
              <div
                className={cn("h-full rounded-full", plan.projectedSavings >= stats.goal ? "bg-success" : "bg-amber-500")}
                style={{ width: `${Math.min(Math.max(plan.projectedSavings / stats.goal, 0), 1) * 100}%` }}
              />
            </div>
          )}
        </StatCard>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent expenses</CardTitle>
          <CardDescription>The latest things you spent on</CardDescription>
          <CardAction>
            <Link href="/finance/expenses" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              View all <LuArrowRight />
            </Link>
          </CardAction>
        </CardHeader>
        <CardContent className="px-0">
          {expenses.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nothing spent yet this month.</p>
          ) : (
            <ExpensesTable expenses={expenses} limit={5} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/** The one number that matters day to day: what's still OK to spend today. */
function TodayCard({ stats, perDay }: { stats: FinanceStats; perDay: number | null }) {
  const { openExpense, openSalary } = useFinance()
  const todaySpent = stats.todaySpent ?? 0
  const leftToday = perDay != null ? perDay - todaySpent : null

  return (
    <Card className="lg:col-span-3">
      <CardContent className="flex h-full flex-col gap-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Left to spend today</p>
            {leftToday != null ? (
              <p
                className={cn(
                  "mt-1 text-4xl font-bold tracking-tight tabular-nums",
                  leftToday < 0 && "text-destructive"
                )}
              >
                {formatMoney(Math.max(leftToday, 0))}
              </p>
            ) : (
              <p className="mt-1 text-2xl font-bold tracking-tight">Set your salary to get a daily limit</p>
            )}
          </div>
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-brand-text">
            <LuWallet className="size-5" />
          </span>
        </div>

        {perDay != null && (
          <div className="grid gap-2">
            <ProgressBar
              value={perDay > 0 ? (todaySpent / perDay) * 100 : 100}
              label="Today's limit used"
              danger={todaySpent > perDay}
            />
            <p className="text-sm text-muted-foreground tabular-nums">
              {leftToday! < 0
                ? `${formatMoney(-leftToday!)} over today's ${formatMoney(perDay)} limit - tomorrow's limit gets smaller to make up for it.`
                : `${formatMoney(todaySpent)} spent of today's ${formatMoney(perDay)} limit.`}
              {stats.todaySpecial > 0 &&
                ` ${formatMoney(stats.todaySpecial)} of special spending today is spread over the rest of the month instead.`}
            </p>
          </div>
        )}

        <div className="mt-auto flex flex-wrap gap-2">
          <Button onClick={() => openExpense()}>
            <LuPlus /> Add expense
          </Button>
          {perDay == null ? (
            <Button variant="outline" onClick={openSalary}>
              <LuWallet /> Set salary
            </Button>
          ) : (
            <Link href="/finance/expenses" className={buttonVariants({ variant: "outline" })}>
              <LuReceipt /> Special spending
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

interface Notice {
  key: string
  tone: "good" | "warning" | "danger" | "info"
  icon: IconType
  text: string
  action?: { label: string; onClick?: () => void; href?: string }
}

const TONE = {
  good: "bg-success/12 text-success",
  warning: "bg-amber-500/14 text-amber-700 dark:text-amber-400",
  danger: "bg-destructive/10 text-destructive",
  info: "bg-primary/12 text-brand-text",
}

/** What needs doing or watching, most urgent first; a single "all good" line when nothing does. */
function AttentionCard({
  stats,
  perDay,
  plan,
}: {
  stats: FinanceStats
  perDay: number | null
  plan: ReturnType<typeof computePlan>
}) {
  const { openSalary, openBalance } = useFinance()
  const notices: Notice[] = []

  if (stats.salary == null) {
    notices.push({ key: "salary", tone: "info", icon: LuWallet, text: "Your salary for this month isn't set.", action: { label: "Set salary", onClick: openSalary } })
  }
  if (plan?.status === "over") {
    notices.push({ key: "over", tone: "danger", icon: LuCircleAlert, text: `You're ${formatMoney(-plan.leftToSpend)} over this month's spending budget.`, action: { label: "Review", href: "/finance/budget" } })
  } else if (plan?.status === "at-risk") {
    notices.push({ key: "risk", tone: "warning", icon: LuTriangleAlert, text: `At this pace you'll save ${formatMoney(Math.max(plan.projectedSavings, 0))}, below your ${formatMoney(stats.goal!)} goal.`, action: { label: "See plan", href: "/finance/budget" } })
  }
  if (perDay != null && stats.todaySpent != null && stats.todaySpent > perDay) {
    notices.push({ key: "today", tone: "warning", icon: LuTriangleAlert, text: `Today's spending is over the ${formatMoney(perDay)} daily limit.` })
  }
  if (stats.salary != null && stats.goal == null) {
    notices.push({ key: "goal", tone: "info", icon: LuTarget, text: "No savings goal yet - set one to get a daily limit that protects it.", action: { label: "Add goal", onClick: openSalary } })
  }
  if (!stats.balance) {
    notices.push({ key: "balance", tone: "info", icon: LuLandmark, text: "Add your current balance to see all the money you have.", action: { label: "Set balance", onClick: openBalance } })
  }
  if (notices.length === 0) {
    notices.push({
      key: "ok",
      tone: "good",
      icon: LuCircleCheck,
      text: plan && stats.goal != null ? `All good - you're on track to save ${formatMoney(stats.goal)} this month.` : "All good - nothing needs your attention.",
    })
  }

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Needs attention</CardTitle>
        <CardDescription>
          {notices[0].key === "ok" ? "Nothing to do right now" : `${notices.length} thing${notices.length === 1 ? "" : "s"} to look at`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-3">
          {notices.map((n) => (
            <li key={n.key} className="flex items-start gap-3">
              <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", TONE[n.tone])}>
                <n.icon className="size-4" />
              </span>
              <p className="flex-1 pt-1 text-sm">{n.text}</p>
              {n.action &&
                (n.action.href ? (
                  <Link href={n.action.href} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}>
                    {n.action.label}
                  </Link>
                ) : (
                  <Button variant="outline" size="sm" className="shrink-0" onClick={n.action.onClick}>
                    {n.action.label}
                  </Button>
                ))}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
