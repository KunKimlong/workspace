import { describe, expect, it } from "vitest"

import type { Balance, FinanceSummary, Income } from "@/lib/finance"
import { deriveStats, todayBudget } from "@/lib/finance-stats"

function balance(overrides: Partial<Balance> = {}): Balance {
  return {
    amount: 500,
    setAt: "2026-10-16T08:11:00Z",
    spentSince: 20,
    earnedSince: 0,
    remaining: 480,
    nextPayDate: null,
    keepAmount: null,
    ...overrides,
  }
}

function summary(overrides: Partial<FinanceSummary> = {}): FinanceSummary {
  const daily = Array.from({ length: 31 }, (_, i) => ({
    date: `2026-10-${String(i + 1).padStart(2, "0")}`,
    total: 0,
    count: 0,
  }))
  daily[15] = { date: "2026-10-16", total: 33.25, count: 4 }
  return {
    month: "2026-10",
    salary: 270,
    savingsGoal: 100,
    totalSpent: 33.25,
    expenseCount: 4,
    daily,
    history: [],
    planned: [{ id: 1, name: "Fuel", amount: 30, date: "2026-10-16", expenseId: 9 }],
    plannedSuggestions: [],
    balance: null,
    incomes: [],
    ...overrides,
  }
}

describe("deriveStats", () => {
  it("counts days in the current month, today included in the days left", () => {
    const s = deriveStats(summary(), "2026-10", "2026-10-20")
    expect(s.timing).toBe("current")
    expect(s.daysElapsed).toBe(20)
    expect(s.daysLeft).toBe(12)
    expect(s.remainingSalary).toBeCloseTo(236.75)
    expect(s.specialSpent).toBe(30)
  })

  it("treats past and future months as fully elapsed / not started", () => {
    const past = deriveStats(summary({ month: "2026-09" }), "2026-09", "2026-10-20")
    expect([past.timing, past.daysElapsed, past.daysLeft]).toEqual(["past", 30, 0])
    expect(past.todaySpent).toBeNull()

    const future = deriveStats(summary({ month: "2026-11" }), "2026-11", "2026-10-20")
    expect([future.timing, future.daysElapsed, future.daysLeft, future.isFuture]).toEqual(["future", 0, 30, true])
  })

  it("leaves today's special spending out of today's everyday spending", () => {
    const s = deriveStats(summary(), "2026-10", "2026-10-16")
    expect(s.todaySpent).toBeCloseTo(3.25)
    expect(s.todaySpecial).toBe(30)
  })

  it("takes the remaining balance from the backend instead of adding the salary again", () => {
    const s = deriveStats(summary({ balance: balance() }), "2026-10", "2026-10-20")
    expect(s.remainingBalance).toBe(480)
  })

  it("has no remaining balance until one is entered", () => {
    expect(deriveStats(summary(), "2026-10", "2026-10-20").remainingBalance).toBeNull()
  })

  it("adds extra income to the month's budget, but not the pay", () => {
    const incomes: Income[] = [
      { id: 1, kind: "EXTRA", receivedOn: "2026-10-20", amount: 15, note: "Tips" },
      { id: 2, kind: "EXTRA", receivedOn: "2026-10-18", amount: 5, note: null },
      { id: 3, kind: "PAY", receivedOn: "2026-10-01", amount: 500, note: null },
    ]
    const s = deriveStats(summary({ incomes }), "2026-10", "2026-10-20")

    expect(s.extraIncome).toBe(20)
    expect(s.todayEarned).toBe(15)
    expect(s.remainingSalary).toBeCloseTo(270 + 20 - 33.25)
    expect(s.spendingBudget).toBe(190) // 270 + 20 - 100
  })
})

describe("todayBudget", () => {
  const monthPlan = { perDay: 11.4, leftToSpend: 136.8 }

  it("budgets the balance until the next pay when there's a pay plan", () => {
    // Pay expected on the 25th: the 20th-24th need covering, 5 days
    const b = balance({ nextPayDate: "2026-10-25", keepAmount: 80 })
    const stats = deriveStats(summary({ balance: b }), "2026-10", "2026-10-20")

    const budget = todayBudget(stats, monthPlan)

    expect(budget).toMatchObject({ mode: "pay", daysLeft: 5, nextPayDate: "2026-10-25", spendable: 400 })
    if (budget?.mode !== "pay") throw new Error("expected pay mode")
    expect(budget.perDay).toBe(80) // (480 - 80) / 5
    expect(budget.tomorrow).toBe(100) // 400 / 4
  })

  it("works the same whether or not the salary has come this month", () => {
    const b = balance({ nextPayDate: "2026-10-25" })
    const noSalary = deriveStats(summary({ balance: b, salary: null, savingsGoal: null }), "2026-10", "2026-10-20")

    expect(todayBudget(noSalary, null)).toMatchObject({ mode: "pay", perDay: 96 }) // 480 / 5
  })

  it("adds back only today's spending that has come off the balance", () => {
    // 3.25 everyday spending today, but the balance was entered after it, so none came off it
    const b = balance({ nextPayDate: "2026-10-21", spentSince: 0, remaining: 500 })
    const stats = deriveStats(summary({ balance: b }), "2026-10", "2026-10-16")

    const budget = todayBudget(stats, null)

    expect(budget).toMatchObject({ mode: "pay", daysLeft: 5, perDay: 100 })
  })

  it("says the pay is due once its day has come", () => {
    const b = balance({ nextPayDate: "2026-10-20" })
    const stats = deriveStats(summary({ balance: b }), "2026-10", "2026-10-20")

    expect(todayBudget(stats, monthPlan)).toEqual({ mode: "pay-due", nextPayDate: "2026-10-20" })
  })

  it("falls back to the monthly plan without a pay plan", () => {
    const stats = deriveStats(summary({ balance: balance() }), "2026-10", "2026-10-20")

    expect(todayBudget(stats, monthPlan)).toMatchObject({ mode: "month", perDay: 11.4, daysLeft: 12 })
  })

  it("uses the month for other months, even with a pay plan", () => {
    const b = balance({ nextPayDate: "2026-10-25" })
    const stats = deriveStats(summary({ month: "2026-11", balance: b }), "2026-11", "2026-10-20")

    expect(todayBudget(stats, null)?.mode).toBe("month")
  })

  it("has nothing to offer without a balance plan or a salary", () => {
    const stats = deriveStats(summary({ salary: null, savingsGoal: null }), "2026-10", "2026-10-20")

    expect(todayBudget(stats, null)).toBeNull()
  })
})
