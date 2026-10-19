import { request } from "@/lib/api"

export interface Expense {
  id: number
  date: string // yyyy-MM-dd
  amount: number
  reason: string
}

export type ExpenseInput = Omit<Expense, "id">

export interface FinanceSummary {
  month: string // yyyy-MM
  salary: number | null
  /** Planned savings for the month, or null when no goal is set. */
  savingsGoal: number | null
  totalSpent: number
  expenseCount: number
  /** One entry per day of the month, including days with nothing spent. */
  daily: { date: string; total: number; count: number }[]
  /** The 6 months ending at `month`, oldest first. */
  history: { month: string; salary: number | null; savingsGoal: number | null; spent: number }[]
  /** Special spending planned for the month (fuel, soap, a bill...). */
  planned: PlannedExpense[]
  /** Items used in any month before, newest first, with the latest amount - so it needn't be remembered. */
  plannedSuggestions: PlannedSuggestion[]
  /** Not tied to the month: the money the user has, or null if never entered. */
  balance: Balance | null
}

export interface Balance {
  /** What the user entered. */
  amount: number
  /** When they entered it (ISO instant). */
  setAt: string
  /** Expenses added since then (dated that day or later). */
  spentSince: number
  remaining: number
}

export interface PlannedSuggestion {
  name: string
  amount: number
  /** Month it was last used, yyyy-MM. */
  month: string
}

/** A one-off cost (fuel, soap, a bill...). It's spent as soon as it's entered - it records an expense. */
export interface PlannedExpense {
  id: number
  name: string
  amount: number
  date: string | null // yyyy-MM-dd
  expenseId: number | null
}

export type PlannedInput = { name: string; amount: number; date: string }

const json = (method: string, body: unknown): RequestInit => ({
  method,
  body: JSON.stringify(body),
})

export const financeApi = {
  summary: (month: string) => request<FinanceSummary>(`/finance/summary?month=${month}`),
  setSalary: (month: string, amount: number, savingsGoal: number | null) =>
    request<{ month: string; amount: number; savingsGoal: number | null }>(
      `/finance/salary/${month}`,
      json("PUT", { amount, savingsGoal })
    ),
  clearSalary: (month: string) =>
    request<void>(`/finance/salary/${month}`, { method: "DELETE" }),

  setBalance: (amount: number) => request<Balance>("/finance/balance", json("PUT", { amount })),
  clearBalance: () => request<void>("/finance/balance", { method: "DELETE" }),

  expenses: (month: string) => request<Expense[]>(`/finance/expenses?month=${month}`),
  addExpense: (data: ExpenseInput) => request<Expense>("/finance/expenses", json("POST", data)),
  updateExpense: (id: number, data: ExpenseInput) =>
    request<Expense>(`/finance/expenses/${id}`, json("PUT", data)),
  deleteExpense: (id: number) =>
    request<void>(`/finance/expenses/${id}`, { method: "DELETE" }),

  addPlanned: (data: PlannedInput) => request<PlannedExpense>("/finance/planned", json("POST", data)),
  updatePlanned: (id: number, data: PlannedInput) =>
    request<PlannedExpense>(`/finance/planned/${id}`, json("PUT", data)),
  /** Also deletes the expense it recorded. */
  deletePlanned: (id: number) =>
    request<void>(`/finance/planned/${id}`, { method: "DELETE" }),
}

export const specialTotal = (items: PlannedExpense[]) => items.reduce((sum, p) => sum + p.amount, 0)
