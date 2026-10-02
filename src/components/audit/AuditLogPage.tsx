import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { listAuditLog, type AuditFilters, type AuditRecord } from "@/api/auditLog"
import { Button } from "@/components/ui/button"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import { Input } from "@/components/ui/input"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadError } from "@/components/ui/load-error"
import { LoadingArea, Spinner } from "@/components/ui/spinner"
import { SelectMenu } from "@/components/ui/select-menu"
import { t } from "@/i18n/t"
import { formatDateTime } from "@/lib/locale"
import { parseAuditTarget } from "@/lib/auditTarget"
import { useUserNames } from "@/lib/userNames"
import { useRole } from "@/lib/useRole"
import { AuditUserFilter, type PickedUser } from "./AuditUserFilter"

const METHODS = ["POST", "PUT", "PATCH", "DELETE", "GET"] as const
const STATUS_FILTERS = ["2xx", "3xx", "4xx", "5xx", "403", "409"] as const
// Kind tokens the daemon handlers set explicitly; route-param kinds (userID, id, ...) are typed by hand.
const TARGET_KINDS = ["event", "team", "user", "agent", "test-lab", "exercise", "challenge", "device"]

const statusTone = (status: number) =>
  status >= 500 ? "bg-[var(--ib-danger-bg)] text-[var(--ib-danger)]"
  : status >= 400 ? "bg-[var(--ib-warn-bg)] text-[var(--ib-warn)]"
  : "bg-[var(--ib-ok-bg)] text-[var(--ib-ok)]"

// A debounced copy of a text filter: the field stays responsive, the request waits.
function useDebounced(value: string, delay = 300): string {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    if (value === debounced) return
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, debounced, delay])
  return debounced
}

// «YYYY-MM-DDTHH:mm» wall clock of the picker -> RFC3339 instant. «to» is inclusive, so it covers its whole minute.
const toInstant = (local: string, endOfMinute = false) => {
  if (!local) return ""
  const at = new Date(local)
  if (Number.isNaN(at.getTime())) return ""
  if (endOfMinute) at.setSeconds(59)
  return at.toISOString().replace(/\.\d{3}Z$/, "Z")
}

type Shown = { key: string; rows: AuditRecord[]; next: string }

