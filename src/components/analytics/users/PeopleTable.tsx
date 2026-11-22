"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AnalyticsBlock, CsvExportButton, DataTable, useAnalyticsResource, type Column } from "@/components/analytics"
import { Input } from "@/components/ui/input"
import { TablePagination } from "@/components/ui/table-pagination"
import { t } from "@/i18n/t"
import { roleLabel } from "@/lib/roles"
import type { UsersPerson } from "@/api/platformAnalyticsOverview"
import { formatCount } from "../overview/format"

type PeoplePage = { Items: UsersPerson[]; Total: number }

/**
 * The accounts ranked by the events they joined, paged, searched and sorted on the server (the whole list, not a top
 * 100). Per-user data, so it is rendered (and fetched) only for a caller holding analytics.users.read; it ignores the
 * chosen period.
 */
export function PeopleTable() {
  const [search, setSearch] = useState("")
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [sort, setSort] = useState<{ field: string; direction: "asc" | "desc" }>({ field: "eventsJoined", direction: "desc" })
  // The search box reaches the server after a pause; a new search starts on the first page.
  useEffect(() => {
    const next = search.trim()
    if (next === query) return
    const id = setTimeout(() => { setQuery(next); setPage(1) }, 300)
    return () => clearTimeout(id)
  }, [search, query])
  const { data, loading, error, reload } = useAnalyticsResource<PeoplePage>("users/people", { page, pageSize, search: query, sortBy: sort.field, sortDir: sort.direction }, { period: false })
  const columns: Column<UsersPerson>[] = [
    { key: "name", header: t("admin.platformAnalytics.users.people.name"), cell: (row) => row.Name || "–", sortValue: (row) => row.Name },
    { key: "email", header: t("admin.platformAnalytics.users.people.email"), cell: (row) => row.Email, sortValue: (row) => row.Email },
    { key: "role", header: t("admin.platformAnalytics.users.people.role"), cell: (row) => <Link href={`/users?f.role=in%3A${encodeURIComponent(row.Role)}`} className="text-primary hover:underline">{roleLabel(row.Role)}</Link>, sortValue: (row) => row.Role },
    { key: "eventsJoined", header: t("admin.platformAnalytics.users.people.events"), cell: (row) => formatCount(row.EventsJoined), sortValue: (row) => row.EventsJoined, numeric: true },
    { key: "solves", header: t("admin.platformAnalytics.users.people.solves"), cell: (row) => formatCount(row.Solves), sortValue: (row) => row.Solves, numeric: true },
  ]
  const rows = data?.Items
  return <AnalyticsBlock title={t("admin.platformAnalytics.users.people.title")} subtitle={t("admin.platformAnalytics.users.people.subtitleAll")}
    hint={t("admin.platformAnalytics.users.people.hint")} actions={<CsvExportButton section="users" table="people" disabled={loading || !!error || !rows?.length} />}>
    <div className="mb-3"><Input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("admin.platformAnalytics.users.people.search")} aria-label={t("admin.platformAnalytics.users.people.search")} className="max-w-sm" /></div>
    <DataTable columns={columns} rows={rows} rowKey={(row) => row.ID} loading={loading} error={error} onRetry={reload} ariaLabel={t("admin.platformAnalytics.users.people.title")}
      emptyMessage={t("admin.platformAnalytics.users.people.empty")} errorMessage={t("admin.platformAnalytics.users.people.error")}
      sort={sort} onSort={(field) => { setSort((current) => ({ field, direction: current.field === field && current.direction === "desc" ? "asc" : field === "name" || field === "email" || field === "role" ? "asc" : "desc" })); setPage(1) }} />
    <TablePagination page={page} pageSize={pageSize} total={data?.Total ?? 0} busy={loading} onPage={setPage} onPageSize={(size) => { setPageSize(size); setPage(1) }} />
  </AnalyticsBlock>
}
