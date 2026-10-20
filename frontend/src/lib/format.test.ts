import { describe, expect, it } from "vitest"

import {
  addDays,
  daysBetween,
  daysInMonth,
  formatMoney,
  initials,
  parseLocalDate,
  shiftMonth,
  toISODate,
} from "@/lib/format"

describe("dates", () => {
  it("parses yyyy-MM-dd as a local day, with no UTC shift", () => {
    const d = parseLocalDate("2026-03-01")
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 2, 1])
    expect(toISODate(d)).toBe("2026-03-01")
  })

  it("treats yyyy-MM as the first of the month", () => {
    expect(toISODate(parseLocalDate("2026-10"))).toBe("2026-10-01")
  })

  it("shifts months across year boundaries", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12")
    expect(shiftMonth("2025-12", 1)).toBe("2026-01")
    expect(shiftMonth("2026-03", -6)).toBe("2025-09")
  })

  it("counts whole days between dates, across months", () => {
    expect(daysBetween("2026-10-20", "2026-10-25")).toBe(5)
    expect(daysBetween("2026-10-30", "2026-11-02")).toBe(3)
    expect(daysBetween("2026-10-25", "2026-10-20")).toBe(-5)
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01")
  })

  it("knows month lengths, including leap years", () => {
    expect(daysInMonth("2026-02")).toBe(28)
    expect(daysInMonth("2028-02")).toBe(29)
    expect(daysInMonth("2026-10")).toBe(31)
    expect(daysInMonth("2026-11")).toBe(30)
  })
})

describe("text", () => {
  it("formats money in the configured currency", () => {
    expect(formatMoney(1234.5)).toBe("$1,234.50")
  })

  it("takes up to two initials", () => {
    expect(initials("Kim Long Kun")).toBe("KL")
    expect(initials("admin")).toBe("A")
  })
})
