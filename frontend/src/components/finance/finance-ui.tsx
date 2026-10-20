"use client"

import { useMemo } from "react"
import type { IconType } from "react-icons"
import { LuPencil, LuPlus, LuTrash2 } from "react-icons/lu"

import { useFinance } from "@/components/finance/finance-context"
import { MonthPicker } from "@/components/finance/month-picker"
import { Private } from "@/components/privacy"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { Expense } from "@/lib/finance"
import { currentMonth, formatDay, formatMoney, todayISO } from "@/lib/format"
import { cn } from "@/lib/utils"

/** Title row shared by the Finance pages: month picker and "Add expense" on the right. */
export function FinancePageHeader({ title, description }: { title: string; description: string }) {
  const { month, setMonth, stats, openExpense } = useFinance()
  const thisMonth = currentMonth()
  const isFuture = month > thisMonth
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <MonthPicker value={month} onChange={setMonth} />
        {month !== thisMonth && (
          <Button variant="outline" onClick={() => setMonth(thisMonth)}>
            This month
          </Button>
        )}
        <Button
          onClick={() => openExpense()}
          disabled={isFuture || !stats}
          title={isFuture ? "You can't add spending to a future month" : undefined}
        >
          <LuPlus /> Add expense
        </Button>
      </div>
    </div>
  )
}

export function FinancePageSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: cards }).map((_, i) => (
        <Skeleton key={i} className="h-36 rounded-xl" />
      ))}
      <Skeleton className="h-80 rounded-xl sm:col-span-2 xl:col-span-4" />
    </div>
  )
}

const ACCENTS = {
  salary: "bg-chart-1/12 text-chart-1",
  spent: "bg-chart-2/12 text-chart-2",
  remaining: "bg-success/12 text-success",
  balance: "bg-primary/12 text-brand-text",
  neutral: "bg-muted text-muted-foreground",
}

/** One headline number: label, value, a single line of context and an optional footer. */
export function StatCard({
  title,
  value,
  suffix,
  hint,
  icon: Icon,
  accent = "neutral",
  tone,
  sensitive,
  children,
}: {
  title: string
  value: string
  /** Blur the value while amounts are hidden. */
  sensitive?: boolean
  /** Small unit after the value, e.g. "/ day". */
  suffix?: string
  hint?: React.ReactNode
  icon: IconType
  /** Icon chip color - matches the series color the number belongs to. */
  accent?: keyof typeof ACCENTS
  tone?: "negative"
  /** Footer content such as a progress bar or an action button. */
  children?: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription className="font-medium">{title}</CardDescription>
        <CardTitle
          className={cn(
            "mt-1 text-[1.75rem] leading-none font-bold tracking-tight tabular-nums",
            tone === "negative" && "text-destructive"
          )}
        >
          {sensitive ? <Private>{value}</Private> : value}
          {suffix &&<span className="ml-1 text-sm font-semibold text-muted-foreground">{suffix}</span>}
        </CardTitle>
        <CardAction>
          <span className={cn("flex size-10 items-center justify-center rounded-xl", ACCENTS[accent])}>
            <Icon className="size-5" />
          </span>
        </CardAction>
      </CardHeader>
      {/* Hint sits right under the number; buttons and bars are pinned to the bottom so cards line up */}
      <CardContent className="flex flex-1 flex-col gap-3 text-xs text-muted-foreground">
        {hint && <p>{hint}</p>}
        {children && <div className="mt-auto grid gap-2">{children}</div>}
      </CardContent>
    </Card>
  )
}

export function ProgressBar({ value, label, danger }: { value: number; label: string; danger?: boolean }) {
  const pct = Math.min(Math.max(value, 0), 100)
  return (
    <div
      className="h-1.5 overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className={cn("h-full rounded-full", danger ? "bg-destructive" : "bg-chart-2")} style={{ width: `${pct}%` }} />
    </div>
  )
}

/** Expenses grouped by day (newest first) with day totals, edit and delete. */
export function ExpensesTable({ expenses, limit }: { expenses: Expense[]; limit?: number }) {
  const { summary, stats, openExpense, deleteExpense } = useFinance()
  const specialIds = useMemo(
    () => new Set((summary?.planned ?? []).map((p) => p.expenseId).filter((id): id is number => id != null)),
    [summary]
  )
  const groups = useMemo(() => {
    const map = new Map<string, Expense[]>()
    for (const e of limit ? expenses.slice(0, limit) : expenses) map.set(e.date, [...(map.get(e.date) ?? []), e])
    return [...map.entries()].map(([date, items]) => ({
      date,
      items,
      // Day total covers the whole day even when the list is cut short
      total: expenses.filter((e) => e.date === date).reduce((sum, e) => sum + e.amount, 0),
    }))
  }, [expenses, limit])

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-4">Reason</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead className="w-20" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map((group) => (
          <DayGroup
            key={group.date}
            {...group}
            isToday={group.date === stats?.today}
            specialIds={specialIds}
            onEdit={openExpense}
            onDelete={deleteExpense}
          />
        ))}
      </TableBody>
    </Table>
  )
}

function DayGroup({
  date,
  items,
  total,
  isToday,
  specialIds,
  onEdit,
  onDelete,
}: {
  date: string
  items: Expense[]
  total: number
  isToday: boolean
  specialIds: Set<number>
  onEdit: (e: Expense) => void
  onDelete: (e: Expense) => void
}) {
  const canChange = date >= todayISO()
  return (
    <>
      <TableRow className="bg-muted/50 hover:bg-muted/50">
        <TableCell className="pl-4 font-medium">
          {formatDay(date)}
          {isToday && <span className="ml-2 text-xs font-normal text-muted-foreground">Today</span>}
        </TableCell>
        <TableCell className="text-right font-medium tabular-nums">{formatMoney(total)}</TableCell>
        <TableCell />
      </TableRow>
      {items.map((e) => (
        <TableRow key={e.id}>
          <TableCell className="pl-8 whitespace-normal">
            {e.reason}
            {specialIds.has(e.id) && (
              <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-brand-text">
                Special
              </span>
            )}
          </TableCell>
          <TableCell className="text-right text-muted-foreground tabular-nums">{formatMoney(e.amount)}</TableCell>
          <TableCell className="pr-4">
            <div className="flex justify-end gap-1">
              {/* Only today's spending can be changed; earlier days are locked (the backend enforces it too) */}
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={canChange ? `Edit ${e.reason}` : `${e.reason} is from a past day and can't be edited`}
                title={canChange ? undefined : "Spending from past days is locked"}
                disabled={!canChange}
                onClick={() => onEdit(e)}
              >
                <LuPencil />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-destructive"
                aria-label={canChange ? `Delete ${e.reason}` : `${e.reason} is from a past day and can't be deleted`}
                title={canChange ? undefined : "Spending from past days is locked"}
                disabled={!canChange}
                onClick={() => onDelete(e)}
              >
                <LuTrash2 />
              </Button>
            </div>
          </TableCell>
        </TableRow>
      ))}
    </>
  )
}
