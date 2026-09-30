"use client"

import Link from "next/link"
import { Fragment, useMemo, useState, type ReactNode } from "react"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadError } from "@/components/ui/load-error"
import { SortableHeader } from "@/components/ui/sortable-header"
import { LoadingArea } from "@/components/ui/spinner"
import { t } from "@/i18n/t"

export type Column<Row> = {
  key: string
  header: string
  cell: (row: Row) => ReactNode
  /** Makes the header sortable; returns the comparable value of a row. */
  sortValue?: (row: Row) => string | number | null | undefined
  // Numbers keep aligned digits; every cell stays left-aligned like its header.
  numeric?: boolean
  className?: string
}

/**
 * Table of a section: typed columns, sortable headers (client-side, or controlled with
 * `sort` / `onSort`), optional whole-row link. Loading (crest), error (LoadError) and empty
 * (EmptyState) are centred inside the same block, which keeps `minHeight`, so the block does
 * not jump. Wide tables scroll horizontally inside the block.
 */
export function DataTable<Row>({ columns, rows, rowKey, rowHref, loading = false, error, onRetry, emptyMessage, errorMessage, minHeight = 320, ariaLabel, defaultSort, sort, onSort, renderDetail }: {
  columns: Column<Row>[]
  rows: Row[] | undefined
  rowKey: (row: Row) => string
  rowHref?: (row: Row) => string | undefined
  loading?: boolean
  error?: unknown
  onRetry?: () => void
  emptyMessage?: string
  errorMessage?: string
  minHeight?: number
  ariaLabel: string
  defaultSort?: { field: string; direction: "asc" | "desc" }
  sort?: { field: string; direction: "asc" | "desc" }
  onSort?: (field: string) => void
  /** A full-width row under a row (an opened detail); null renders nothing. */
  renderDetail?: (row: Row) => ReactNode
}) {
  const [own, setOwn] = useState(defaultSort ?? { field: "", direction: "asc" as const })
  const active = sort ?? own
  const failed = error !== undefined && error !== null && error !== false
  function toggle(field: string) {
    if (onSort) return onSort(field)
    setOwn((prev) => ({ field, direction: prev.field === field && prev.direction === "asc" ? "desc" : "asc" }))
  }
  const sorted = useMemo(() => {
    if (!rows) return []
    const column = columns.find((c) => c.key === active.field)
    if (!column?.sortValue || onSort) return rows
    const pick = column.sortValue
    const factor = active.direction === "asc" ? 1 : -1
    return [...rows].sort((a, b) => {
      const x = pick(a), y = pick(b)
      if (x == null && y == null) return 0
      if (x == null) return 1
      if (y == null) return -1
      return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * factor
    })
  }, [rows, columns, active.field, active.direction, onSort])

  const state = loading ? "loading" : failed ? "error" : !rows || rows.length === 0 ? "empty" : "ready"
  return <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-card" style={{ minHeight }} aria-busy={loading}>
    {state === "loading" && <div className="flex flex-1"><LoadingArea className="h-full w-full flex-1" label={t("admin.loading")} /></div>}
    {state === "error" && <div className="flex flex-1"><LoadError className="flex-1" message={errorMessage ?? t("admin.platformAnalytics.table.error")} error={error} onRetry={onRetry} /></div>}
    {state === "empty" && <div className="flex flex-1"><EmptyState className="flex-1" message={emptyMessage ?? t("admin.platformAnalytics.table.empty")} /></div>}
    {state === "ready" && <div className="overflow-x-auto">
      <table aria-label={ariaLabel} className="w-full min-w-max border-collapse text-sm">
        <thead className="border-b border-border text-muted-foreground">
          <tr>{columns.map((column) => column.sortValue
            ? <SortableHeader key={column.key} label={column.header} field={column.key} activeField={active.field} direction={active.direction} onSort={toggle} />
            : <th key={column.key} scope="col" className="px-3 py-2 text-left font-medium">{column.header}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sorted.map((row) => {
            const href = rowHref?.(row)
            const detail = renderDetail?.(row)
            return <Fragment key={rowKey(row)}>
              <tr className={`${href ? "relative hover:bg-accent" : ""}`}>
                {columns.map((column, index) => <td key={column.key} className={`px-3 py-2 text-left ${column.numeric ? "tabular-nums" : ""} ${column.className ?? ""}`}>
                  {href && index === 0
                    ? <Link href={href} className="after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-primary">{column.cell(row)}</Link>
                    : column.cell(row)}
                </td>)}
              </tr>
              {detail && <tr><td colSpan={columns.length} className="p-0">{detail}</td></tr>}
            </Fragment>
          })}
        </tbody>
      </table>
    </div>}
  </div>
}
