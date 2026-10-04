"use client"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { listErrorGroups, setErrorGroupStatus, ERROR_KINDS, ERROR_STATUSES, type ErrorFilters, type ErrorKind, type ErrorStatus } from "@/api/errorJournal"
import { Input } from "@/components/ui/input"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadError } from "@/components/ui/load-error"
import { LoadingArea } from "@/components/ui/spinner"
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
  const [kinds, setKinds] = useState<ErrorKind[]>([])
  const [status, setStatus] = useState<ErrorStatus | "">("")
  const [period, setPeriod] = useState("")
  const [qInput, setQInput] = useState("")
  const q = useDebounced(qInput.trim())
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [reload, setReload] = useState(0)
  // The last answer stays on screen while the next loads (and while live events change it).
  const [data, setData] = useState<{ key: string; filterKey: string; page: GroupPage } | null>(null)
  const [failure, setFailure] = useState<{ key: string; cause: unknown } | null>(null)

  const kindsKey = kinds.join(",")
  const filterKey = `${kindsKey}|${status}|${period}|${q}|${pageSize}|${page}`
  const key = `${filterKey}|${reload}`
  const offset = (page - 1) * pageSize

  const currentFilters = useCallback((): ErrorFilters => ({
    kinds, status, q,
    from: period ? new Date(Date.now() - PERIODS[period as keyof typeof PERIODS]).toISOString() : undefined,
  }), [kinds, status, q, period])
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
  const rows = useMemo(() => data?.page.items ?? [], [data])
  const filtered = !!(kinds.length || status || period || q)
  const resetPage = () => setPage(1)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-3">
        <Input value={qInput} onChange={(event) => { setQInput(event.target.value); resetPage() }} placeholder={t("admin.errors.filter.search")} aria-label={t("admin.errors.filter.search")} className="min-w-[min(100%,14rem)] flex-1 lg:max-w-xs" />
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
                onCheckedChange={(checked) => { setKinds((current) => checked ? [...current, kind] : current.filter((value) => value !== kind)); resetPage() }}>
                {kindLabel(kind)}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <SelectMenu value={status} onChange={(value) => { setStatus(value as ErrorStatus | ""); resetPage() }} ariaLabel={t("admin.errors.filter.status")} className="min-w-44"
          options={[{ value: "", label: t("admin.errors.filter.statusAll") }, ...ERROR_STATUSES.map((value) => ({ value, label: t(`admin.errors.status.${value}`) }))]} />
        <SelectMenu value={period} onChange={(value) => { setPeriod(value); resetPage() }} ariaLabel={t("admin.errors.filter.period")} className="min-w-44"
          options={[{ value: "", label: t("admin.errors.filter.periodAll") }, ...PERIOD_KEYS.map((value) => ({ value, label: t(`admin.errors.filter.period${cap(value)}`) }))]} />
        <span className="ml-auto text-xs text-muted-foreground" data-stream-mode={mode}>{t(`admin.errors.stream.${mode}`)}</span>
      </div>

      <div className="relative min-h-0 flex-1 overflow-auto" aria-busy={refreshing}>
        {failed ? (
          <LoadError message={t("admin.errors.loadError")} error={failed.cause} onRetry={resync} className="h-full" />
        ) : !data ? (
          <LoadingArea className="h-full" label={t("admin.loading")} />
        ) : rows.length === 0 ? (
          <EmptyState message={t(filtered ? "admin.errors.emptyFiltered" : "admin.errors.empty")} className="h-full" />
        ) : (
          <table className="w-full min-w-[960px] text-sm">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-3 font-medium">{t("admin.errors.col.kind")}</th>
                <th className="py-2 pr-3 font-medium">{t("admin.errors.col.title")}</th>
                <th className="py-2 pr-3 font-medium">{t("admin.errors.col.status")}</th>
                <th className="py-2 pr-3 font-medium">{t("admin.errors.col.occurrences")}</th>
                <th className="py-2 pr-3 font-medium">{t("admin.errors.col.lastSeen")}</th>
                <th className="py-2 font-medium">{t("admin.errors.col.firstSeen")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((group) => (
                <tr key={group.ID} className="border-b border-border align-top">
                  <td className="py-2.5 pr-3"><KindBadge kind={group.Kind} /></td>
                  <td className="max-w-xl py-2.5 pr-3">
                    <a href={errorGroupHref(group.ID)} className="break-words font-medium text-foreground underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-primary">{group.Title}</a>
                    {group.Source && <div className="mt-0.5 break-all font-mono text-xs text-muted-foreground">{group.Source}</div>}
                  </td>
                  <td className="py-2.5 pr-3">
                    <StatusSwitch status={group.Status} readOnly={!canWrite} label={t("admin.errors.statusFor", { title: group.Title })} onChange={(next) => queue.set(group.ID, group.Status, next)} />
                  </td>
                  <td className="py-2.5 pr-3 tabular-nums">{formatNumber(group.Occurrences)}</td>
                  <td className="whitespace-nowrap py-2.5 pr-3 text-muted-foreground">{formatDateTime(group.LastSeenAt)}</td>
                  <td className="whitespace-nowrap py-2.5 text-muted-foreground">{formatDateTime(group.FirstSeenAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {data && !failed && <TablePagination page={page} pageSize={pageSize} total={data.page.total} busy={refreshing} onPage={setPage} onPageSize={(size) => { setPageSize(size); setPage(1) }} />}
    </div>
  )
}
