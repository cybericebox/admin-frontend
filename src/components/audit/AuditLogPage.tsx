"use client"
import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { listAuditLog, type AuditFilters, type AuditRecord } from "@/api/auditLog"
import { Button } from "@/components/ui/button"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import { Input } from "@/components/ui/input"
import { LoadError } from "@/components/ui/load-error"
import { Spinner } from "@/components/ui/spinner"
import { Badge, type BadgeTone } from "@/components/ui/badge"
import { PageHeader } from "@/components/ui/page-header"
import { FilterField } from "@/components/common/FilterField"
import { SortTh, TableState, TableWrap, TimeText } from "@/components/common/DsTable"
import { useUrlState } from "@/lib/useUrlState"
import { SelectMenu } from "@/components/ui/select-menu"
import { t } from "@/i18n/t"
import { formatDateTime } from "@/lib/locale"
import { parseAuditTarget } from "@/lib/auditTarget"
import { useDebounced } from "@/lib/useDebounced"
import { useUserNames } from "@/lib/userNames"
import { useRole } from "@/lib/useRole"
import { AuditUserFilter, type PickedUser } from "./AuditUserFilter"

const METHODS = ["POST", "PUT", "PATCH", "DELETE", "GET"] as const
const STATUS_FILTERS = ["2xx", "3xx", "4xx", "5xx", "403", "409"] as const
// Kind tokens the daemon handlers set explicitly; route-param kinds (userID, id, ...) are typed by hand.
const TARGET_KINDS = ["event", "team", "user", "agent", "test-lab", "exercise", "challenge", "device"]

const statusTone = (status: number): BadgeTone => status >= 500 ? "danger" : status >= 400 ? "warn" : "ok"

// «YYYY-MM-DDTHH:mm» wall clock of the picker -> RFC3339 instant. «to» is inclusive, so it covers its whole minute.
const toInstant = (local: string, endOfMinute = false) => {
  if (!local) return ""
  const at = new Date(local)
  if (Number.isNaN(at.getTime())) return ""
  if (endOfMinute) at.setSeconds(59)
  return at.toISOString().replace(/\.\d{3}Z$/, "Z")
}

type Shown = { key: string; rows: AuditRecord[]; next: string }
type SortField = "time" | "actor" | "permission" | "method" | "status"

const COLUMNS = ["time", "actor", "permission", "method", "route", "status", "target"] as const

