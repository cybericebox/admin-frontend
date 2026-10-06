"use client"

import type { ReactNode } from "react"
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadError } from "@/components/ui/load-error"
import { LoadingArea } from "@/components/ui/spinner"
import { t } from "@/i18n/t"
import { cn } from "@/utils/cn"

// DS table kit (components/table/table.css, T7). The header is always rendered; loading, empty and error
// are ONE centred cell in a body under it (tbody.ib-table__state), and the block keeps `rows` x row height
// so loading -> empty / error -> data never jumps. Date cells use <time>, number columns .ib-table__num.

const ROW_H = 40
const HEAD_H = 36

/** Focusable scroll region around a table. `rows` fixes the block height of the state row. */
export function TableWrap({ label, rows = 6, minHeight, className, children }: { label: string; rows?: number; minHeight?: number; className?: string; children: ReactNode }) {
  // With `minHeight` the whole block (header + state) keeps that height, the state cell takes the rest.
  const style = { "--ib-state-h": minHeight ? `${Math.max(120, minHeight - HEAD_H)}px` : `${rows * ROW_H}px`, minHeight } as React.CSSProperties
  return <div role="region" tabIndex={0} aria-label={label} style={style} className={cn("ib-table-wrap rounded-lg border border-border bg-card", className)}>{children}</div>
}

export type TableStateKind = "loading" | "empty" | "error"

/** The state body of a table: one full-width cell under the header, centred. */
export function TableState({ colSpan, kind, message, error, onRetry, loadingLabel }: {
  colSpan: number
  kind: TableStateKind
  message?: string
  error?: unknown
  onRetry?: () => void
  loadingLabel?: string
}) {
  const cls = "min-h-[var(--ib-state-h,240px)] flex-1"
  return <tbody className="ib-table__state"><tr><td colSpan={colSpan}>
    {kind === "loading" && <LoadingArea className={cn("w-full", cls)} label={loadingLabel ?? t("admin.loading")} />}
    {kind === "error" && <LoadError className={cls} message={message} error={error} onRetry={onRetry} />}
    {kind === "empty" && <EmptyState className={cls} message={message ?? t("admin.platformAnalytics.table.empty")} />}
  </td></tr></tbody>
}

/** Sort header: `th[aria-sort]` with one button; `num` right-aligns numbers like their cells. */
export function SortTh({ label, field, activeField, direction, onSort, num, children }: {
  label: string
  field: string
  activeField: string
  direction: "asc" | "desc"
  onSort: (field: string) => void
  num?: boolean
  children?: ReactNode
}) {
  const active = field === activeField
  const Icon = !active ? ArrowUpDown : direction === "asc" ? ArrowUp : ArrowDown
  return <th scope="col" className={num ? "ib-table__num" : undefined} aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}>
    <span className="inline-flex items-center gap-1.5">
      <button type="button" className="ib-table__sort" onClick={() => onSort(field)}>{label}<Icon aria-hidden="true" /></button>
      {children}
    </span>
  </th>
}

/** A plain (not sortable) column header. */
export function Th({ children, num, className }: { children?: ReactNode; num?: boolean; className?: string }) {
  return <th scope="col" className={cn(num && "ib-table__num", className)}>{children}</th>
}

/** A date cell: <time> with the machine value, the shown text comes from `children`. */
export function TimeText({ iso, children }: { iso?: string | null; children: ReactNode }) {
  if (!iso) return <>{children}</>
  return <time dateTime={iso}>{children}</time>
}
