"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import * as Popover from "@radix-ui/react-popover"
import { Pin, PinOff, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { CONTROL_SHAPE } from "@/components/ui/control"
import { SelectMenu } from "@/components/ui/select-menu"
import { t } from "@/i18n/t"
import { bagSignature, chipParts, defaultOp, isComplete, isValueless, opsOf, orderFacetOptions, withoutKey, type Cond, type FilterBag, type FilterDef, type Op } from "./filters"

export type Facets = Record<string, number> | null
/** Counts of a choice field's values under the other filters; null when they cannot be read (shown as «—»). */
export type FacetSource = (def: FilterDef, others: FilterBag) => Promise<Facets>

const opText = (op: Op) => t(`admin.table.op.${op}`)
const daysAgo = (days: number) => new Date(Date.now() - days * 86400e3).toISOString().slice(0, 10)
const countText = (count: number | null | undefined) => count === undefined ? "·" : count === null ? "—" : String(count)

function useFacets(def: FilterDef, bag: FilterBag, source: FacetSource | undefined, enabled: boolean) {
  const others = withoutKey(bag, def.key)
  const signature = `${def.key}|${bagSignature(others)}`
  const [state, setState] = useState<{ signature: string; counts: Facets } | null>(null)
  const latest = useRef({ others, def })
  useEffect(() => { latest.current = { others, def } })
  useEffect(() => {
    if (!enabled || !source || def.type !== "choice") return
    let active = true
    source(latest.current.def, latest.current.others).then((counts) => { if (active) setState({ signature, counts }) }).catch(() => { if (active) setState({ signature, counts: null }) })
    return () => { active = false }
  }, [enabled, source, signature, def.type, def])
  if (!source) return null
  return state?.signature === signature ? state.counts : undefined
}

function Editor({ def, cond, bag, facets, onChange }: { def: FilterDef; cond: Cond | undefined; bag: FilterBag; facets?: FacetSource; onChange: (cond: Cond | undefined) => void }) {
  const ops = opsOf(def)
  const op = cond?.op ?? defaultOp(def)
  const [draft, setDraft] = useState(cond?.v[0] ?? "")
  const [dates, setDates] = useState<string[]>(cond?.v ?? [])
  const setDate = (index: number, value: string) => { const next = [...dates]; next[index] = value; setDates(next); apply({ op, v: next }) }
  const counts = useFacets(def, bag, facets, true)
  const values = cond?.v ?? []
  const apply = (next: Cond | undefined) => onChange(next && isComplete(next) ? next : undefined)
  return <div className="flex w-72 max-w-full flex-col gap-3">
    {ops.length > 1 && <SelectMenu value={op} onChange={(next) => { const o = next as Op; apply({ op: o, v: isValueless(o) ? [] : values }) }} ariaLabel={t("admin.table.filterOperator")}
      options={ops.map((o) => ({ value: o, label: opText(o) }))} className="text-sm" />}
    {!isValueless(op) && def.type === "choice" && <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto">
      {orderFacetOptions(def.options ?? [], counts).map((option) => <li key={option.value} className="flex items-center justify-between gap-3">
        <Checkbox checked={values.includes(option.value)} label={option.label} onChange={() => {
          const next = def.single ? (values.includes(option.value) ? [] : [option.value]) : values.includes(option.value) ? values.filter((x) => x !== option.value) : [...values, option.value]
          apply({ op, v: next })
        }} />
        <span className={`text-xs tabular-nums text-muted-foreground ${option.count === 0 ? "opacity-50" : ""}`}>{countText(option.count)}</span>
      </li>)}
    </ul>}
    {!isValueless(op) && def.type === "boolean" && <div role="radiogroup" className="flex gap-2">
      {["true", "false"].map((value) => <Button key={value} type="button" role="radio" aria-checked={values[0] === value} variant={values[0] === value ? "default" : "outline"} size="sm"
        onClick={() => apply({ op: "is", v: [value] })}>{t(value === "true" ? "admin.table.yes" : "admin.table.no")}</Button>)}
    </div>}
    {def.type === "date" && <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">{[7, 30, 90].map((days) => <Button key={days} type="button" variant="outline" size="sm" onClick={() => { setDates([daysAgo(days)]); apply({ op: "after", v: [daysAgo(days)] }) }}>{t("admin.table.lastDays", { count: days })}</Button>)}</div>
      <Input type="date" value={dates[0] ?? ""} aria-label={t(op === "between" ? "admin.table.dateFrom" : "admin.table.date")} onChange={(event) => setDate(0, event.target.value)} />
      {op === "between" && <Input type="date" value={dates[1] ?? ""} aria-label={t("admin.table.dateTo")} onChange={(event) => setDate(1, event.target.value)} />}
    </div>}
    {!isValueless(op) && (def.type === "number" || def.type === "text") && <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); apply({ op, v: [draft.trim()] }) }}>
      <Input value={draft} inputMode={def.type === "number" ? "numeric" : undefined} onChange={(event) => setDraft(event.target.value)} aria-label={def.label} />
      <Button type="submit" size="sm" className="h-10" disabled={draft.trim() === ""}>{t("admin.table.apply")}</Button>
    </form>}
  </div>
}

