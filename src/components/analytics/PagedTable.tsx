"use client"

import { useEffect, useState, type ReactNode } from "react"
import { AnalyticsBlock } from "./AnalyticsBlock"
import { DataTable, type Column } from "./DataTable"
import { useAnalyticsResource } from "./useAnalyticsResource"
import { Input } from "@/components/ui/input"
import { TablePagination } from "@/components/ui/table-pagination"

/**
 * A table of an analytics section read page by page from `<section>/<table>` (page, pageSize, search, sortBy, sortDir,
 * the period of the page, plus `extra` filters): the whole list, not the newest N. The found total drives the paging.
 */
export function PagedTable<Row>({ section, path, extra, columns, rowKey, title, hint, subtitle, actions, ariaLabel, emptyMessage, errorMessage, searchLabel, defaultSort }: {
  section: string
  path: string
  extra?: Record<string, string | undefined>
  columns: Column<Row>[]
  rowKey: (row: Row) => string
  title: string
  hint?: string
  subtitle?: string
  actions?: (state: { loading: boolean; error: unknown; empty: boolean }) => ReactNode
  ariaLabel: string
  emptyMessage: string
  errorMessage: string
  searchLabel: string
  defaultSort: { field: string; direction: "asc" | "desc" }
}) {
  const [search, setSearch] = useState("")
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [sort, setSort] = useState(defaultSort)
  // The search box reaches the server after a pause; a new search starts on the first page.
  useEffect(() => {
    const next = search.trim()
    if (next === query) return
    const id = setTimeout(() => { setQuery(next); setPage(1) }, 300)
    return () => clearTimeout(id)
  }, [search, query])
  const { data, loading, error, reload } = useAnalyticsResource<{ Items: Row[]; Total: number }>(`${section}/${path}`, { ...extra, page, pageSize, search: query, sortBy: sort.field, sortDir: sort.direction })
  const rows = data?.Items
  return <AnalyticsBlock title={title} hint={hint} subtitle={subtitle} actions={actions?.({ loading, error, empty: !rows?.length })}>
    <div className="mb-3"><Input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={searchLabel} aria-label={searchLabel} className="max-w-sm" /></div>
    <DataTable columns={columns} rows={rows} rowKey={rowKey} loading={loading} error={error} onRetry={reload} ariaLabel={ariaLabel} emptyMessage={emptyMessage} errorMessage={errorMessage}
      sort={sort} onSort={(field) => { setSort((current) => ({ field, direction: current.field === field ? (current.direction === "asc" ? "desc" : "asc") : defaultSort.field === field ? defaultSort.direction : "asc" })); setPage(1) }} />
    <TablePagination page={page} pageSize={pageSize} total={data?.Total ?? 0} busy={loading} onPage={setPage} onPageSize={(size) => { setPageSize(size); setPage(1) }} />
  </AnalyticsBlock>
}
