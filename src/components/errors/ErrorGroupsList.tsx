"use client"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { listErrorGroups, parseReference, setErrorGroupStatus, ERROR_KINDS, ERROR_STATUSES, type ErrorFilters, type ErrorKind, type ErrorStatus } from "@/api/errorJournal"
import { Input } from "@/components/ui/input"
import { FilterField } from "@/components/common/FilterField"
import { SortTh, TableState, TableWrap, TimeText } from "@/components/common/DsTable"
import { useUrlState } from "@/lib/useUrlState"
import { SelectMenu } from "@/components/ui/select-menu"
import { TablePagination } from "@/components/ui/table-pagination"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { ChevronDown } from "lucide-react"
import { t } from "@/i18n/t"
import { errorOr } from "@/i18n/apiError"
import { formatDateTime, formatNumber } from "@/lib/locale"
import { applyStreamEvent, replaceGroup, type GroupPage } from "@/lib/errorJournal"
import { createStatusQueue } from "@/lib/statusQueue"
import { useErrorStream } from "@/lib/errorStream"
import { useDebounced } from "@/lib/useDebounced"
import { useRole } from "@/lib/useRole"
import { errorGroupHref, KindBadge, kindLabel, StatusSwitch } from "./shared"

export const PERIODS = { hour: 3_600_000, day: 86_400_000, week: 7 * 86_400_000, month: 30 * 86_400_000 } as const
const PERIOD_KEYS = Object.keys(PERIODS) as (keyof typeof PERIODS)[]
const cap = (value: string) => value[0].toUpperCase() + value.slice(1)

