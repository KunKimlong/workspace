"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts"

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

type DailyRow = FinanceSummary["daily"][number] & { day: number }

export function DailySpendingChart({
  daily,
  dailyBudget,
}: {
  daily: FinanceSummary["daily"]
  /** Salary spread evenly over the month; drawn as a reference line. */
  dailyBudget: number | null
}) {
  const rows: DailyRow[] = daily.map((d) => ({ ...d, day: Number(d.date.slice(8)) }))

  return (
    <Card className="lg:col-span-3">
      <CardHeader>
        <CardTitle>Daily spending</CardTitle>
        <CardDescription>
          Total spent each day
          {dailyBudget != null && <> · dashed line = daily spending budget ({formatMoney(dailyBudget)})</>}
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
              tickFormatter={(v: number) => formatCompactMoney(v)}
            />
            <ChartTooltip
              cursor={{ opacity: 0.4 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const row = payload[0].payload as DailyRow
                const rowsOut: TooltipRow[] = [
                  { label: "Spent", value: formatMoney(row.total), color: "var(--color-spent)" },
                  { label: "Expenses", value: String(row.count) },
                ]
                if (dailyBudget != null) {
                  rowsOut.push({ label: "Budget left", value: formatMoney(dailyBudget - row.total) })
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

type MonthRow = FinanceSummary["history"][number] & { label: string }

export function SalaryVsSpentChart({ history }: { history: FinanceSummary["history"] }) {
  const rows: MonthRow[] = history.map((h) => ({ ...h, label: formatMonth(h.month, "short") }))

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
              tickFormatter={(v: number) => formatCompactMoney(v)}
            />
            <ChartTooltip
              cursor={{ opacity: 0.4 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const row = payload[0].payload as MonthRow
                const rowsOut: TooltipRow[] = [
                  {
                    label: "Salary",
                    value: row.salary != null ? formatMoney(row.salary) : "Not set",
                    color: "var(--color-salary)",
                  },
                  { label: "Spent", value: formatMoney(row.spent), color: "var(--color-spent)" },
                ]
                if (row.savingsGoal != null) {
                  rowsOut.push({ label: "Savings goal", value: formatMoney(row.savingsGoal) })
                }
                if (row.salary != null) {
                  rowsOut.push({ label: "Saved", value: formatMoney(row.salary - row.spent) })
                }
                return <TooltipBox title={formatMonth(row.month)} rows={rowsOut} />
              }}
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="salary" fill="var(--color-salary)" radius={[4, 4, 0, 0]} maxBarSize={24} />
            <Bar dataKey="spent" fill="var(--color-spent)" radius={[4, 4, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
