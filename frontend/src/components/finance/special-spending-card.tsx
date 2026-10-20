"use client"

import { useState } from "react"
import type { IconType } from "react-icons"
import {
  LuCar,
  LuClipboardList,
  LuDroplets,
  LuFlame,
  LuFuel,
  LuHouse,
  LuPencil,
  LuPlus,
  LuReceipt,
  LuShoppingBasket,
  LuSmartphone,
  LuSprayCan,
  LuTrash2,
  LuWifi,
  LuZap,
} from "react-icons/lu"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { COMMON_SPECIAL_ITEMS, SpecialSpendingDialog } from "@/components/finance/special-spending-dialog"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { financeApi, type PlannedExpense, type PlannedSuggestion } from "@/lib/finance"
import { currentMonth, formatDay, formatMoney, formatMonth, todayISO } from "@/lib/format"

// First matching keyword picks the icon; anything else gets a receipt
const ICONS: [RegExp, IconType][] = [
  [/fuel|petrol|gasoline|diesel/i, LuFuel],
  [/electric|power/i, LuZap],
  [/water/i, LuDroplets],
  [/soap|detergent|shampoo|clean/i, LuSprayCan],
  [/gas|cooking/i, LuFlame],
  [/rent|house|home/i, LuHouse],
  [/internet|wifi/i, LuWifi],
  [/phone|mobile/i, LuSmartphone],
  [/grocer|food|market|rice/i, LuShoppingBasket],
  [/car|moto|bike|parking|taxi/i, LuCar],
]

const iconFor = (name: string) => ICONS.find(([re]) => re.test(name))?.[1] ?? LuReceipt

export function SpecialSpendingCard({
  month,
  items,
  suggestions,
  defaultDate,
  canAdd,
  onChanged,
}: {
  month: string
  items: PlannedExpense[]
  /** Every item used before, with its latest amount. */
  suggestions: PlannedSuggestion[]
  /** Pre-filled date for new items (today, or a day inside the viewed month). */
  defaultDate: string
  /** False for future months - spending can't be dated after today. */
  canAdd: boolean
  onChanged: () => void
}) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<PlannedExpense | null>(null)
  const [defaultName, setDefaultName] = useState<string | undefined>()
  const [deleting, setDeleting] = useState<PlannedExpense | null>(null)

  // Like expenses, items from past days are locked (the backend enforces it too); an item that lost its
  // expense has no date, so its month decides
  const today = todayISO()
  const isLocked = (item: PlannedExpense) => (item.date ? item.date < today : month < currentMonth())
  const sorted = [...items].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || b.id - a.id)
  // Quick add: everything used before (with its last amount), then common items not used yet
  const chips: { name: string; amount?: number }[] = [
    ...suggestions,
    ...COMMON_SPECIAL_ITEMS.filter(
      (s) => !suggestions.some((x) => x.name.toLowerCase() === s.toLowerCase())
    ).map((name) => ({ name })),
  ]

  function openAdd(name?: string) {
    setEditing(null)
    setDefaultName(name)
    setDialogOpen(true)
  }

  function openEdit(item: PlannedExpense) {
    setEditing(item)
    setDefaultName(undefined)
    setDialogOpen(true)
  }

  async function handleDelete() {
    if (!deleting) return
    try {
      await financeApi.deletePlanned(deleting.id)
      toast.success(`${deleting.name} deleted`)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete")
    } finally {
      setDeleting(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary/12 text-brand-text">
            <LuClipboardList className="size-5" />
          </span>
          Special spending
        </CardTitle>
        <CardDescription>
          One-off costs like fuel, soap or a bill - only in the months you need them.
        </CardDescription>
        {canAdd && (
          <CardAction>
            <Button variant="outline" size="sm" onClick={() => openAdd()}>
              <LuPlus /> Add
            </Button>
          </CardAction>
        )}
      </CardHeader>

      <CardContent className="grid gap-5">
        {canAdd && (
        <div className="grid gap-2">
          <p className="text-xs font-medium text-muted-foreground">
            Quick add{suggestions.length > 0 && " - amount from last time is filled in"}
          </p>
          <div className="flex flex-wrap gap-2">
            {chips.map((chip) => {
              const Icon = iconFor(chip.name)
              return (
                <Button key={chip.name} variant="outline" size="sm" onClick={() => openAdd(chip.name)}>
                  <Icon /> {chip.name}
                  {chip.amount != null && (
                    <span className="font-normal text-muted-foreground tabular-nums">
                      {formatMoney(chip.amount)}
                    </span>
                  )}
                </Button>
              )
            })}
          </div>
        </div>
        )}

        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            {canAdd
              ? `No special spending in ${formatMonth(month)}.`
              : `${formatMonth(month)} hasn't started yet - special spending can only be added up to today.`}
          </p>
        ) : (
          <div className="grid gap-3">
            <p className="text-sm">
              <span className="text-muted-foreground">
                {items.length} special item{items.length === 1 ? "" : "s"} in {formatMonth(month)}
              </span>
            </p>
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),1fr))] gap-3">
              {sorted.map((item) => {
                const Icon = iconFor(item.name)
                const locked = isLocked(item)
                return (
                  <li key={item.id} className="flex items-center gap-3 rounded-xl border p-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-chart-2/12 text-chart-2">
                      <Icon className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{item.name}</p>
                      <p className="text-sm text-muted-foreground tabular-nums">
                        {formatMoney(item.amount)}
                        {item.date && <> · {formatDay(item.date)}</>}
                      </p>
                    </div>
                    <div className="-mr-1 flex">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={locked ? `${item.name} is from a past day and can't be edited` : `Edit ${item.name}`}
                        title={locked ? "Special spending from past days is locked" : undefined}
                        disabled={locked}
                        onClick={() => openEdit(item)}
                      >
                        <LuPencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:text-destructive"
                        aria-label={locked ? `${item.name} is from a past day and can't be deleted` : `Delete ${item.name}`}
                        title={locked ? "Special spending from past days is locked" : undefined}
                        disabled={locked}
                        onClick={() => setDeleting(item)}
                      >
                        <LuTrash2 />
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </CardContent>

      <SpecialSpendingDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        item={editing}
        defaultName={defaultName}
        defaultDate={defaultDate}
        suggestions={suggestions}
        onSaved={onChanged}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name ?? "item"}?`}
        description={
          deleting ? `${formatMoney(deleting.amount)} - it's removed from your expenses too.` : ""
        }
        onConfirm={handleDelete}
      />
    </Card>
  )
}
