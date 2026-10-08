"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, Download } from "lucide-react"
import { AnalyticsBlock } from "@/components/analytics/AnalyticsBlock"
import { DataTable, type Column } from "@/components/analytics/DataTable"
import { KpiTile } from "@/components/analytics/KpiTile"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadError } from "@/components/ui/load-error"
import { LoadingArea } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { apiGetBlob } from "@/api/client"
import { getEventAnalyticsUsage, isForbidden, usageExportPath, type UsageUser } from "@/api/events/analytics"
import { t } from "@/i18n/t"
import { formatBytes, formatCount, formatDateTime, formatDuration } from "./eventAnalyticsFormat"
import { useEventReport } from "./useEventReport"

const P = "admin.events.analytics.usage"
const BLOCK_HEIGHT = 320
const USAGE_POLL_MS = 10_000
const none = "–"

type UsageState = "online" | "offline" | "never"
/** The connection state comes from the last handshake alone (the server decides «online»), never from traffic. */
export const usageState = (user: UsageUser): UsageState => user.VPN.Online ? "online" : user.VPN.LastHandshakeAt ? "offline" : "never"
const stateRank: Record<UsageState, number> = { online: 0, offline: 1, never: 2 }
const userName = (user: UsageUser) => user.UserName || t(`${P}.unnamed`)
const time = (iso: string | null) => (iso ? Date.parse(iso) : null)

function StateTag({ state }: { state: UsageState }) {
  return <Badge size="sm" tone={state === "online" ? "ok" : "neutral"}>{t(`${P}.state.${state}`)}</Badge>
}

function Detail({ user }: { user: UsageUser }) {
  return <div className="grid gap-4 bg-secondary/40 px-4 py-3 text-sm md:grid-cols-[minmax(14rem,1fr)_minmax(20rem,2fr)]">
    <section aria-label={t(`${P}.detail.sessions`)}>
      <h3 className="mb-2 text-xs font-semibold text-muted-foreground">{t(`${P}.detail.sessions`)}</h3>
      {user.VPN.Recent.length === 0 ? <p className="text-xs text-muted-foreground">{t(`${P}.detail.noSessions`)}</p> : <ul className="space-y-1">
        {user.VPN.Recent.map((session) => <li key={session.StartedAt}>{t(`${P}.detail.session`, { from: formatDateTime(session.StartedAt), to: formatDateTime(session.EndedAt), time: formatDuration(session.Seconds) })}</li>)}
      </ul>}
      {user.VPN.Sessions > user.VPN.Recent.length && <p className="mt-1 text-xs text-muted-foreground">{t(`${P}.detail.moreSessions`, { count: user.VPN.Sessions - user.VPN.Recent.length })}</p>}
    </section>
    <section aria-label={t(`${P}.detail.labs`)}>
      <h3 className="mb-2 text-xs font-semibold text-muted-foreground">{t(`${P}.detail.labs`)}</h3>
      {user.Labs.length === 0 ? <p className="text-xs text-muted-foreground">{t(`${P}.detail.noLabs`)}</p> : <div className="ib-table-wrap"><table className="ib-table" aria-label={t(`${P}.detail.labs`)}>
        <thead><tr>
          <th scope="col">{t(`${P}.detail.task`)}</th>
          <th scope="col">{t(`${P}.detail.access`)}</th>
          <th scope="col" className="ib-table__num">{t(`${P}.detail.requests`)}</th>
          <th scope="col" className="ib-table__num">{t(`${P}.detail.traffic`)}</th>
          <th scope="col">{t(`${P}.detail.last`)}</th>
        </tr></thead>
        <tbody>{user.Labs.map((lab) => <tr key={`${lab.ChallengeID}:${lab.Surface}`}>
          <td>{lab.Task || none}</td>
          <td>{t(`${P}.surface.${lab.Surface}`)}</td>
          <td className="ib-table__num">
            <div>{formatCount(lab.Attempts)}</div>
            {lab.Surface === "vpn" && (lab.LabInitiatedAttempts ?? 0) > 0 && <div className="mt-1 text-xs text-muted-foreground">
              {t(`${P}.detail.labInitiated`, { count: formatCount(lab.LabInitiatedAttempts ?? 0) })}
            </div>}
          </td>
          <td className="ib-table__num">{formatBytes(lab.BytesIn + lab.BytesOut)}</td>
          <td>{formatDateTime(lab.LastAt)}</td>
        </tr>)}</tbody>
      </table></div>}
    </section>
  </div>
}

