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
import { computePlan } from "@/components/finance/savings-plan-card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { todayBudget } from "@/lib/finance-stats"
import { formatDay, formatMoney, formatMonth } from "@/lib/format"
import { cn } from "@/lib/utils"

const RECENT = 6

/** At a glance: four headline numbers, the daily trend and the latest expenses. */
export default function FinanceOverviewPage() {
  const { month, summary, expenses, stats, loading, openExpense, openBalance, openPayPlan, openIncome } = useFinance()

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
  const budget = stats.spendingBudget
  // Money left: the full picture if a balance is set, otherwise what's left of the salary
  const moneyLeft = stats.remainingBalance ?? stats.remainingSalary
  // What can still be spent per day: until the next pay if there's a pay plan, else from the month
  const today = todayBudget(stats, plan)
  const perDay = today && today.mode !== "pay-due" ? today.perDay : null

  return (
    <>
      {header}
      <div className={cn("flex flex-col gap-4 transition-opacity", loading && "opacity-60")}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Money left"
            value={moneyLeft != null ? formatMoney(moneyLeft) : "—"}
            sensitive={moneyLeft != null}
            icon={LuCoins}
            accent="balance"
            tone={moneyLeft != null && moneyLeft < 0 ? "negative" : undefined}
            hint={
              stats.remainingBalance != null
                ? "Balance minus spending, plus income, since you entered it"
                : stats.remainingSalary != null
                  ? "Remaining salary · set a balance in Budget for the full picture"
                  : "Set your salary or balance in Budget"
            }
          />

          <StatCard
            title="Spent this month"
            value={formatMoney(stats.spent)}
            sensitive
            icon={LuReceipt}
            accent="spent"
            hint={
              budget != null && budget > 0
                ? `${Math.round((stats.spent / budget) * 100)}% of your budget`
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
              sensitive={stats.remainingSalary != null}
              icon={LuGauge}
              accent="remaining"
              tone={stats.remainingSalary != null && stats.remainingSalary < 0 ? "negative" : undefined}
              hint={
                stats.goal == null || stats.remainingSalary == null
                  ? "Salary minus spending"
                  : stats.remainingSalary >= stats.goal
                    ? "Savings goal reached"
                    : "Savings goal missed"
              }
            />
          ) : (
            <StatCard
              title="You can spend"
              value={perDay != null ? formatMoney(perDay) : "—"}
              suffix={perDay != null ? "/ day" : undefined}
              icon={LuGauge}
              accent="remaining"
              hint={
                today?.mode === "pay"
                  ? `For ${today.daysLeft} day${today.daysLeft === 1 ? "" : "s"} until your next pay on ${formatDay(today.nextPayDate)}`
                  : today?.mode === "pay-due"
                    ? `Your pay was expected ${formatDay(today.nextPayDate)} - add it or move the date`
                    : perDay == null
                      ? "Add your balance and next pay date, or a monthly salary"
                      : stats.goal != null
                        ? `For ${stats.daysLeft} days, still reaching your savings goal`
                        : `For the ${stats.daysLeft} days left`
              }
            >
              {today?.mode === "pay-due" ? (
                <Button variant="outline" size="sm" className="w-fit" onClick={openIncome}>
                  Got paid
                </Button>
              ) : (
                perDay == null && (
                  <Button variant="outline" size="sm" className="w-fit" onClick={stats.balance ? openPayPlan : openBalance}>
                    {stats.balance ? "Set next pay" : "Set balance"}
                  </Button>
                )
              )}
            </StatCard>
          )}

          <StatCard
            title={stats.isCurrent ? "Spent today" : "Average per day"}
            value={formatMoney(stats.isCurrent ? stats.todaySpent! : stats.avgPerDay)}
            // Today's spending always shows; another month's average gives away its total
            sensitive={!stats.isCurrent}
            icon={LuCalendarDays}
            tone={stats.isCurrent && perDay != null && stats.todaySpent! > perDay ? "negative" : undefined}
            hint={
              stats.isCurrent
                ? [
                    perDay != null ? `Daily limit ${formatMoney(perDay)}` : `Average ${formatMoney(stats.avgPerDay)} / day`,
                    stats.todaySpecial > 0 && `+ ${formatMoney(stats.todaySpecial)} special, spread over the days left`,
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
