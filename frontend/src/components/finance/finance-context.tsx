"use client"

import { createContext, useContext, useMemo, useState } from "react"
import { LuRefreshCw, LuTriangleAlert } from "react-icons/lu"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { BalanceDialog } from "@/components/finance/balance-dialog"
import { ExpenseDialog } from "@/components/finance/expense-dialog"
import { SalaryDialog } from "@/components/finance/salary-dialog"
import { Button } from "@/components/ui/button"
import { useApi } from "@/hooks/use-api"
import { financeApi, specialTotal, type Expense, type FinanceSummary } from "@/lib/finance"
import { currentMonth, daysInMonth, formatDay, formatMoney, todayISO } from "@/lib/format"

/** Everything the Finance pages derive from the selected month's data. */
function deriveStats(summary: FinanceSummary, month: string) {
  const today = todayISO()
  const thisMonth = currentMonth()
  const isCurrent = month === thisMonth
  const totalDays = daysInMonth(month)
  // Days that have started so far in the viewed month (all of them for past months, none for future)
  const daysElapsed = isCurrent ? Number(today.slice(8)) : month < thisMonth ? totalDays : 0
  const daysLeft = isCurrent ? totalDays - daysElapsed + 1 : month > thisMonth ? totalDays : 0

  const salary = summary.salary
  const goal = summary.savingsGoal
  const spent = summary.totalSpent
  const remainingSalary = salary != null ? salary - spent : null
  const balance = summary.balance
  // Today's spending split: special (one-off) items are spread over the rest of the month rather than
  // counted against today's daily limit, so only everyday spending is measured against it.
  const todayTotal = isCurrent ? (summary.daily.find((d) => d.date === today)?.total ?? 0) : null
  const todaySpecial = isCurrent ? specialTotal(summary.planned.filter((p) => p.date === today)) : 0
  return {
    today,
    isCurrent,
    isFuture: month > thisMonth,
    timing: (isCurrent ? "current" : month < thisMonth ? "past" : "future") as "current" | "past" | "future",
    totalDays,
    daysElapsed,
    daysLeft,
    salary,
    goal,
    spent,
    remainingSalary,
    avgPerDay: daysElapsed > 0 ? spent / daysElapsed : 0,
    // Even daily spend that still leaves the savings goal (or the whole salary if no goal)
    dailyBudget: salary != null ? (salary - (goal ?? 0)) / totalDays : null,
    /** Everyday spending today (special items excluded) - what the daily limit is measured against. */
    todaySpent: todayTotal != null ? Math.max(todayTotal - todaySpecial, 0) : null,
    /** Special spending dated today. */
    todaySpecial,
    specialSpent: specialTotal(summary.planned),
    balance,
    // Balance + what's left of this month's salary. Spending is already off the remaining salary, so it
    // isn't subtracted from the balance again. No salary set counts as 0.
    remainingBalance: balance ? balance.amount + (salary ?? 0) - spent : null,
  }
}

export type FinanceStats = ReturnType<typeof deriveStats>

interface FinanceContextValue {
  month: string
  setMonth: (month: string) => void
  summary: FinanceSummary | null
  expenses: Expense[] | null
  stats: FinanceStats | null
  loading: boolean
  reload: () => void
  openSalary: () => void
  openBalance: () => void
  /** Pass an expense to edit it, or nothing to add one. */
  openExpense: (expense?: Expense) => void
  deleteExpense: (expense: Expense) => void
}

const FinanceContext = createContext<FinanceContextValue | null>(null)

/**
 * Shared by every Finance page (it lives in the Finance layout), so the chosen month and loaded data
 * survive moving between Overview, Expenses and Budget.
 */
export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const [month, setMonth] = useState(currentMonth)
  const { data, error, loading, reload } = useApi(
    () => Promise.all([financeApi.summary(month), financeApi.expenses(month)]),
    [month]
  )
  const [summary, expenses] = data ?? [null, null]
  const stats = useMemo(() => (summary ? deriveStats(summary, month) : null), [summary, month])

  const [salaryOpen, setSalaryOpen] = useState(false)
  const [balanceOpen, setBalanceOpen] = useState(false)
  const [expenseOpen, setExpenseOpen] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [deleting, setDeleting] = useState<Expense | null>(null)

  const reasonSuggestions = useMemo(
    () => [...new Set((expenses ?? []).map((e) => e.reason))].slice(0, 20),
    [expenses]
  )
  const today = todayISO()

  async function handleDelete() {
    if (!deleting) return
    try {
      await financeApi.deleteExpense(deleting.id)
      toast.success("Expense deleted")
      reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete expense")
    } finally {
      setDeleting(null)
    }
  }

  const value: FinanceContextValue = {
    month,
    setMonth,
    summary,
    expenses,
    stats,
    loading,
    reload,
    openSalary: () => setSalaryOpen(true),
    openBalance: () => setBalanceOpen(true),
    openExpense: (expense) => {
      setEditing(expense ?? null)
      setExpenseOpen(true)
    },
    deleteExpense: setDeleting,
  }

  return (
    <FinanceContext.Provider value={value}>
      {error && !data ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center">
          <LuTriangleAlert className="size-8 text-destructive" />
          <p className="max-w-md text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={reload}>
            <LuRefreshCw /> Retry
          </Button>
        </div>
      ) : (
        children
      )}

      <SalaryDialog
        open={salaryOpen}
        onOpenChange={setSalaryOpen}
        month={month}
        current={summary?.salary ?? null}
        currentGoal={summary?.savingsGoal ?? null}
        onSaved={reload}
      />
      <BalanceDialog
        open={balanceOpen}
        onOpenChange={setBalanceOpen}
        balance={summary?.balance ?? null}
        onSaved={reload}
      />
      <ExpenseDialog
        open={expenseOpen}
        onOpenChange={setExpenseOpen}
        expense={editing}
        defaultDate={today.startsWith(month) ? today : `${month}-01`}
        reasonSuggestions={reasonSuggestions}
        onSaved={reload}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete expense?"
        description={
          deleting ? `"${deleting.reason}" · ${formatMoney(deleting.amount)} on ${formatDay(deleting.date)}` : ""
        }
        onConfirm={handleDelete}
      />
    </FinanceContext.Provider>
  )
}

export function useFinance() {
  const ctx = useContext(FinanceContext)
  if (!ctx) throw new Error("useFinance must be used inside <FinanceProvider>")
  return ctx
}
