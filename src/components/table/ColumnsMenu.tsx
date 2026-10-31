"use client"

import { useRef, useState } from "react"
import * as Popover from "@radix-ui/react-popover"
import { Columns3, GripVertical, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { t } from "@/i18n/t"
import { columnsMenuList, insertionIndex, moveCol, moveColBy, toggleCol } from "./columns"

/**
 * The «Колонки» menu (the mechanics of nexus ColumnsMenu.jsx): every column of the table, the shown ones in their order,
 * then the hidden ones; search; a box shows or hides a column; a grip handle drags it (pointer events: mouse and touch
 * alike, a line marks the drop place; Alt+↑/↓ on a focused handle moves it); the identity column stays first and locked.
 */
export function ColumnsMenu({ cols, allKeys, identity, label, onChange, onReset, resettable }: {
  cols: string[]
  allKeys: readonly string[]
  identity: string
  label: (key: string) => string
  onChange: (cols: string[]) => void
  onReset: () => void
  resettable: boolean
}) {
  const [search, setSearch] = useState("")
  const [drag, setDrag] = useState<{ key: string; to: number } | null>(null)
  const rows = useRef(new Map<string, HTMLLIElement>())
  const list = columnsMenuList(cols, allKeys, identity)
  const needle = search.trim().toLowerCase()
  const shown = needle ? list.filter((entry) => label(entry.key).toLowerCase().includes(needle)) : list
  const shownKeys = list.filter((entry) => entry.on).map((entry) => entry.key)

  function rects() {
    return shownKeys.map((key) => rows.current.get(key)?.getBoundingClientRect() ?? { top: 0, bottom: 0 })
  }
  function start(event: React.PointerEvent<HTMLButtonElement>, key: string) {
    if (needle) return
    event.currentTarget.setPointerCapture(event.pointerId)
    setDrag({ key, to: cols.indexOf(key) })
  }
  function move(event: React.PointerEvent<HTMLButtonElement>) {
    if (drag) setDrag({ key: drag.key, to: insertionIndex(rects(), event.clientY) })
  }
  function end(event: React.PointerEvent<HTMLButtonElement>) {
    if (!drag) return
    event.currentTarget.releasePointerCapture(event.pointerId)
    onChange(moveCol(cols, drag.key, drag.to, identity))
    setDrag(null)
  }
  function keys(event: React.KeyboardEvent<HTMLButtonElement>, key: string) {
    if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return
    event.preventDefault()
    onChange(moveColBy(cols, key, event.key === "ArrowUp" ? -1 : 1, identity))
  }

  return <Popover.Root onOpenChange={(open) => { if (!open) { setSearch(""); setDrag(null) } }}>
    <Popover.Trigger asChild>
      <Button type="button" variant="outline" className="h-10 shrink-0 text-sm"><Columns3 aria-hidden="true" className="mr-2 h-4 w-4" />{t("admin.table.columns")}</Button>
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Content align="end" sideOffset={6} collisionPadding={12} aria-label={t("admin.table.columns")}
        className="z-50 flex max-h-[min(70dvh,32rem)] w-[min(20rem,calc(100vw-1.5rem))] flex-col gap-2 rounded-lg border border-border bg-popover p-3 text-popover-foreground outline-none">
        <Input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("admin.table.columnsSearch")} aria-label={t("admin.table.columnsSearch")} />
        <ul className="relative min-h-0 flex-1 overflow-y-auto">
          {shown.map((entry) => {
            const index = shownKeys.indexOf(entry.key)
            const line = drag && !needle && entry.on && drag.to === index
            return <li key={entry.key} ref={(node) => { if (node) rows.current.set(entry.key, node); else rows.current.delete(entry.key) }}
              className={`relative flex items-center gap-2 rounded-md px-1 py-1 ${drag?.key === entry.key ? "bg-accent" : ""}`}>
              {line && <span aria-hidden="true" className="absolute inset-x-1 -top-px h-0.5 rounded bg-[var(--ib-action)]" />}
              {entry.locked
                ? <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center text-muted-foreground" title={t("admin.table.columnsPinned")}><Lock aria-hidden="true" className="h-3.5 w-3.5" /></span>
                : entry.on
                  ? <button type="button" aria-label={t("admin.table.columnsMove", { name: label(entry.key) })} disabled={!!needle}
                    className="inline-flex h-7 w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted-foreground hover:bg-accent disabled:cursor-default disabled:opacity-40"
                    onPointerDown={(event) => start(event, entry.key)} onPointerMove={move} onPointerUp={end} onPointerCancel={() => setDrag(null)} onKeyDown={(event) => keys(event, entry.key)}>
                    <GripVertical aria-hidden="true" className="h-4 w-4" /></button>
                  : <span className="inline-block h-7 w-7 shrink-0" />}
              <Checkbox checked={entry.on} disabled={entry.locked} aria-label={label(entry.key)} onChange={() => onChange(toggleCol(cols, entry.key, identity))} label={label(entry.key)} />
            </li>
          })}
          {drag && !needle && drag.to >= shownKeys.length && <li aria-hidden="true" className="relative h-0"><span className="absolute inset-x-1 -top-px h-0.5 rounded bg-[var(--ib-action)]" /></li>}
        </ul>
        <Button type="button" variant="ghost" size="sm" disabled={!resettable} onClick={onReset}>{t("admin.table.resetView")}</Button>
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>
}
