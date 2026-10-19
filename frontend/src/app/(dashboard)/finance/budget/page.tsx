"use client"

import { LuCoins, LuLandmark, LuPencil, LuPiggyBank, LuWallet } from "react-icons/lu"

import { useFinance } from "@/components/finance/finance-context"
import { SalaryVsSpentChart } from "@/components/finance/finance-charts"
import { FinancePageHeader, FinancePageSkeleton, StatCard } from "@/components/finance/finance-ui"
import { SavingsPlanCard } from "@/components/finance/savings-plan-card"
import { Button } from "@/components/ui/button"
import { formatDateTime, formatMoney } from "@/lib/format"
import { cn } from "@/lib/utils"

/** Money coming in and kept: salary, savings goal, balance, the savings plan and history. */
export default function FinanceBudgetPage() {
  const { summary, stats, loading, openSalary, openBalance } = useFinance()

  const header = (
    <FinancePageHeader title="Budget & savings" description="Your salary, savings goal and the money you have." />
  )
  if (!summary || !stats) {
    return (
      <>
        {header}
        <FinancePageSkeleton />
      </>
    )
  }

  const { balance } = stats

  return (
    <>
      {header}
      <div className={cn("flex flex-col gap-4 transition-opacity", loading && "opacity-60")}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Salary"
            value={stats.salary != null ? formatMoney(stats.salary) : "Not set"}
            icon={LuWallet}
            accent="salary"
            hint={stats.goal != null ? `Saving ${formatMoney(stats.goal)} this month` : "No savings goal yet"}
          >
            <Button variant="outline" size="sm" className="w-fit" onClick={openSalary}>
              <LuPencil /> {stats.salary != null ? "Edit plan" : "Set salary"}
            </Button>
          </StatCard>

          <StatCard
            title="Remaining salary"
            value={stats.remainingSalary != null ? formatMoney(stats.remainingSalary) : "—"}
            icon={LuPiggyBank}
            accent="remaining"
            tone={stats.remainingSalary != null && stats.remainingSalary < 0 ? "negative" : undefined}
            hint={
              stats.remainingSalary == null
                ? "Set a salary to track what's left"
                : `Salary − ${formatMoney(stats.spent)} spent this month`
            }
          />

          <StatCard
            title="Current balance"
            value={balance ? formatMoney(balance.amount) : "Not set"}
            icon={LuLandmark}
            accent="balance"
            hint={balance ? `Entered ${formatDateTime(balance.setAt)}` : "The money you have now - bank and cash"}
          >
            <Button variant="outline" size="sm" className="w-fit" onClick={openBalance}>
              <LuPencil /> {balance ? "Update balance" : "Set balance"}
            </Button>
          </StatCard>

          <StatCard
            title="Remaining balance"
            value={stats.remainingBalance != null ? formatMoney(stats.remainingBalance) : "—"}
            icon={LuCoins}
            accent="balance"
            tone={stats.remainingBalance != null && stats.remainingBalance < 0 ? "negative" : undefined}
            hint={
              !balance
                ? "Set your current balance to track it"
                : stats.remainingSalary != null
                  ? `${formatMoney(balance.amount)} balance + ${formatMoney(stats.remainingSalary)} remaining salary`
                  : `${formatMoney(balance.amount)} balance − ${formatMoney(stats.spent)} spent (no salary set)`
            }
          />
        </div>

        <SavingsPlanCard input={stats} onEdit={openSalary} />

        <SalaryVsSpentChart history={summary.history} />
      </div>
    </>
  )
}