/**
 * Composable filters (the model of nexus FilterControls.jsx): each active filter is a chip with its editor (operator +
 * value by type); «+ Додати фільтр» opens a searchable list of the table's fields; a chip can be pinned so it stays even
 * with no value. The page declares its fields once (FilterDef); the bag lives in the address (`f.<key>`).
 */
export function FilterBar({ defs, bag, onChange, pinned, onPinned, facets }: {
  defs: readonly FilterDef[]
  bag: FilterBag
  onChange: (bag: FilterBag) => void
  pinned: string[]
  onPinned: (keys: string[]) => void
  facets?: FacetSource
}) {
  const [pending, setPending] = useState<string[]>([])
  const [open, setOpen] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [search, setSearch] = useState("")
  const byKey = useMemo(() => new Map(defs.map((d) => [d.key, d])), [defs])
  const chipKeys = [...new Set([...pinned, ...Object.keys(bag), ...pending])].filter((key) => byKey.has(key))
  const addable = defs.filter((d) => !chipKeys.includes(d.key) && d.label.toLowerCase().includes(search.trim().toLowerCase()))

  function set(def: FilterDef, cond: Cond | undefined) {
    const next = { ...bag }
    if (cond) next[def.key] = cond
    else delete next[def.key]
    onChange(next)
    if (cond) setPending((keys) => keys.filter((key) => key !== def.key))
  }
  // Clearing a chip drops its value and, unless it is pinned, the chip itself.
  function clear(def: FilterDef) {
    set(def, undefined)
    setPending((keys) => keys.filter((key) => key !== def.key))
    if (open === def.key) setOpen(null)
  }

  return <div className="flex min-w-0 flex-wrap items-center gap-2" role="group" aria-label={t("admin.table.filters")}>
    {chipKeys.map((key) => {
      const def = byKey.get(key)!
      const cond = bag[key]
      const parts = chipParts(def, cond, opText, t("admin.table.yes"), t("admin.table.no"), t("admin.table.any"))
      const isPinned = pinned.includes(key)
      return <Popover.Root key={key} open={open === key} onOpenChange={(next) => setOpen(next ? key : null)}>
        <span className={`inline-flex items-center overflow-hidden ${CONTROL_SHAPE}`} data-filter={key}>
          <Popover.Trigger asChild>
            <button type="button" className="inline-flex h-full max-w-64 items-center gap-1.5 truncate pl-3 pr-2 hover:bg-accent" aria-label={t("admin.table.filterEdit", { name: def.label })}>
              <span className="font-medium">{parts.key}</span>{parts.op && <span className="text-muted-foreground">{parts.op}</span>}<span className={cond ? "truncate" : "truncate text-muted-foreground"}>{parts.value}</span>
            </button>
          </Popover.Trigger>
          <button type="button" className="inline-flex h-full w-8 items-center justify-center text-muted-foreground hover:bg-accent" aria-label={t(isPinned ? "admin.table.filterUnpin" : "admin.table.filterPin", { name: def.label })} onClick={() => onPinned(isPinned ? pinned.filter((k) => k !== key) : [...pinned, key])}>
            {isPinned ? <PinOff aria-hidden="true" className="h-3.5 w-3.5" /> : <Pin aria-hidden="true" className="h-3.5 w-3.5" />}
          </button>
          <button type="button" className="inline-flex h-full w-8 items-center justify-center text-muted-foreground hover:bg-accent" aria-label={t("admin.table.filterRemove", { name: def.label })} onClick={() => clear(def)}>
            <X aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
        </span>
        <Popover.Portal>
          <Popover.Content align="start" sideOffset={6} collisionPadding={12} className="z-50 rounded-lg border border-border bg-popover p-3 text-popover-foreground outline-none">
            <Editor def={def} cond={cond} bag={bag} facets={facets} onChange={(next) => set(def, next)} />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    })}
    <Popover.Root open={adding} onOpenChange={(next) => { setAdding(next); if (!next) setSearch("") }}>
      <Popover.Trigger asChild>
        <Button type="button" variant="outline" className="text-sm" disabled={defs.every((d) => chipKeys.includes(d.key)) && !adding}><Plus aria-hidden="true" className="mr-1.5 h-4 w-4" />{t("admin.table.addFilter")}</Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={6} collisionPadding={12} className="z-50 flex max-h-[min(70dvh,26rem)] w-72 max-w-full flex-col gap-2 rounded-lg border border-border bg-popover p-3 text-popover-foreground outline-none">
          <Input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("admin.table.addFilterSearch")} aria-label={t("admin.table.addFilterSearch")} />
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {addable.length === 0 && <li className="px-2 py-3 text-sm text-muted-foreground">{t("admin.table.addFilterNone")}</li>}
            {addable.map((def) => <li key={def.key}>
              <button type="button" className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-accent"
                onClick={() => { setPending((keys) => [...keys, def.key]); setAdding(false); setSearch(""); setOpen(def.key) }}>
                <span>{def.label}</span><span className="text-xs text-muted-foreground">{countText(null)}</span>
              </button>
            </li>)}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  </div>
}
