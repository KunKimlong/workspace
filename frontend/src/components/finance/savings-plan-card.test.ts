import { describe, expect, it } from "vitest"

import { computePlan, type SavingsPlanInput } from "@/components/finance/savings-plan-card"
import { dailyLimit, tomorrowLimit } from "@/lib/finance-stats"

// October, viewed on the 20th: 12 days left including today
const october: SavingsPlanInput = {
  salary: 270,
  goal: 100,
  spent: 33.25,
  todaySpent: 0,
  todaySpecial: 0,
  totalDays: 31,
  daysElapsed: 20,
  daysLeft: 12,
  timing: "current",
  specialSpent: 30,
}

describe("dailyLimit", () => {
  it("spreads what's left over the days left", () => {
    expect(dailyLimit(136.75, 0, 12)).toBeCloseTo(11.396, 3)
  })

  it("doesn't shrink as you spend today - today's spending is measured against it", () => {
    // Spending 5 today lowers what's left by 5 but adds it back, so the limit stays put
    expect(dailyLimit(131.75, 5, 12)).toBeCloseTo(dailyLimit(136.75, 0, 12))
  })

  it("never goes below zero", () => {
    expect(dailyLimit(-50, 0, 10)).toBe(0)
  })
})

describe("tomorrowLimit", () => {
  it("spreads what's left over the days after today", () => {
    expect(tomorrowLimit(136.75, 12)).toBeCloseTo(12.43, 2)
  })

  it("is null on the last day of the month", () => {
    expect(tomorrowLimit(100, 1)).toBeNull()
  })

  it("is zero when over budget", () => {
    expect(tomorrowLimit(-20, 5)).toBe(0)
  })
})

describe("computePlan", () => {
  it("needs both a salary and a goal", () => {
    expect(computePlan({ ...october, goal: null })).toBeNull()
    expect(computePlan({ ...october, salary: null })).toBeNull()
  })

  it("works out the budget, what's left and the daily limit", () => {
    const plan = computePlan(october)!
    expect(plan.budget).toBe(170)
    expect(plan.leftToSpend).toBeCloseTo(136.75)
    expect(plan.perDay).toBeCloseTo(11.4, 2)
    expect(plan.usedPct).toBeCloseTo(0.1956, 3)
  })

  it("counts extra income as more to spend while keeping the goal", () => {
    const plan = computePlan({ ...october, extraIncome: 24 })!
    expect(plan.budget).toBe(194)
    expect(plan.leftToSpend).toBeCloseTo(160.75)
    expect(plan.perDay).toBeCloseTo(160.75 / 12, 4) // 2 more a day than without it
  })

  it("projects only everyday spending forward, not one-off special spending", () => {
    // 3.25 everyday over 20 days, so 0.1625/day for the 11 days after today
    const plan = computePlan(october)!
    expect(plan.projectedSavings).toBeCloseTo(270 - (33.25 + 0.1625 * 11), 4)
    expect(plan.status).toBe("on-track")
  })

  it("flags at-risk when the pace misses the goal", () => {
    expect(computePlan({ ...october, spent: 150, specialSpent: 0 })!.status).toBe("at-risk")
  })

  it("flags over budget once spending passes salary minus goal", () => {
    expect(computePlan({ ...october, spent: 180 })!.status).toBe("over")
  })

  it("judges past months on what actually happened", () => {
    const past = { ...october, timing: "past" as const, daysLeft: 0, daysElapsed: 31 }
    expect(computePlan({ ...past, spent: 150 })!.status).toBe("reached")
    expect(computePlan({ ...past, spent: 171 })!.status).toBe("missed")
    expect(computePlan(past)!.perDay).toBeNull()
  })

  it("shows future months as planned", () => {
    expect(computePlan({ ...october, timing: "future", spent: 0, daysElapsed: 0, daysLeft: 31 })!.status).toBe(
      "planned"
    )
  })
})
