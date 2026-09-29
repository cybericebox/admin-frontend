"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { apiGet } from "@/api/client"
import { listEvents, type Event } from "@/api/events/catalog"
import { useRole } from "@/lib/useRole"
import { t } from "@/i18n/t"
import { LoadingArea } from "@/components/ui/spinner"
import { LoadError } from "@/components/ui/load-error"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"

type UserStats = { Total: number }
type NotificationStats = { Total: number; ByStatus: { Key: string; Count: number }[] }
type InfrastructureStatus = { Available: boolean; Healthy: boolean }

function Metric({ label, value, href }: { label: string; value: React.ReactNode; href: string }) {
  return <Link href={href} className="group flex min-h-28 flex-col justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
    <span className="flex items-start justify-between gap-3 text-sm text-muted-foreground">{label}<ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0 opacity-50 group-hover:opacity-100" /></span>
    <strong className="text-2xl font-semibold tabular-nums text-foreground">{value}</strong>
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
  const [loading, setLoading] = useState(true)
  const [failedFeeds, setFailedFeeds] = useState(0)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      let failures = 0
      const [u, e, n, i] = await Promise.all([
        usersAllowed ? apiGet<UserStats>("/api/users/stats").catch(() => { failures++; return null }) : null,
        eventsAllowed ? listEvents({ pageSize: 5 }).catch(() => { failures++; return null }) : null,
        notificationsAllowed ? apiGet<NotificationStats>("/api/notifications/stats?days=7").catch(() => { failures++; return null }) : null,
        infrastructureAllowed ? apiGet<InfrastructureStatus>("/api/infrastructure/status").catch(() => { failures++; return null }) : null,
      ])
      if (cancelled) return
      setUsers(u)
      setEvents(e?.Items ?? null)
      setEventTotal(e?.Total ?? null)
      setNotifications(n)
      setInfrastructure(i)
      setFailedFeeds(failures)
      setLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [usersAllowed, eventsAllowed, notificationsAllowed, infrastructureAllowed, retry])

  const unavailable = "—"
  const infrastructureLabel = !infrastructure ? unavailable : !infrastructure.Available ? t("admin.dashboard.infra.disconnected") : infrastructure.Healthy ? t("admin.dashboard.infra.running") : t("admin.dashboard.infra.attention")
  const notificationErrors = notifications?.ByStatus?.find((item) => item.Key === "error")?.Count ?? 0

  return <div className="flex min-h-full flex-col gap-7">
    <div><h2 className="text-xl font-semibold text-foreground">{t("admin.dashboard.title")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("admin.dashboard.subtitle")}</p></div>
    {loading ? <LoadingArea className="flex-1" label={t("admin.loading")} /> : failedFeeds > 0 && failedFeeds === [usersAllowed, eventsAllowed, notificationsAllowed, infrastructureAllowed].filter(Boolean).length ? <LoadError onRetry={() => { setLoading(true); setRetry((current) => current + 1) }} className="flex-1" /> : <>
      {failedFeeds > 0 && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground"><span>{t("admin.dashboard.partialError")}</span><Button type="button" size="sm" variant="outline" onClick={() => { setLoading(true); setRetry((current) => current + 1) }}>{t("admin.dashboard.retry")}</Button></div>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {usersAllowed && <Metric label={t("admin.dashboard.users")} value={users?.Total ?? unavailable} href="/analytics/users" />}
        {eventsAllowed && <Metric label={t("admin.dashboard.events")} value={eventTotal ?? unavailable} href="/events" />}
        {notificationsAllowed && <Metric label={t("admin.dashboard.deliveryErrors7d")} value={notifications ? notificationErrors : unavailable} href="/analytics/notifications" />}
        {infrastructureAllowed && <Metric label={t("admin.dashboard.infrastructure")} value={infrastructureLabel} href="/labs" />}
      </div>
      {eventsAllowed && <section className="rounded-lg border border-border bg-card" aria-labelledby="recent-events-heading">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4"><h3 id="recent-events-heading" className="text-base font-semibold text-foreground">{t("admin.dashboard.recentEvents")}</h3><Link href="/events" className="text-sm font-medium text-primary hover:underline">{t("admin.dashboard.allEvents")}</Link></div>
        {events === null ? <p className="px-5 py-7 text-sm text-muted-foreground">{t("admin.dashboard.eventsError")}</p> : events.length === 0 ? <EmptyState message={t("admin.events.emptyInitial")} compact /> : <ul className="divide-y divide-border">{events.map((event) => <li key={event.ID} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm"><span className="min-w-0 break-words font-medium text-foreground">{event.Name || event.Tag}</span><span className="text-muted-foreground">{t(`admin.events.status.${event.Status}`)}</span></li>)}</ul>}
      </section>}
    </>}
  </div>
}
