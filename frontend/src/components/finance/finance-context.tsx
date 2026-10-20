"use client"

import { createContext, useContext, useMemo, useState } from "react"
import { LuRefreshCw, LuTriangleAlert } from "react-icons/lu"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { BalanceDialog } from "@/components/finance/balance-dialog"
import { ExpenseDialog } from "@/components/finance/expense-dialog"
import { ExtraIncomeDialog, IncomeDialog, PayPlanDialog } from "@/components/finance/pay-dialogs"
import { SalaryDialog } from "@/components/finance/salary-dialog"
import { Button } from "@/components/ui/button"
import { useApi } from "@/hooks/use-api"
import { financeApi, type Expense, type FinanceSummary } from "@/lib/finance"
import { deriveStats, type FinanceStats } from "@/lib/finance-stats"
import { currentMonth, formatDay, formatMoney, todayISO } from "@/lib/format"

export type { FinanceStats }

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
  /** When the next pay is expected and how much to keep untouched. */
  openPayPlan: () => void
  /** Record pay received. */
  openIncome: () => void
  /** Record money in on a day besides the pay. */
  openExtraIncome: () => void
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
  const [payPlanOpen, setPayPlanOpen] = useState(false)
  const [incomeOpen, setIncomeOpen] = useState(false)
  const [extraIncomeOpen, setExtraIncomeOpen] = useState(false)
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
    openPayPlan: () => setPayPlanOpen(true),
    openIncome: () => setIncomeOpen(true),
    openExtraIncome: () => setExtraIncomeOpen(true),
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
      <PayPlanDialog
        open={payPlanOpen}
        onOpenChange={setPayPlanOpen}
        balance={summary?.balance ?? null}
        onSaved={reload}
      />
      <IncomeDialog
        open={incomeOpen}
        onOpenChange={setIncomeOpen}
        balance={summary?.balance ?? null}
        onSaved={reload}
      />
      <ExtraIncomeDialog open={extraIncomeOpen} onOpenChange={setExtraIncomeOpen} onSaved={reload} />
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
