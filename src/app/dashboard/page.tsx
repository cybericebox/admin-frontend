"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { apiGet } from "@/api/client"
import { listEvents, type Event } from "@/api/events/catalog"
import { useRole } from "@/lib/useRole"
import { getInfrastructureStatus, getInfrastructureSummary, type InfrastructureStatus, type InfrastructureSummary } from "@/api/infrastructure"
import { RefreshIndicator } from "@/components/infrastructure/RefreshIndicator"
import { formatNumber } from "@/lib/locale"
import { usePolling } from "@/lib/usePolling"
import { t } from "@/i18n/t"
import { LoadingArea } from "@/components/ui/spinner"
import { LoadError } from "@/components/ui/load-error"
import { EmptyState } from "@/components/ui/empty-state"

type UserStats = { Total: number }
type NotificationStats = { Total: number; ByStatus: { Key: string; Count: number }[]; ByChannel?: { Channel: string; Status: string; Count: number }[] }

function Metric({ label, value, href, hint }: { label: string; value: React.ReactNode; href: string; hint?: string }) {
  return <Link href={href} className="group flex min-h-28 flex-col justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
    <span className="flex items-start justify-between gap-3 text-sm text-muted-foreground">{label}<ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0 opacity-50 group-hover:opacity-100" /></span>
    <span className="flex flex-col gap-0.5"><strong className="text-2xl font-semibold tabular-nums text-foreground">{value}</strong>{hint && <span className="text-xs text-muted-foreground">{hint}</span>}</span>
  </Link>
}