export function AuditLogPage() {
  const { can } = useRole()
  const [user, setUser] = useState<PickedUser | null>(null)
  const [permissionInput, setPermissionInput] = useState("")
  const [routeInput, setRouteInput] = useState("")
  const [kindInput, setKindInput] = useState("")
  const [targetIDInput, setTargetIDInput] = useState("")
  const [method, setMethod] = useState("")
  const [status, setStatus] = useState("")
  const [fromLocal, setFromLocal] = useState("")
  const [toLocal, setToLocal] = useState("")
  const permission = useDebounced(permissionInput.trim())
  const route = useDebounced(routeInput.trim())
  const targetKind = useDebounced(kindInput.trim())
  const targetID = useDebounced(targetIDInput.trim())
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
  const rows = data?.rows ?? []
  const filtered = Object.values(filters).some(Boolean)
  const names = useUserNames(rows.map((row) => row.ActorID))

  return (
    <div className="frost-panel frost-in flex h-full min-h-0 flex-col overflow-hidden rounded-lg p-6">
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-3">
        {can("users.read") && <AuditUserFilter value={user} onChange={setUser} />}
        <Input value={permissionInput} onChange={(event) => setPermissionInput(event.target.value)} placeholder={t("admin.audit.filter.permission")} aria-label={t("admin.audit.col.permission")} className="min-w-[min(100%,14rem)] flex-1 lg:max-w-xs" />
        <Input value={routeInput} onChange={(event) => setRouteInput(event.target.value)} placeholder={t("admin.audit.filter.route")} aria-label={t("admin.audit.col.route")} className="min-w-[min(100%,14rem)] flex-1 lg:max-w-xs" />
        <SelectMenu value={method} onChange={setMethod} ariaLabel={t("admin.audit.filter.method")} className="min-w-40"
          options={[{ value: "", label: t("admin.audit.filter.methodAll") }, ...METHODS.map((value) => ({ value, label: value === "GET" ? t("admin.audit.filter.methodGet") : value }))]} />
        <SelectMenu value={status} onChange={setStatus} ariaLabel={t("admin.audit.filter.status")} className="min-w-44"
          options={[{ value: "", label: t("admin.audit.filter.statusAll") }, ...STATUS_FILTERS.map((value) => ({ value, label: t(`admin.audit.filter.status_${value}`) }))]} />
        <Input value={kindInput} onChange={(event) => setKindInput(event.target.value)} list="audit-target-kinds" placeholder={t("admin.audit.filter.targetKind")} aria-label={t("admin.audit.filter.targetKind")} className="min-w-[min(100%,12rem)] flex-1 lg:max-w-[14rem]" />
        <datalist id="audit-target-kinds">{TARGET_KINDS.map((kind) => <option key={kind} value={kind} />)}</datalist>
        <Input value={targetIDInput} onChange={(event) => setTargetIDInput(event.target.value)} placeholder={t("admin.audit.filter.targetID")} aria-label={t("admin.audit.filter.targetID")} className="min-w-[min(100%,14rem)] flex-1 lg:max-w-xs" />
        <DateTimePicker value={fromLocal} onChange={setFromLocal} allowClear aria-label={t("admin.audit.filter.from")} aria-invalid={badRange || undefined} />
        <DateTimePicker value={toLocal} onChange={setToLocal} allowClear aria-label={t("admin.audit.filter.to")} aria-invalid={badRange || undefined} />
      </div>
      {badRange && <p role="alert" className="mb-3 text-sm text-destructive">{t("admin.audit.filter.rangeError")}</p>}

      <div className="relative min-h-0 flex-1 overflow-auto" aria-busy={refreshing}>
        {failed ? (
          <LoadError message={t("admin.audit.loadError")} error={failed.cause} onRetry={() => setReload((value) => value + 1)} className="h-full" />
        ) : !data ? (
          <LoadingArea className="h-full" label={t("admin.loading")} />
        ) : rows.length === 0 ? (
          <EmptyState message={t(filtered ? "admin.audit.emptyFiltered" : "admin.audit.empty")} className="h-full" />
        ) : (
          <table className="w-full min-w-[960px] text-sm">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                {["time", "actor", "permission", "method", "route", "status", "target"].map((column) => <th key={column} className="px-3 py-2 font-medium">{t(`admin.audit.col.${column}`)}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const actor = names[row.ActorID]
                return (
                  <tr key={row.ID} className="border-b border-border/50">
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{formatDateTime(row.CreatedAt)}</td>
                    <td className="px-3 py-2"><Link href={`/users/detail?id=${encodeURIComponent(row.ActorID)}`} className="font-medium text-primary hover:underline">{actor?.name ?? row.ActorID.slice(0, 8)}</Link></td>
                    <td className="px-3 py-2 font-mono text-xs text-foreground">{row.Permission}</td>
                    <td className="px-3 py-2 font-mono text-xs text-foreground">{row.Method}</td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{row.Route}</td>
                    <td className="px-3 py-2"><span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${statusTone(row.ResponseStatus)}`}>{row.ResponseStatus}</span></td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-0.5">
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
          </table>
        )}
      </div>

      <div className="mt-auto flex shrink-0 items-center justify-center gap-3 border-t border-border pt-4 text-sm text-muted-foreground">
        {moreState?.error ? <LoadError compact message={t("admin.audit.loadMoreError")} error={moreState.error} onRetry={loadMore} className="min-h-0 w-auto py-0" /> : null}
        {data?.next && !moreState?.error ? (
          <Button type="button" variant="outline" onClick={loadMore} busy={!!moreState?.loading}>{t("admin.audit.showMore")}</Button>
        ) : null}
        <span className="inline-flex w-5 justify-center">{refreshing && !!data && <Spinner size="sm" label={t("admin.table.updating")} />}</span>
      </div>
    </div>
  )
}
