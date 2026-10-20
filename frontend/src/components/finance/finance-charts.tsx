"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts"

import { MASK, usePrivacy } from "@/components/privacy"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart"
import type { FinanceSummary } from "@/lib/finance"
import { formatCompactMoney, formatDay, formatMonth, formatMoney } from "@/lib/format"

// Series colors follow the entity: Salary is always --chart-1 (blue), Spent always --chart-2 (orange).
const config = {
  salary: { label: "Salary", color: "var(--chart-1)" },
  // Salary-vs-spent bars: the month's salary, or the pay received when no salary was set
  paid: { label: "Salary / pay", color: "var(--chart-1)" },
  spent: { label: "Spent", color: "var(--chart-2)" },
} satisfies ChartConfig

interface TooltipRow {
  label: string
  value: string
  color?: string
}

function TooltipBox({ title, rows }: { title: string; rows: TooltipRow[] }) {
  return (
    <div className="grid min-w-40 gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium">{title}</div>
      {rows.map((row) => (
        <div key={row.label} className="flex items-center gap-2">
          {row.color && <span className="size-2.5 shrink-0 rounded-[2px]" style={{ background: row.color }} />}
          <span className="flex-1 text-muted-foreground">{row.label}</span>
          <span className="font-mono font-medium tabular-nums">{row.value}</span>
        </div>
      ))}
    </div>
  )
}

/** Chart axes and tooltips are text, not blurrable elements, so amounts are masked while hidden. */
function useChartMoney() {
  const { hidden } = usePrivacy()
  return {
    money: (v: number) => (hidden ? MASK : formatMoney(v)),
    compact: (v: number) => (hidden ? MASK : formatCompactMoney(v)),
  }
}

type DailyRow =FinanceSummary["daily"][number] & { day: number }

export function DailySpendingChart({
  daily,
  dailyBudget,
}: {
  daily: FinanceSummary["daily"]
  /** Salary spread evenly over the month; drawn as a reference line. */
  dailyBudget: number | null
}) {
  const rows: DailyRow[] = daily.map((d) => ({ ...d, day: Number(d.date.slice(8)) }))
  const { money, compact } = useChartMoney()

  return (
    <Card className="lg:col-span-3">
      <CardHeader>
        <CardTitle>Daily spending</CardTitle>
        <CardDescription>
          Total spent each day
          {dailyBudget != null && " · dashed line = daily spending budget"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="aspect-auto h-64 w-full">
          <BarChart data={rows} margin={{ top: 8, right: 8 }} barCategoryGap={2}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} interval="preserveStartEnd" minTickGap={8} />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={64}
              tickFormatter={compact}
            />
            <ChartTooltip
              cursor={{ opacity: 0.4 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const row = payload[0].payload as DailyRow
                const rowsOut: TooltipRow[] = [
                  { label: "Spent", value: money(row.total), color: "var(--color-spent)" },
                  { label: "Expenses", value: String(row.count) },
                ]
                if (dailyBudget != null) {
                  rowsOut.push({ label: "Budget left", value: money(dailyBudget - row.total) })
                }
                return <TooltipBox title={formatDay(row.date)} rows={rowsOut} />
              }}
            />
            {dailyBudget != null && (
              <ReferenceLine
                y={dailyBudget}
                stroke="var(--muted-foreground)"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                ifOverflow="extendDomain"
              />
            )}
            <Bar dataKey="total" fill="var(--color-spent)" radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

/**
 * `paid` is the bar: the month's salary if one was set, else the pay recorded as received - plus any
 * extra income.
 */
type MonthRow = FinanceSummary["history"][number] & { label: string; paid: number | null }

function monthPaid(h: FinanceSummary["history"][number]) {
  const pay = h.salary ?? h.income
  return pay + h.extraIncome > 0 ? pay + h.extraIncome : h.salary
}

export function SalaryVsSpentChart({ history }: { history: FinanceSummary["history"] }) {
  const rows: MonthRow[] = history.map((h) => ({
    ...h,
    label: formatMonth(h.month, "short"),
    paid: monthPaid(h),
  }))
  const { money, compact } = useChartMoney()

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Salary vs. spent</CardTitle>
        <CardDescription>Last 6 months</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="aspect-auto h-64 w-full">
          <BarChart data={rows} margin={{ top: 8, right: 8 }} barGap={2}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={64}
              tickFormatter={compact}
            />
            <ChartTooltip
              cursor={{ opacity: 0.4 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const row = payload[0].payload as MonthRow
                const rowsOut: TooltipRow[] = [
                  {
                    label: row.extraIncome > 0 ? "Income" : row.salary != null ? "Salary" : "Pay received",
                    value: row.paid != null ? money(row.paid) : "Not set",
                    color: "var(--color-paid)",
                  },
                  { label: "Spent", value: money(row.spent), color: "var(--color-spent)" },
                ]
                if (row.extraIncome > 0) {
                  rowsOut.push({ label: "Of which extra", value: money(row.extraIncome) })
                }
                if (row.savingsGoal != null) {
                  rowsOut.push({ label: "Savings goal", value: money(row.savingsGoal) })
                }
                if (row.paid != null) {
                  rowsOut.push({ label: "Saved", value: money(row.paid - row.spent) })
                }
                return <TooltipBox title={formatMonth(row.month)} rows={rowsOut} />
              }}
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="paid" fill="var(--color-paid)" radius={[4, 4, 0, 0]} maxBarSize={24} />
            <Bar dataKey="spent" fill="var(--color-spent)" radius={[4, 4, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