export default function Page() {
  const { can } = useRole()
  const usersAllowed = can("users.read")
  const eventsAllowed = can("events.read")
  const notificationsAllowed = can("notifications.templates.read")
  const infrastructureAllowed = can("infrastructure.read")
  const [users, setUsers] = useState<UserStats | null>(null)
  const [events, setEvents] = useState<Event[] | null>(null)
  const [eventTotal, setEventTotal] = useState<number | null>(null)
  const [notifications, setNotifications] = useState<NotificationStats | null>(null)
  const [infrastructure, setInfrastructure] = useState<InfrastructureStatus | null>(null)
  const [summary, setSummary] = useState<InfrastructureSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [failedFeeds, setFailedFeeds] = useState(0)
  const [failCause, setFailCause] = useState<unknown>(undefined)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      let failures = 0
      let firstCause: unknown
      const [u, e, n] = await Promise.all([
        usersAllowed ? apiGet<UserStats>("/api/users/stats").catch((cause) => { failures++; firstCause ??= cause; return null }) : null,
        eventsAllowed ? listEvents({ pageSize: 5 }).catch((cause) => { failures++; firstCause ??= cause; return null }) : null,
        notificationsAllowed ? apiGet<NotificationStats>("/api/notifications/stats?days=7").catch((cause) => { failures++; firstCause ??= cause; return null }) : null,
      ])
      if (cancelled) return
      setUsers(u)
      setEvents(e?.Items ?? null)
      setEventTotal(e?.Total ?? null)
      setNotifications(n)
      setFailedFeeds(failures)
      setFailCause(firstCause)
      setLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [usersAllowed, eventsAllowed, notificationsAllowed, retry])

  // The infrastructure tiles poll on their own; a failed poll only blanks them.
  const loadInfrastructure = useCallback(async () => {
    const [nextStatus, nextSummary] = await Promise.allSettled([getInfrastructureStatus(), getInfrastructureSummary()])
    setInfrastructure(nextStatus.status === "fulfilled" ? nextStatus.value : null)
    setSummary(nextSummary.status === "fulfilled" ? nextSummary.value : null)
  }, [])
  const { updatedAt, refreshing } = usePolling(loadInfrastructure, infrastructureAllowed)

  const unavailable = "—"
  const percent = (value: number | null | undefined) => value === null || value === undefined ? unavailable : `${formatNumber(value, { maximumFractionDigits: 1 })}%`
  const stands = summary?.Stands
  // Every lab on the infrastructure counts as active: team stands (moderators team included) and catalog test labs.
  const testLabsActive = summary?.TestLabs?.Active ?? 0
  const labsActive = stands ? stands.Active + testLabsActive : unavailable
  const infrastructureLabel = !infrastructure ? unavailable : !infrastructure.Available ? t("admin.dashboard.infra.disconnected") : infrastructure.Healthy ? t("admin.dashboard.infra.running") : t("admin.dashboard.infra.attention")
  // Failed deliveries are counted per channel: a dispatch whose in-app copy arrived is "done" even when its email failed.
  const notificationErrors = (notifications?.ByChannel ?? []).reduce((sum, item) => item.Status === "error" ? sum + item.Count : sum, 0)

  return <div className="flex min-h-full flex-col gap-7">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-semibold text-foreground">{t("admin.dashboard.title")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("admin.dashboard.subtitle")}</p></div>{infrastructureAllowed && <RefreshIndicator updatedAt={updatedAt} refreshing={refreshing} />}</div>
    {loading ? <LoadingArea className="flex-1" label={t("admin.loading")} /> : failedFeeds > 0 && failedFeeds === [usersAllowed, eventsAllowed, notificationsAllowed].filter(Boolean).length ? <LoadError error={failCause} onRetry={() => { setLoading(true); setRetry((current) => current + 1) }} className="flex-1" /> : <>
      {failedFeeds > 0 && <LoadError message={t("admin.dashboard.partialError")} error={failCause} compact onRetry={() => { setLoading(true); setRetry((current) => current + 1) }} />}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {usersAllowed && <Metric label={t("admin.dashboard.users")} value={users?.Total ?? unavailable} href="/analytics/users" />}
        {eventsAllowed && <Metric label={t("admin.dashboard.events")} value={eventTotal ?? unavailable} href="/events" />}
        {notificationsAllowed && <Metric label={t("admin.dashboard.deliveryErrors7d")} value={notifications ? notificationErrors : unavailable} href="/analytics/notifications" />}
        {infrastructureAllowed && <Metric label={t("admin.dashboard.infrastructure")} value={infrastructureLabel} href="/labs" />}
        {infrastructureAllowed && <Metric label={t("admin.dashboard.standsFailed")} value={stands?.Failed ?? unavailable} href="/labs?status=failed" />}
        {infrastructureAllowed && <Metric label={t("admin.dashboard.standsActive")} value={labsActive} hint={stands && testLabsActive > 0 ? t("admin.dashboard.testLabsActive", { count: testLabsActive }) : undefined} href="/labs?status=active" />}
        {infrastructureAllowed && <Metric label={t("admin.dashboard.clusterCpu")} value={percent(summary?.Capacity?.CPUPercent)} href="/labs#capacity" />}
        {infrastructureAllowed && <Metric label={t("admin.dashboard.clusterMemory")} value={percent(summary?.Capacity?.MemoryPercent)} href="/labs#capacity" />}
      </div>
      {eventsAllowed && <section className="rounded-lg border border-border bg-card" aria-labelledby="recent-events-heading">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4"><h3 id="recent-events-heading" className="text-base font-semibold text-foreground">{t("admin.dashboard.recentEvents")}</h3><Link href="/events" className="text-sm font-medium text-primary hover:underline">{t("admin.dashboard.allEvents")}</Link></div>
        {events === null ? <LoadError message={t("admin.dashboard.eventsError")} error={failCause} compact onRetry={() => { setLoading(true); setRetry((current) => current + 1) }} /> : events.length === 0 ? <EmptyState message={t("admin.events.emptyInitial")} compact /> : <ul className="divide-y divide-border">{events.map((event) => <li key={event.ID} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm"><span className="min-w-0 break-words font-medium text-foreground">{event.Name || event.Tag}</span><span className="text-muted-foreground">{t(`admin.events.status.${event.Status}`)}</span></li>)}</ul>}
      </section>}
    </>}
  </div>
}