function ExportButton({ eventID, disabled }: { eventID: string; disabled: boolean }) {
  const [busy, setBusy] = useState(false)
  async function download() {
    setBusy(true)
    try {
      const { blob, filename } = await apiGetBlob(usageExportPath(eventID))
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = filename ?? "analytics-usage.csv"
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch {
      toast.error(t("admin.platformAnalytics.csv.failed"))
    } finally {
      setBusy(false)
    }
  }
  return <Button type="button" variant="outline" size="sm" disabled={disabled} busy={busy} onClick={() => void download()}>
    {!busy && <Download aria-hidden="true" className="mr-2 h-4 w-4" />}{t("admin.platformAnalytics.csv.export")}
  </Button>
}

function Block({ height, children }: { height: number; children: React.ReactNode }) {
  return <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-card" style={{ minHeight: height }}>{children}</div>
}

/**
 * «Використання» of one event, read-only: per participant whether the VPN is connected now
 * (from the last handshake), sessions and time online, VPN traffic and the web proxy use.
 * Counts and times only; nothing identifies a network address.
 */
export function EventUsageTable({ eventID }: { eventID: string }) {
  const report = useEventReport(() => getEventAnalyticsUsage(eventID), eventID, { pollMs: USAGE_POLL_MS })
  const [open, setOpen] = useState<string | null>(null)
  const data = report.data
  const title = t(`${P}.title`)

  let body
  if (report.failed && !data) {
    body = <Block height={BLOCK_HEIGHT}><div className="flex flex-1">{isForbidden(report.error)
      ? <EmptyState className="flex-1" message={t("admin.events.analytics.noAccess")} />
      : <LoadError className="flex-1" message={t(`${P}.loadFailed`)} error={report.error} onRetry={report.retry} />}</div></Block>
  } else if (report.loading) {
    body = <Block height={BLOCK_HEIGHT}><LoadingArea className="h-full min-h-[inherit] flex-1" label={t("admin.loading")} /></Block>
  } else if (data && !data.Available) {
    body = <Block height={BLOCK_HEIGHT}><div className="flex flex-1"><EmptyState className="flex-1" message={t(`${P}.unavailable`)} /></div></Block>
  } else {
    const s = data?.Summary
    const columns: Column<UsageUser>[] = [
      { key: "user", header: t(`${P}.col.participant`), sortValue: (user) => userName(user).toLowerCase(), cell: (user) => {
        const expanded = open === user.UserID
        const Chevron = expanded ? ChevronDown : ChevronRight
        return <span className="flex items-center gap-2">
          <button type="button" aria-expanded={expanded} aria-label={t(`${P}.toggle`, { name: userName(user) })}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => setOpen(expanded ? null : user.UserID)}><Chevron aria-hidden="true" className="h-4 w-4" /></button>
          <span className="flex min-w-0 flex-col"><span className="font-medium text-foreground">{userName(user)}</span><span className="text-xs text-muted-foreground">{user.TeamName}</span></span>
        </span>
      } },
      { key: "state", header: t(`${P}.col.state`), sortValue: (user) => stateRank[usageState(user)], cell: (user) => <StateTag state={usageState(user)} /> },
      { key: "seen", header: t(`${P}.col.seen`), sortValue: (user) => time(user.LastSeenAt), cell: (user) => <span className="whitespace-nowrap">{formatDateTime(user.LastSeenAt)}</span> },
      { key: "lab", header: t(`${P}.col.lab`), sortValue: (user) => time(user.LastLabAt), cell: (user) => <span className="whitespace-nowrap">{formatDateTime(user.LastLabAt)}</span> },
      { key: "last", header: t(`${P}.col.last`), sortValue: (user) => time(user.VPN.LastHandshakeAt), cell: (user) => <span className="whitespace-nowrap">{formatDateTime(user.VPN.LastHandshakeAt)}</span> },
      { key: "sessions", header: t(`${P}.col.sessions`), numeric: true, sortValue: (user) => user.VPN.Sessions, cell: (user) => user.VPN.Sessions === 0 ? none : formatCount(user.VPN.Sessions) },
      { key: "time", header: t(`${P}.col.time`), numeric: true, sortValue: (user) => user.VPN.Seconds, cell: (user) => <span className="whitespace-nowrap">{user.VPN.Sessions === 0 ? none : formatDuration(user.VPN.Seconds)}</span> },
      { key: "traffic", header: t(`${P}.col.traffic`), numeric: true, sortValue: (user) => user.VPN.RxBytes + user.VPN.TxBytes, cell: (user) => <span className="whitespace-nowrap">{user.VPN.Sessions === 0 ? none : formatBytes(user.VPN.RxBytes + user.VPN.TxBytes)}</span> },
      { key: "proxy", header: t(`${P}.col.proxyRequests`), numeric: true, sortValue: (user) => user.Proxy.Requests, cell: (user) => user.Proxy.Requests === 0 ? none : formatCount(user.Proxy.Requests) },
      { key: "proxyTraffic", header: t(`${P}.col.proxyTraffic`), numeric: true, sortValue: (user) => user.Proxy.BytesIn + user.Proxy.BytesOut, cell: (user) => <span className="whitespace-nowrap">{user.Proxy.Requests === 0 ? none : formatBytes(user.Proxy.BytesIn + user.Proxy.BytesOut)}</span> },
      { key: "proxyLast", header: t(`${P}.col.proxyLast`), sortValue: (user) => time(user.Proxy.LastAt), cell: (user) => <span className="whitespace-nowrap">{formatDateTime(user.Proxy.LastAt)}</span> },
    ]
    body = <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile label={t(`${P}.stat.online`)} hint={t(`${P}.stat.onlineHint`)} value={s && formatCount(s.OnlineNow)} sub={s ? t(`${P}.stat.onlineNote`, { users: s.Users }) : undefined} />
        <KpiTile label={t(`${P}.stat.connected`)} hint={t(`${P}.stat.connectedHint`)} value={s && formatCount(s.VPNUsers)} sub={s ? t(`${P}.stat.connectedNote`, { sessions: s.Sessions }) : undefined} />
        <KpiTile label={t(`${P}.stat.time`)} hint={t(`${P}.stat.timeHint`)} value={s && formatDuration(s.OnlineSeconds)} sub={s ? t(`${P}.stat.trafficNote`, { traffic: formatBytes(s.RxBytes + s.TxBytes) }) : undefined} />
        <KpiTile label={t(`${P}.stat.proxy`)} hint={t(`${P}.stat.proxyHint`)} value={s && formatCount(s.ProxyUsers)} sub={s ? t(`${P}.stat.proxyNote`, { requests: formatCount(s.ProxyRequests), traffic: formatBytes(s.ProxyBytes) }) : undefined} />
      </div>
      <DataTable columns={columns} rows={data?.Users} rowKey={(user) => user.UserID} loading={false} error={report.failed ? report.error : undefined} onRetry={report.retry}
        errorMessage={t(`${P}.loadFailed`)} emptyMessage={t(`${P}.empty`)} minHeight={BLOCK_HEIGHT} ariaLabel={t(`${P}.tableLabel`)}
        defaultSort={{ field: "state", direction: "asc" }} renderDetail={(user) => open === user.UserID ? <Detail user={user} /> : null} />
    </div>
  }
  return <AnalyticsBlock title={title} subtitle={t(`${P}.subtitle`)} actions={<ExportButton eventID={eventID} disabled={!data?.Available} />}>{body}</AnalyticsBlock>
}
