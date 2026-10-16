"use client"

import { useEffect, useState } from "react"
import { X } from "lucide-react"
import { getEvent, listEventsPage, type Event } from "@/api/events/catalog"
import { t } from "@/i18n/t"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadError } from "@/components/ui/load-error"
import { LoadingArea } from "@/components/ui/spinner"
import { TablePagination } from "@/components/ui/table-pagination"

/** Uses the events catalog's debounced search and offset pagination, without a selection cap. */
export function EventPicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const [search, setSearch] = useState("")
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [rows, setRows] = useState<Event[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [total, setTotal] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<{ cause: unknown } | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    const next = search.trim()
    if (next === query) return
    const timer = setTimeout(() => { setQuery(next); setPage(1) }, 300)
    return () => clearTimeout(timer)
  }, [search, query])

  useEffect(() => {
    let active = true
    queueMicrotask(() => { if (active) { setLoading(true); setError(null) } })
    listEventsPage({ search: query, page, pageSize, sortBy: "updated", sortDir: "desc" })
      .then((result) => {
        if (!active) return
        setRows(result.Items)
        setTotal(result.Total ?? 0)
        setNames((current) => ({ ...current, ...Object.fromEntries(result.Items.map((event) => [event.ID, event.Name])) }))
        setLoaded(true)
      })
      .catch((cause) => { if (active) setError({ cause }) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [query, page, pageSize, reload])

  // Selected events remain identifiable when they are outside the current search/page.
  useEffect(() => {
    let active = true
    const missing = value.filter((id) => !(id in names))
    if (missing.length === 0) return
    Promise.allSettled(missing.map((id) => getEvent(id)))
      .then((results) => {
        if (!active) return
        setNames((current) => ({ ...current, ...Object.fromEntries(results.map((result, index) => [missing[index], result.status === "fulfilled" ? result.value.Name : missing[index]])) }))
      })
    return () => { active = false }
  }, [value, names])

  return <div className="space-y-3">
    <Input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("admin.events.search")} aria-label={t("admin.events.search")} />
    {value.length > 0 && <ul className="flex flex-wrap gap-2" aria-label={t("admin.notif.banners.targets.events")}>
      {value.map((id) => <li key={id} className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-full border border-border bg-muted/40 py-0.5 pl-3 pr-1 text-sm">
        <span className="truncate">{names[id] ?? id}</span>
        <button type="button" aria-label={t("admin.notif.banners.targets.removeEvent", { name: names[id] ?? id })} onClick={() => onChange(value.filter((item) => item !== id))} className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"><X className="h-3.5 w-3.5" aria-hidden="true" /></button>
      </li>)}
    </ul>}
    <div className="flex h-56 flex-col overflow-auto rounded-md border border-border" aria-busy={loading}>
      {error ? <LoadError message={t("admin.notif.banners.targets.eventsLoadError")} error={error.cause} compact className="flex-1" onRetry={() => setReload((current) => current + 1)} />
        : !loaded && loading ? <LoadingArea compact className="flex-1" label={t("admin.loading")} />
          : rows.length === 0 ? <EmptyState compact className="flex-1" message={t("admin.notif.banners.targets.eventsEmpty")} />
            : <ul>{rows.map((event) => <li key={event.ID} className="border-b border-border/50 px-3 py-2 last:border-b-0">
              <Checkbox checked={value.includes(event.ID)} onChange={() => onChange(value.includes(event.ID) ? value.filter((id) => id !== event.ID) : [...value, event.ID])} label={event.Name} />
            </li>)}</ul>}
    </div>
    <TablePagination page={page} pageSize={pageSize} total={total} busy={loading} onPage={setPage} onPageSize={(size) => { setPageSize(size); setPage(1) }} />
  </div>
}
