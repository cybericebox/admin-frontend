"use client"
import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { auditExportPath, listAuditLog, type AuditFilters, type AuditRecord } from "@/api/auditLog"
import { apiGetBlob } from "@/api/client"
import { toast } from "@/components/ui/toast"
import { overloadOr } from "@/i18n/apiError"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LoadError } from "@/components/ui/load-error"
import { Spinner } from "@/components/ui/spinner"
import { Badge, type BadgeTone } from "@/components/ui/badge"
import { PageHeader } from "@/components/ui/page-header"
import { FilterField } from "@/components/common/FilterField"
import { SortTh, TableState, TableWrap, TimeText } from "@/components/common/DsTable"
import { useUrlState } from "@/lib/useUrlState"
import { t } from "@/i18n/t"
import { formatDateTime } from "@/lib/locale"
import { parseAuditTarget } from "@/lib/auditTarget"
import { useUserNames } from "@/lib/userNames"
import { useRole } from "@/lib/useRole"
import { AuditUserFilter, type PickedUser } from "./AuditUserFilter"
import { FilterBar } from "@/components/table/FilterBar"
import { ResetFilters } from "@/components/table/ResetFilters"
import { bagFromUrl, isComplete, serializeCond, urlKey, withoutKey, type FilterBag, type FilterDef } from "@/components/table/filters"

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

type Shown = { key: string; rows: AuditRecord[]; next: string; total: number | null }
type SortField = "time" | "actor" | "permission" | "method" | "status"

const COLUMNS = ["time", "actor", "permission", "method", "route", "status", "target", "changes"] as const

/** What a request changed: «поле: було → стало»; a secret or an unlisted field shows only its name. */
function AuditChanges({ changes }: { changes: AuditRecord["Changes"] }) {
  if (!changes || changes.length === 0) return <span className="text-muted-foreground">—</span>
  return <ul className="flex flex-col gap-0.5 py-1 text-xs">{changes.map((change) => <li key={change.Field} className="whitespace-normal">
    <span className="font-medium text-foreground">{change.Field}</span>{": "}
    {change.Redacted ? <span className="text-muted-foreground">{t("admin.audit.changes.hidden")}</span>
      : <><span className="text-muted-foreground line-through">{change.Before || t("admin.audit.changes.empty")}</span>{" → "}<span className="text-foreground">{change.After || t("admin.audit.changes.empty")}</span></>}
  </li>)}</ul>
}

function ExportCsv({ filters, disabled }: { filters: AuditFilters; disabled: boolean }) {
  const [busy, setBusy] = useState(false)
  async function download() {
    setBusy(true)
    try {
      const { blob, filename } = await apiGetBlob(auditExportPath(filters))
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = filename ?? "audit-log.csv"
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast.error(overloadOr(err, t("admin.audit.exportError")))
    } finally {
      setBusy(false)
    }
  }
  return <Button type="button" variant="outline" disabled={disabled} busy={busy} busyLabel={t("busy.exporting")} onClick={() => void download()}><Download aria-hidden="true" className="mr-2 h-4 w-4" />{t("admin.audit.exportCsv")}</Button>
}

