import { extraIncomeTotal, specialTotal, type FinanceSummary } from "@/lib/finance"
import { daysBetween, daysInMonth, todayISO } from "@/lib/format"

/**
 * Even share per day of what's left, with today's everyday spending added back so the limit doesn't
 * shrink as you spend today (that spending is measured against it instead). Special spending is not
 * added back, so a one-off cost is spread over all the days left, today included. `daysLeft` includes today.
 */
export function dailyLimit(left: number, todayEverydaySpent: number | null, daysLeft: number) {
  return Math.max(left + (todayEverydaySpent ?? 0), 0) / Math.max(daysLeft, 1)
}

/**
 * Tomorrow's daily limit if nothing more is spent today: what's left spread over the days after today.
 * Null when today is the last day. `daysLeft` includes today.
 */
export function tomorrowLimit(left: number, daysLeft: number) {
  return daysLeft > 1 ? Math.max(left, 0) / (daysLeft - 1) : null
}

/** Everything the Finance pages derive from the selected month's data. `today` is "yyyy-MM-dd". */
export function deriveStats(summary: FinanceSummary, month: string, today = todayISO()) {
  const thisMonth = today.slice(0, 7)
  const isCurrent = month === thisMonth
  const totalDays = daysInMonth(month)
  // Days that have started so far in the viewed month (all of them for past months, none for future)
  const daysElapsed = isCurrent ? Number(today.slice(8)) : month < thisMonth ? totalDays : 0
  const daysLeft = isCurrent ? totalDays - daysElapsed + 1 : month > thisMonth ? totalDays : 0

  const salary = summary.salary
  const goal = summary.savingsGoal
  const spent = summary.totalSpent
  // Money in on top of the salary (tips, side work...) - it adds to what the month can spend
  const extraIncome = extraIncomeTotal(summary.incomes)
  const remainingSalary = salary != null ? salary + extraIncome - spent : null
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
    /** Extra income this month (not the pay). */
    extraIncome,
    /** Extra income dated today. */
    todayEarned: isCurrent ? extraIncomeTotal(summary.incomes.filter((i) => i.receivedOn === today)) : 0,
    /** Salary plus extra income, minus what was spent. */
    remainingSalary,
    /** What the month can spend and still keep the savings goal: salary + extra income - goal. */
    spendingBudget: salary != null ? salary + extraIncome - (goal ?? 0) : null,
    avgPerDay: daysElapsed > 0 ? spent / daysElapsed : 0,
    // Even daily spend that still leaves the savings goal (or the whole salary if no goal)
    dailyBudget: salary != null ? (salary + extraIncome - (goal ?? 0)) / totalDays : null,
    /** Everyday spending today (special items excluded) - what the daily limit is measured against. */
    todaySpent: todayTotal != null ? Math.max(todayTotal - todaySpecial, 0) : null,
    /** Special spending dated today. */
    todaySpecial,
    specialSpent: specialTotal(summary.planned),
    balance,
    // The balance the user typed already includes salary received and everything spent before it was
    // entered, so only spending added since then comes off it (worked out by the backend).
    remainingBalance: balance ? balance.remaining : null,
  }
}

export type FinanceStats = ReturnType<typeof deriveStats>

/**
 * What today's spending is measured against:
 * - `pay`: budgeting the balance until the next expected pay (for pay with no fixed day) - what's left
 *   minus the amount to keep, spread over the days until then;
 * - `pay-due`: the expected pay day has come, so there's nothing to spread over until it's recorded or
 *   the date is moved;
 * - `month`: the calendar month's salary (minus the savings goal, if a monthly plan is set);
 * - null: not enough set up to work one out.
 * A pay plan wins when there is one, but only for the current month - it's about today, not history.
 */
export type TodayBudget =
  | { mode: "pay"; perDay: number; tomorrow: number | null; daysLeft: number; nextPayDate: string; spendable: number }
  | { mode: "pay-due"; nextPayDate: string }
  | { mode: "month"; perDay: number; tomorrow: number | null; daysLeft: number }

export function todayBudget(
  stats: FinanceStats,
  monthPlan: { perDay: number | null; leftToSpend: number } | null
): TodayBudget | null {
  const balance = stats.balance
  if (stats.isCurrent && balance?.nextPayDate) {
    const nextPayDate = balance.nextPayDate
    // Days to cover: today up to the day before the pay arrives
    const daysLeft = daysBetween(stats.today, nextPayDate)
    if (daysLeft <= 0) return { mode: "pay-due", nextPayDate }
    const spendable = balance.remaining - (balance.keepAmount ?? 0)
    // Add back only today's spending that has come off the balance (spending before it was entered hasn't)
    const addBack = Math.min(stats.todaySpent ?? 0, balance.spentSince)
    return {
      mode: "pay",
      perDay: dailyLimit(spendable, addBack, daysLeft),
      tomorrow: tomorrowLimit(spendable, daysLeft),
      daysLeft,
      nextPayDate,
      spendable,
    }
  }
  if (monthPlan?.perDay != null) {
    return {
      mode: "month",
      perDay: monthPlan.perDay,
      tomorrow: tomorrowLimit(monthPlan.leftToSpend, stats.daysLeft),
      daysLeft: stats.daysLeft,
    }
  }
  if (stats.remainingSalary != null && stats.daysLeft > 0) {
    return {
      mode: "month",
      perDay: dailyLimit(stats.remainingSalary, stats.todaySpent, stats.daysLeft),
      tomorrow: tomorrowLimit(stats.remainingSalary, stats.daysLeft),
      daysLeft: stats.daysLeft,
    }
  }
  return null
}