export function ErrorGroupsList() {
  const { can } = useRole()
  const canWrite = can("platform.errors.write")
  const [url, setUrl] = useUrlState({ q: "", ref: "", kind: "", status: "", period: "", page: "1", size: "50", sort: "lastSeen", dir: "desc" })
  const kinds = useMemo(() => url.kind.split(",").filter((value): value is ErrorKind => (ERROR_KINDS as readonly string[]).includes(value)), [url.kind])
  const status = (ERROR_STATUSES as readonly string[]).includes(url.status) ? url.status as ErrorStatus : ""
  const period = url.period in PERIODS ? url.period : ""
  const [qInput, setQInput] = useState(url.q)
  const q = useDebounced(qInput.trim())
  useEffect(() => { setUrl({ q }) }, [q, setUrl])
  // «Номер звернення» from a 500 page; an unreadable value filters nothing and is flagged.
  const [refInput, setRefInput] = useState(url.ref)
  const refText = useDebounced(refInput.trim())
  useEffect(() => { setUrl({ ref: refText }) }, [refText, setUrl])
  const request = parseReference(refText)
  const refInvalid = refText !== "" && !request
  const page = Math.max(1, Number(url.page) || 1)
  const pageSize = [25, 50, 100].includes(Number(url.size)) ? Number(url.size) : 50
  const sortField = url.sort
  const sortDir = url.dir === "asc" ? "asc" : "desc"
  const [reload, setReload] = useState(0)
  // The last answer stays on screen while the next loads (and while live events change it).
  const [data, setData] = useState<{ key: string; filterKey: string; page: GroupPage } | null>(null)
  const [failure, setFailure] = useState<{ key: string; cause: unknown } | null>(null)

  const kindsKey = kinds.join(",")
  const filterKey = `${kindsKey}|${status}|${period}|${q}|${request ?? ""}|${pageSize}|${page}`
  const key = `${filterKey}|${reload}`
  const offset = (page - 1) * pageSize

  const currentFilters = useCallback((): ErrorFilters => ({
    kinds, status, q, request,
    from: period ? new Date(Date.now() - PERIODS[period as keyof typeof PERIODS]).toISOString() : undefined,
  }), [kinds, status, q, request, period])
  const live = useRef({ currentFilters, pageSize, offset })
  useEffect(() => { live.current = { currentFilters, pageSize, offset } })

  useEffect(() => {
    const controller = new AbortController()
    listErrorGroups(currentFilters(), pageSize, offset, controller.signal)
      .then((list) => { setData({ key, filterKey, page: { items: list.Items, total: list.Total } }); setFailure(null) })
      .catch((cause) => { if (!controller.signal.aborted) setFailure({ key, cause }) })
    return () => controller.abort()
  }, [key, filterKey, currentFilters, pageSize, offset])

  // Live: update the page in place. A (re)connect or a break refetches once, quietly.
  const resync = useCallback(() => setReload((value) => value + 1), [])
  const mode = useErrorStream({
    enabled: can("platform.errors.read"),
    onEvent: (event) => setData((current) => current ? { ...current, page: applyStreamEvent(current.page, event, live.current.currentFilters(), live.current.pageSize, live.current.offset) } : current),
    onResync: resync,
  })

  const [queue] = useState(() => createStatusQueue({
    patch: setErrorGroupStatus,
    optimistic: (id, next) => setData((current) => current ? { ...current, page: { ...current.page, items: current.page.items.map((g) => g.ID === id ? { ...g, Status: next } : g) } } : current),
    confirmed: (group) => setData((current) => current ? { ...current, page: replaceGroup(current.page, group) } : current),
    failed: (id, back, error) => {
      setData((current) => current ? { ...current, page: { ...current.page, items: current.page.items.map((g) => g.ID === id ? { ...g, Status: back } : g) } } : current)
      toast.error(errorOr(error, t("admin.errors.statusError")))
    },
  }))

  // A quiet resync (reload) never swaps the rows for a loader or an error; only a change of the filters does.
  const stale = data?.filterKey !== filterKey
  const failed = failure?.key === key && stale ? failure : null
  const refreshing = !failed && stale
  const items = useMemo(() => data?.page.items ?? [], [data])
  // The server pages by last seen; a sort reorders the page that is shown.
  const rows = useMemo(() => {
    if (sortField === "lastSeen" && sortDir === "desc") return items
    const factor = sortDir === "asc" ? 1 : -1
    const pick = (g: (typeof items)[number]): string | number =>
      sortField === "kind" ? kindLabel(g.Kind) : sortField === "title" ? g.Title : sortField === "status" ? g.Status : sortField === "occurrences" ? g.Occurrences : sortField === "firstSeen" ? g.FirstSeenAt : g.LastSeenAt
    return [...items].sort((a, b) => {
      const x = pick(a), y = pick(b)
      return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * factor
    })
  }, [items, sortField, sortDir])
  const sort = (field: string) => setUrl({ sort: field, dir: sortField === field && sortDir === "asc" ? "desc" : "asc" })
  const state = failed ? "error" : !data ? "loading" : rows.length === 0 ? "empty" : null
  const filtered = !!(kinds.length || status || period || q || request)
  const setPage = (value: number) => setUrl({ page: String(value) })
  const resetPage = () => setUrl({ page: "1" })

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-4 flex flex-wrap items-end gap-x-3 gap-y-3">
        <FilterField label={t("admin.errors.filter.searchLabel")} className="min-w-[min(100%,14rem)] flex-1 lg:max-w-xs">
          <Input value={qInput} onChange={(event) => { setQInput(event.target.value); resetPage() }} placeholder={t("admin.errors.filter.search")} aria-label={t("admin.errors.filter.search")} />
        </FilterField>
        <FilterField label={t("admin.errors.filter.refLabel")} className="min-w-[min(100%,12rem)] flex-1 lg:max-w-[14rem]">
          <Input value={refInput} onChange={(event) => { setRefInput(event.target.value); resetPage() }} placeholder={t("admin.errors.filter.refPlaceholder")} aria-label={t("admin.errors.filter.refLabel")} aria-invalid={refInvalid || undefined} className="font-mono" />
        </FilterField>
        <FilterField label={t("admin.errors.filter.kindLabel")} className="min-w-44">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" className="h-10 min-w-44 justify-between font-normal" aria-label={t("admin.errors.filter.kind")}>
                <span className="truncate">{kinds.length === 0 ? t("admin.errors.filter.kindAll") : kinds.length === 1 ? kindLabel(kinds[0]) : t("admin.errors.filter.kindCount", { count: kinds.length })}</span>
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-80 overflow-auto">
              {ERROR_KINDS.map((kind) => (
                <DropdownMenuCheckboxItem key={kind} checked={kinds.includes(kind)} onSelect={(event) => event.preventDefault()}
                  onCheckedChange={(checked) => { setUrl({ kind: (checked ? [...kinds, kind] : kinds.filter((value) => value !== kind)).join(","), page: "1" }) }}>
                  {kindLabel(kind)}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </FilterField>
        <FilterField label={t("admin.errors.filter.statusLabel")} className="min-w-44">
          <SelectMenu value={status} onChange={(value) => setUrl({ status: value, page: "1" })} ariaLabel={t("admin.errors.filter.status")}
            options={[{ value: "", label: t("admin.errors.filter.statusAll") }, ...ERROR_STATUSES.map((value) => ({ value, label: t(`admin.errors.status.${value}`) }))]} />
        </FilterField>
        <FilterField label={t("admin.errors.filter.periodLabel")} className="min-w-44">
          <SelectMenu value={period} onChange={(value) => setUrl({ period: value, page: "1" })} ariaLabel={t("admin.errors.filter.period")}
            options={[{ value: "", label: t("admin.errors.filter.periodAll") }, ...PERIOD_KEYS.map((value) => ({ value, label: t(`admin.errors.filter.period${cap(value)}`) }))]} />
        </FilterField>
        <span className="ml-auto pb-2 text-xs text-muted-foreground" data-stream-mode={mode}>{t(`admin.errors.stream.${mode}`)}</span>
      </div>

      <TableWrap label={t("admin.errors.table")} rows={10} className="min-h-0">
        <table aria-label={t("admin.errors.table")} aria-busy={refreshing} className="ib-table min-w-[960px]">
          <thead>
            <tr>
              <SortTh label={t("admin.errors.col.kind")} field="kind" activeField={sortField} direction={sortDir} onSort={sort} />
              <SortTh label={t("admin.errors.col.title")} field="title" activeField={sortField} direction={sortDir} onSort={sort} />
              <SortTh label={t("admin.errors.col.status")} field="status" activeField={sortField} direction={sortDir} onSort={sort} />
              <SortTh label={t("admin.errors.col.occurrences")} field="occurrences" activeField={sortField} direction={sortDir} onSort={sort} num />
              <SortTh label={t("admin.errors.col.lastSeen")} field="lastSeen" activeField={sortField} direction={sortDir} onSort={sort} />
              <SortTh label={t("admin.errors.col.firstSeen")} field="firstSeen" activeField={sortField} direction={sortDir} onSort={sort} />
            </tr>
          </thead>
          {state ? <TableState colSpan={6} kind={state}
            message={state === "error" ? t("admin.errors.loadError") : t(filtered ? "admin.errors.emptyFiltered" : "admin.errors.empty")}
            error={failed?.cause} onRetry={resync} /> : (
            <tbody>
              {rows.map((group) => (
                <tr key={group.ID}>
                  <td><KindBadge kind={group.Kind} /></td>
                  <td className="max-w-xl !whitespace-normal py-1">
                    <a href={errorGroupHref(group.ID, request)} className="break-words font-medium text-foreground underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-primary">{group.Title}</a>
                    {group.Source && <div className="break-all font-mono text-xs text-muted-foreground">{group.Source}</div>}
                  </td>
                  <td>
                    <StatusSwitch status={group.Status} readOnly={!canWrite} label={t("admin.errors.statusFor", { title: group.Title })} onChange={(next) => queue.set(group.ID, group.Status, next)} />
                  </td>
                  <td className="ib-table__num">{formatNumber(group.Occurrences)}</td>
                  <td className="ib-table__dim"><TimeText iso={group.LastSeenAt}>{formatDateTime(group.LastSeenAt)}</TimeText></td>
                  <td className="ib-table__dim"><TimeText iso={group.FirstSeenAt}>{formatDateTime(group.FirstSeenAt)}</TimeText></td>
                </tr>
              ))}
            </tbody>
          )}
        </table>
      </TableWrap>
      {data && !failed && <TablePagination page={page} pageSize={pageSize} total={data.page.total} busy={refreshing} onPage={setPage} onPageSize={(size) => setUrl({ size: String(size), page: "1" })} />}
    </div>
  )
}
