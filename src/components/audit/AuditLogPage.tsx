"use client"
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AUDIT_LOG_LIMIT, listAuditLog, type AuditRecord } from "@/api/auditLog"
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

const STATUS_FILTERS = ["ok", "denied", "client", "server"] as const
const PERIODS = { hour: 3_600_000, day: 86_400_000, week: 7 * 86_400_000, month: 30 * 86_400_000 } as const
const TARGET_KINDS = ["event", "team", "user", "agent", "test-lab", "exercise", "challenge", "device"]
const PERIOD_KEYS = Object.keys(PERIODS) as (keyof typeof PERIODS)[]

const matchesStatus = (status: number, filter: string) =>
  filter === "ok" ? status >= 200 && status < 300
  : filter === "denied" ? status === 403
  : filter === "client" ? status >= 400 && status < 500
  : filter === "server" ? status >= 500
  : true

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

export function AuditLogPage() {
  const { can } = useRole()
  const [user, setUser] = useState<PickedUser | null>(null)
  const [permissionInput, setPermissionInput] = useState("")
  const [routeInput, setRouteInput] = useState("")
  const [status, setStatus] = useState("")
  const [period, setPeriod] = useState("")
  const permission = useDebounced(permissionInput.trim())
  const route = useDebounced(routeInput.trim())
  const [reload, setReload] = useState(0)
  // The last answer stays on screen while the next one loads, so the table never flashes empty.
  const [data, setData] = useState<{ key: string; rows: AuditRecord[]; at: number } | null>(null)
  const [failure, setFailure] = useState<{ key: string; cause: unknown } | null>(null)

  const actorID = user?.id ?? ""
  const key = `${actorID}|${permission}|${route}|${reload}`
  useEffect(() => {
    let active = true
    listAuditLog({ actorID, permission, route })
      .then((rows) => { if (active) { setData({ key, rows, at: Date.now() }); setFailure(null) } })
      .catch((cause) => { if (active) setFailure({ key, cause }) })
    return () => { active = false }
  }, [actorID, permission, route, key])

  const failed = failure?.key === key ? failure : null
  const refreshing = !failed && data?.key !== key
  const rows = useMemo(() => {
    const since = period && data ? data.at - PERIODS[period as keyof typeof PERIODS] : 0
    return (data?.rows ?? []).filter((row) => matchesStatus(row.ResponseStatus, status) && (!since || new Date(row.CreatedAt).getTime() >= since))
  }, [data, status, period])
  const filtered = !!(user || permission || route || status || period)
  const names = useUserNames(rows.map((row) => row.ActorID))

  return (
    <div className="frost-panel frost-in flex h-full min-h-0 flex-col overflow-hidden rounded-lg p-6">
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-3">
        {can("users.read") && <AuditUserFilter value={user} onChange={setUser} />}
        <Input value={permissionInput} onChange={(event) => setPermissionInput(event.target.value)} placeholder={t("admin.audit.filter.permission")} aria-label={t("admin.audit.col.permission")} className="min-w-[min(100%,14rem)] flex-1 lg:max-w-xs" />
        <Input value={routeInput} onChange={(event) => setRouteInput(event.target.value)} placeholder={t("admin.audit.filter.route")} aria-label={t("admin.audit.col.route")} className="min-w-[min(100%,14rem)] flex-1 lg:max-w-xs" />
        <SelectMenu value={status} onChange={setStatus} ariaLabel={t("admin.audit.filter.status")} className="min-w-44"
          options={[{ value: "", label: t("admin.audit.filter.statusAll") }, ...STATUS_FILTERS.map((value) => ({ value, label: t(`admin.audit.filter.status${value[0].toUpperCase()}${value.slice(1)}`) }))]} />
        <SelectMenu value={period} onChange={setPeriod} ariaLabel={t("admin.audit.filter.period")} className="min-w-44"
          options={[{ value: "", label: t("admin.audit.filter.periodAll") }, ...PERIOD_KEYS.map((value) => ({ value, label: t(`admin.audit.filter.period${value[0].toUpperCase()}${value.slice(1)}`) }))]} />
      </div>

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

      <div className="mt-auto flex shrink-0 items-center gap-3 border-t border-border pt-4 text-sm text-muted-foreground">
        <span>{t("admin.audit.limitNote", { count: AUDIT_LOG_LIMIT })}</span>
        <span className="inline-flex w-5 justify-center">{refreshing && <Spinner size="sm" label={t("admin.table.updating")} />}</span>
      </div>
    </div>
  )
}