export function AuditLogPage() {
  const { can } = useRole()
  const [url, setUrl] = useUrlState({ actor: "", actorName: "", permission: "", route: "", method: "", status: "", kind: "", targetID: "", from: "", to: "", sort: "time", dir: "desc" })
  // Text fields stay responsive: the field shows its own value, the URL and the request follow.
  const [permissionInput, setPermissionInput] = useState(url.permission)
  const [routeInput, setRouteInput] = useState(url.route)
  const [targetIDInput, setTargetIDInput] = useState(url.targetID)
  const permission = useDebounced(permissionInput.trim())
  const route = useDebounced(routeInput.trim())
  const targetID = useDebounced(targetIDInput.trim())
  useEffect(() => { setUrl({ permission, route, targetID }) }, [permission, route, targetID, setUrl])
  const user: PickedUser | null = url.actor ? { id: url.actor, name: url.actorName || url.actor.slice(0, 8) } : null
  const { method, status, from: fromLocal, to: toLocal, kind: targetKind } = url
  const sortField = url.sort as SortField
  const sortDir = url.dir === "asc" ? "asc" : "desc"
  const [reload, setReload] = useState(0)
  // The shown rows stay on screen while a changed filter loads, so the table never flashes empty.
  const [data, setData] = useState<Shown | null>(null)
  const [failure, setFailure] = useState<{ key: string; cause: unknown } | null>(null)
  const [more, setMore] = useState<{ key: string; loading: boolean; error: unknown } | null>(null)
  // Answers of anything but the latest request are dropped.
  const latest = useRef(0)

  const from = toInstant(fromLocal)
  const to = toInstant(toLocal, true)
  const badRange = !!from && !!to && to < from
  const actorID = user?.id ?? ""
  const filters: AuditFilters = { actorID, permission, route, method, status, from, to, targetKind, targetID }
  const key = `${JSON.stringify(filters)}|${reload}`

  useEffect(() => {
    if (badRange) { latest.current++; return }
    const request = ++latest.current
    const query: AuditFilters = { actorID, permission, route, method, status, from, to, targetKind, targetID }
    listAuditLog(query)
      .then((page) => { if (request === latest.current) { setData({ key, rows: page.Items, next: page.NextCursor }); setFailure(null) } })
      .catch((cause) => { if (request === latest.current) setFailure({ key, cause }) })
  }, [key, badRange, actorID, permission, route, method, status, from, to, targetKind, targetID])

  const loadMore = () => {
    if (!data?.next || data.key !== key) return
    const request = ++latest.current
    const cursor = data.next
    setMore({ key, loading: true, error: null })
    listAuditLog(filters, cursor)
      .then((page) => {
        if (request !== latest.current) return
        setData((current) => current && current.key === key ? { ...current, rows: [...current.rows, ...page.Items.filter((item) => !current.rows.some((row) => row.ID === item.ID))], next: page.NextCursor } : current)
        setMore(null)
      })
      .catch((cause) => { if (request === latest.current) setMore({ key, loading: false, error: cause }) })
  }

  const failed = failure?.key === key ? failure : null
  const refreshing = !badRange && !failed && data?.key !== key
  const moreState = more?.key === key ? more : null
  const loaded = data?.rows
  const filtered = Object.values(filters).some(Boolean)
  const names = useUserNames((loaded ?? []).map((row) => row.ActorID))
  // The log is paged by cursor from the server (newest first): sorting reorders the rows loaded so far.
  const rows = useMemo(() => {
    const list = loaded ?? []
    if (sortField === "time" && sortDir === "desc") return list
    const factor = sortDir === "asc" ? 1 : -1
    const pick = (row: AuditRecord): string | number =>
      sortField === "time" ? row.CreatedAt : sortField === "actor" ? (names[row.ActorID]?.name ?? row.ActorID) : sortField === "permission" ? row.Permission : sortField === "method" ? row.Method : row.ResponseStatus
    return [...list].sort((a, b) => {
      const x = pick(a), y = pick(b)
      return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * factor
    })
  }, [loaded, sortField, sortDir, names])
  const sort = (field: string) => setUrl({ sort: field, dir: sortField === field && sortDir === "asc" ? "desc" : "asc" })
  const sortHeader = (column: (typeof COLUMNS)[number]) => ["time", "actor", "permission", "method", "status"].includes(column)
    ? <SortTh key={column} label={t(`admin.audit.col.${column}`)} field={column} activeField={sortField} direction={sortDir} onSort={sort} />
    : <th key={column} scope="col">{t(`admin.audit.col.${column}`)}</th>
  const state = failed ? "error" : !data ? "loading" : rows.length === 0 ? "empty" : null

  const filterControls = <>
    {can("users.read") && <FilterField label={t("admin.audit.filter.user")} className="min-w-[min(100%,16rem)] flex-1 lg:max-w-xs">
      <AuditUserFilter value={user} onChange={(picked) => setUrl({ actor: picked?.id ?? "", actorName: picked?.name ?? "" })} />
    </FilterField>}
    <FilterField label={t("admin.audit.col.permission")} className="min-w-[min(100%,14rem)] flex-1 lg:max-w-xs">
      <Input value={permissionInput} onChange={(event) => setPermissionInput(event.target.value)} placeholder={t("admin.audit.filter.permission")} aria-label={t("admin.audit.col.permission")} />
    </FilterField>
    <FilterField label={t("admin.audit.col.route")} className="min-w-[min(100%,14rem)] flex-1 lg:max-w-xs">
      <Input value={routeInput} onChange={(event) => setRouteInput(event.target.value)} placeholder={t("admin.audit.filter.route")} aria-label={t("admin.audit.col.route")} />
    </FilterField>
    <FilterField label={t("admin.audit.filter.method")} className="min-w-40">
      <SelectMenu value={method} onChange={(value) => setUrl({ method: value })} ariaLabel={t("admin.audit.filter.method")}
        options={[{ value: "", label: t("admin.audit.filter.methodAll") }, ...METHODS.map((value) => ({ value, label: value === "GET" ? t("admin.audit.filter.methodGet") : value }))]} />
    </FilterField>
    <FilterField label={t("admin.audit.filter.status")} className="min-w-44">
      <SelectMenu value={status} onChange={(value) => setUrl({ status: value })} ariaLabel={t("admin.audit.filter.status")}
        options={[{ value: "", label: t("admin.audit.filter.statusAll") }, ...STATUS_FILTERS.map((value) => ({ value, label: t(`admin.audit.filter.status_${value}`) }))]} />
    </FilterField>
    <FilterField label={t("admin.audit.filter.kindLabel")} className="min-w-44">
      <SelectMenu value={targetKind} onChange={(value) => setUrl({ kind: value })} ariaLabel={t("admin.audit.filter.kindLabel")}
        options={[{ value: "", label: t("admin.audit.filter.kindAll") }, ...TARGET_KINDS.map((kind) => ({ value: kind, label: t(`admin.audit.target.${kind}`) }))]} />
    </FilterField>
    <FilterField label={t("admin.audit.filter.targetIDLabel")} className="min-w-[min(100%,14rem)] flex-1 lg:max-w-xs">
      <Input value={targetIDInput} onChange={(event) => setTargetIDInput(event.target.value)} placeholder={t("admin.audit.filter.targetID")} aria-label={t("admin.audit.filter.targetIDLabel")} />
    </FilterField>
    <FilterField label={t("admin.audit.filter.from")}>
      <DateTimePicker value={fromLocal} onChange={(value) => setUrl({ from: value })} allowClear aria-label={t("admin.audit.filter.from")} aria-invalid={badRange || undefined} />
    </FilterField>
    <FilterField label={t("admin.audit.filter.to")}>
      <DateTimePicker value={toLocal} onChange={(value) => setUrl({ to: value })} allowClear aria-label={t("admin.audit.filter.to")} aria-invalid={badRange || undefined} />
    </FilterField>
  </>

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <PageHeader title={t("admin.nav.audit")} sub={t("admin.audit.sub")}
        filters={<div role="group" aria-label={t("admin.audit.filter.groupLabel")} className="flex flex-wrap items-end gap-x-3 gap-y-3">{filterControls}</div>} />
      {badRange && <p role="alert" className="text-sm text-destructive">{t("admin.audit.filter.rangeError")}</p>}

      <TableWrap label={t("admin.audit.table")} rows={10} className="min-h-0 flex-1" >
        <table aria-label={t("admin.audit.table")} aria-busy={refreshing} className="ib-table min-w-[960px]">
          <thead><tr>{COLUMNS.map(sortHeader)}</tr></thead>
          {state ? <TableState colSpan={COLUMNS.length} kind={state}
            message={state === "error" ? t("admin.audit.loadError") : t(filtered ? "admin.audit.emptyFiltered" : "admin.audit.empty")}
            error={failed?.cause} onRetry={() => setReload((value) => value + 1)} /> : (
            <tbody>
              {rows.map((row) => {
                const actor = names[row.ActorID]
                return (
                  <tr key={row.ID}>
                    <td className="ib-table__dim"><TimeText iso={row.CreatedAt}>{formatDateTime(row.CreatedAt)}</TimeText></td>
                    <td><Link href={`/users/detail?id=${encodeURIComponent(row.ActorID)}`} className="font-medium text-primary hover:underline">{actor?.name ?? row.ActorID.slice(0, 8)}</Link></td>
                    <td className="ib-table__mono">{row.Permission}</td>
                    <td className="ib-table__mono">{row.Method}</td>
                    <td className="ib-table__mono ib-table__dim">{row.Route}</td>
                    <td><Badge tone={statusTone(row.ResponseStatus)} size="sm">{row.ResponseStatus}</Badge></td>
                    <td>
                      <div className="flex flex-col gap-0.5 py-1">
                        {parseAuditTarget(row.Target).map((part) => {
                          const kind = TARGET_KINDS.includes(part.kind) ? t(`admin.audit.target.${part.kind}`) : part.kind
                          const label = `${kind} ${part.id.length > 12 ? part.id.slice(0, 8) : part.id}`.trim()
                          return part.href
                            ? part.external
                              ? <a key={part.kind + part.id} href={part.href} className="text-primary hover:underline">{label}</a>
                              : <Link key={part.kind + part.id} href={part.href} className="text-primary hover:underline">{label}</Link>
                            : <span key={part.kind + part.id} className="text-foreground">{label}</span>
                        })}
                        {!row.Target && <span className="text-muted-foreground">—</span>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          )}
        </table>
      </TableWrap>

      <div className="flex shrink-0 items-center justify-center gap-3 text-sm text-muted-foreground">
        {moreState?.error ? <LoadError compact message={t("admin.audit.loadMoreError")} error={moreState.error} onRetry={loadMore} className="min-h-0 w-auto py-0" /> : null}
        {data?.next && !moreState?.error ? (
          <Button type="button" variant="outline" onClick={loadMore} busy={!!moreState?.loading}>{t("admin.audit.showMore")}</Button>
        ) : null}
        <span className="inline-flex w-5 justify-center">{refreshing && !!data && <Spinner size="sm" label={t("admin.table.updating")} />}</span>
      </div>
    </div>
  )
}
