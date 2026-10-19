"use client"

import Link from "next/link"
import { LuArrowRight, LuCalendarDays, LuCoins, LuGauge, LuPlus, LuReceipt } from "react-icons/lu"

import { useFinance } from "@/components/finance/finance-context"
import { DailySpendingChart } from "@/components/finance/finance-charts"
import {
  ExpensesTable,
  FinancePageHeader,
  FinancePageSkeleton,
  ProgressBar,
  StatCard,
} from "@/components/finance/finance-ui"
import { computePlan, dailyLimit } from "@/components/finance/savings-plan-card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatMoney, formatMonth } from "@/lib/format"
import { cn } from "@/lib/utils"

const RECENT = 6

/** At a glance: four headline numbers, the daily trend and the latest expenses. */
export default function FinanceOverviewPage() {
  const { month, summary, expenses, stats, loading, openExpense, openSalary } = useFinance()

  const header = <FinancePageHeader title="Overview" description="Where your money stands this month." />
  if (!summary || !stats || !expenses) {
    return (
      <>
        {header}
        <FinancePageSkeleton />
      </>
    )
  }

  const plan = computePlan(stats)
  const budget = stats.salary != null ? stats.salary - (stats.goal ?? 0) : null
  // Money left: the full picture if a balance is set, otherwise what's left of the salary
  const moneyLeft = stats.remainingBalance ?? stats.remainingSalary
  // What can still be spent per day: from the savings plan if there is one, else the remaining salary spread out
  const perDay =
    plan?.perDay ??
    (stats.remainingSalary != null && stats.daysLeft > 0
      ? dailyLimit(stats.remainingSalary, stats.todaySpent, stats.daysLeft)
      : null)

  return (
    <>
      {header}
      <div className={cn("flex flex-col gap-4 transition-opacity", loading && "opacity-60")}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
                  ? "Remaining salary · set a balance in Budget for the full picture"
                  : "Set your salary or balance in Budget"
            }
          />

          <StatCard
            title="Spent this month"
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
              <ProgressBar
                value={(stats.spent / budget) * 100}
                label="Share of spending budget used"
                danger={stats.spent > budget}
              />
            )}
          </StatCard>

          {stats.timing === "past" ? (
            <StatCard
              title="Saved"
              value={stats.remainingSalary != null ? formatMoney(stats.remainingSalary) : "—"}
              icon={LuGauge}
              accent="remaining"
              tone={stats.remainingSalary != null && stats.remainingSalary < 0 ? "negative" : undefined}
              hint={stats.goal != null ? `Goal was ${formatMoney(stats.goal)}` : "Salary minus spending"}
            />
          ) : (
            <StatCard
              title="You can spend"
              value={perDay != null ? formatMoney(perDay) : "—"}
              suffix={perDay != null ? "/ day" : undefined}
              icon={LuGauge}
              accent="remaining"
              hint={
                perDay == null
                  ? "Set your salary to get a daily limit"
                  : stats.goal != null
                    ? `For ${stats.daysLeft} days, still saving ${formatMoney(stats.goal)}`
                    : `For the ${stats.daysLeft} days left`
              }
            >
              {perDay == null && (
                <Button variant="outline" size="sm" className="w-fit" onClick={openSalary}>
                  Set salary
                </Button>
              )}
            </StatCard>
          )}

          <StatCard
            title={stats.isCurrent ? "Spent today" : "Average per day"}
            value={formatMoney(stats.isCurrent ? stats.todaySpent! : stats.avgPerDay)}
            icon={LuCalendarDays}
            tone={stats.isCurrent && perDay != null && stats.todaySpent! > perDay ? "negative" : undefined}
            hint={
              stats.isCurrent
                ? [
                    perDay != null ? `Daily limit ${formatMoney(perDay)}` : `Average ${formatMoney(stats.avgPerDay)} / day`,
                    stats.todaySpecial > 0 && `+ ${formatMoney(stats.todaySpecial)} special, spread over the month`,
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : stats.daysElapsed > 0
                  ? `Across all ${stats.totalDays} days`
                  : "This month hasn't started yet"
            }
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-5">
          <DailySpendingChart daily={summary.daily} dailyBudget={stats.dailyBudget} />

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Recent expenses</CardTitle>
              <CardDescription>
                {summary.expenseCount} in {formatMonth(month)}
              </CardDescription>
              <CardAction>
                <Link href="/finance/expenses" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                  View all <LuArrowRight />
                </Link>
              </CardAction>
            </CardHeader>
            <CardContent className="px-0">
              {expenses.length === 0 ? (
                <div className="flex flex-col items-center gap-3 px-4 py-8 text-center text-sm text-muted-foreground">
                  No expenses yet in {formatMonth(month)}.
                  {!stats.isFuture && (
                    <Button variant="outline" onClick={() => openExpense()}>
                      <LuPlus /> Add expense
                    </Button>
                  )}
                </div>
              ) : (
                <ExpensesTable expenses={expenses} limit={RECENT} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