export function AuditLogPage() {
  const { can } = useRole()
  // The filters are chips (the table standard, filters in the address as f.<key>); the person stays a picker: names, not ids.
  const defs = useMemo<FilterDef[]>(() => [
    { key: "permission", label: t("admin.audit.col.permission"), type: "text", ops: ["contains"] },
    { key: "route", label: t("admin.audit.col.route"), type: "text", ops: ["contains"] },
    { key: "method", label: t("admin.audit.filter.method"), type: "choice", single: true, ops: ["in"], options: METHODS.map((value) => ({ value, label: value === "GET" ? t("admin.audit.filter.methodGet") : value })) },
    { key: "status", label: t("admin.audit.filter.status"), type: "choice", single: true, ops: ["in"], options: STATUS_FILTERS.map((value) => ({ value, label: t(`admin.audit.filter.status_${value}`) })) },
    { key: "kind", label: t("admin.audit.filter.kindLabel"), type: "choice", single: true, ops: ["in"], options: TARGET_KINDS.map((kind) => ({ value: kind, label: t(`admin.audit.target.${kind}`) })) },
    { key: "targetID", label: t("admin.audit.filter.targetIDLabel"), type: "text", ops: ["is"] },
    { key: "period", label: t("admin.audit.col.time"), type: "date" },
  ], [])
  const [url, setUrl] = useUrlState({ actor: "", actorName: "", ...Object.fromEntries(defs.map((def) => [urlKey(def.key), ""])), sort: "time", dir: "desc" })
  const [pinned, setPinned] = useState<string[]>([])
  const bag = bagFromUrl(url, defs)
  const setBag = (next: FilterBag) => setUrl(Object.fromEntries(defs.map((def) => [urlKey(def.key), serializeCond(next[def.key])])))
  const first = (key: string) => (isComplete(bag[key]) ? bag[key].v[0] : "")
  const permission = first("permission")
  const route = first("route")
  const targetID = first("targetID")
  const method = first("method")
  const status = first("status")
  const targetKind = first("kind")
  const period = bag.period
  const fromDay = isComplete(period) && period.op !== "before" ? period.v[0] ?? "" : ""
  const toDay = isComplete(period) ? (period.op === "before" ? period.v[0] : period.op === "between" ? period.v[1] ?? "" : "") : ""
  const user: PickedUser | null = url.actor ? { id: url.actor, name: url.actorName || url.actor.slice(0, 8) } : null
  const sortField = url.sort as SortField
  const sortDir = url.dir === "asc" ? "asc" : "desc"
  const [reload, setReload] = useState(0)
  // The shown rows stay on screen while a changed filter loads, so the table never flashes empty.
  const [data, setData] = useState<Shown | null>(null)
  const [failure, setFailure] = useState<{ key: string; cause: unknown } | null>(null)
  const [more, setMore] = useState<{ key: string; loading: boolean; error: unknown } | null>(null)
  // Answers of anything but the latest request are dropped.
  const latest = useRef(0)

  const from = toInstant(fromDay ? `${fromDay}T00:00` : "")
  const to = toInstant(toDay ? `${toDay}T23:59` : "", true)
  const badRange = !!from && !!to && to < from
  const actorID = user?.id ?? ""
  const filters: AuditFilters = { actorID, permission, route, method, status, from, to, targetKind, targetID }
  const key = `${JSON.stringify(filters)}|${reload}`

  useEffect(() => {
    if (badRange) { latest.current++; return }
    const request = ++latest.current
    const query: AuditFilters = { actorID, permission, route, method, status, from, to, targetKind, targetID }
    listAuditLog(query)
      .then((page) => { if (request === latest.current) { setData({ key, rows: page.Items, next: page.NextCursor, total: page.Total }); setFailure(null) } })
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

  const { me } = useRole()
  // «Сьогодні» is the local day the page was opened on.
  const [todayDay] = useState(() => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10))
  const presetsActive = { mine: !!me && url.actor === me.ID, errors: status === "5xx", today: isComplete(period) && period.op === "after" && period.v[0] === todayDay }
  const reset = () => { setUrl({ actor: "", actorName: "", ...Object.fromEntries(defs.map((def) => [urlKey(def.key), ""])) }) }
  const filterControls = <>
    {can("users.read") && <FilterField label={t("admin.audit.filter.user")} className="min-w-[min(100%,16rem)] flex-1 lg:max-w-xs">
      <AuditUserFilter value={user} onChange={(picked) => setUrl({ actor: picked?.id ?? "", actorName: picked?.name ?? "" })} />
    </FilterField>}
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("admin.audit.presets")}>
      <Button type="button" variant={presetsActive.mine ? "default" : "outline"} aria-pressed={presetsActive.mine} disabled={!me} onClick={() => me && setUrl(presetsActive.mine ? { actor: "", actorName: "" } : { actor: me.ID, actorName: `${me.FirstName} ${me.LastName}`.trim() || me.Email })}>{t("admin.audit.preset.mine")}</Button>
      <Button type="button" variant={presetsActive.errors ? "default" : "outline"} aria-pressed={presetsActive.errors} onClick={() => setBag(presetsActive.errors ? withoutKey(bag, "status") : { ...bag, status: { op: "in", v: ["5xx"] } })}>{t("admin.audit.preset.errors")}</Button>
      <Button type="button" variant={presetsActive.today ? "default" : "outline"} aria-pressed={presetsActive.today} onClick={() => setBag(presetsActive.today ? withoutKey(bag, "period") : { ...bag, period: { op: "after", v: [todayDay] } })}>{t("admin.audit.preset.today")}</Button>
    </div>
    <FilterBar defs={defs} bag={bag} onChange={setBag} pinned={pinned} onPinned={setPinned} />
    <ResetFilters active={filtered} onReset={reset} />
    {badRange && <p id="audit-range-error" role="alert" className="text-xs text-destructive">{t("admin.audit.filter.rangeError")}</p>}
  </>

  return (
    <div className="flex min-h-full min-w-0 flex-col md:h-full md:min-h-0 gap-4">
      <PageHeader title={t("admin.nav.audit")} sub={t("admin.audit.sub")} count={data?.total ?? undefined}
        actions={<ExportCsv filters={filters} disabled={!data || badRange} />}
        filters={<div role="group" aria-label={t("admin.audit.filter.groupLabel")} className="flex flex-wrap items-center gap-x-3 gap-y-3">{filterControls}</div>} />

      <TableWrap label={t("admin.audit.table")} rows={10} className="min-h-0">
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
                    <td><AuditChanges changes={row.Changes} /></td>
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
          <Button type="button" variant="outline" onClick={loadMore} busy={!!moreState?.loading} busyLabel={t("busy.loading")}>{t("admin.audit.showMore")}</Button>
        ) : null}
        <span className="inline-flex w-5 justify-center">{refreshing && !!data && <Spinner size="sm" label={t("admin.table.updating")} />}</span>
      </div>
    </div>
  )
}
