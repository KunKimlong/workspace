"use client"

import { LuPlus } from "react-icons/lu"

import { useFinance } from "@/components/finance/finance-context"
import { ExpensesTable, FinancePageHeader, FinancePageSkeleton } from "@/components/finance/finance-ui"
import { SpecialSpendingCard } from "@/components/finance/special-spending-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatMoney, formatMonth } from "@/lib/format"
import { cn } from "@/lib/utils"

/** Every expense in the month, plus one-off special spending with quick add. */
export default function FinanceExpensesPage() {
  const { month, summary, expenses, stats, loading, reload, openExpense } = useFinance()

  const header = (
    <FinancePageHeader title="Expenses" description="Everything you spent, day by day, and one-off costs." />
  )
  if (!summary || !stats || !expenses) {
    return (
      <>
        {header}
        <FinancePageSkeleton cards={0} />
      </>
    )
  }

  return (
    <>
      {header}
      <div className={cn("flex flex-col gap-4 transition-opacity", loading && "opacity-60")}>
        <SpecialSpendingCard
          month={month}
          items={summary.planned}
          suggestions={summary.plannedSuggestions}
          defaultDate={stats.today.startsWith(month) ? stats.today : `${month}-01`}
          canAdd={!stats.isFuture}
          onChanged={reload}
        />

        <Card>
          <CardHeader>
            <CardTitle>All expenses</CardTitle>
            <CardDescription>
              {summary.expenseCount} expense{summary.expenseCount === 1 ? "" : "s"} ·{" "}
              {formatMoney(stats.spent)} in {formatMonth(month)}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {expenses.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-4 py-10 text-center text-sm text-muted-foreground">
                {stats.isFuture
                  ? `${formatMonth(month)} hasn't started yet - spending can only be added up to today.`
                  : `No expenses recorded for ${formatMonth(month)}.`}
                {!stats.isFuture && (
                  <Button variant="outline" onClick={() => openExpense()}>
                    <LuPlus /> Add your first expense
                  </Button>
                )}
              </div>
            ) : (
              <ExpensesTable expenses={expenses} />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
