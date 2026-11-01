"use client"

import { useCallback, useState } from "react"
import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { ATTENTION_HREF, getDashboardSummary, type DashboardSummary } from "@/api/dashboard"
import { RefreshIndicator } from "@/components/infrastructure/RefreshIndicator"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadError } from "@/components/ui/load-error"
import { LoadingArea } from "@/components/ui/spinner"
import { PageHeader } from "@/components/ui/page-header"
import { Sparkline } from "@/components/ui/sparkline"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatListDateTime, formatNumber } from "@/lib/locale"
import { usePolling } from "@/lib/usePolling"
import { useRole } from "@/lib/useRole"
import { t } from "@/i18n/t"

const dash = (value: number | null | undefined) => value === undefined || value === null ? "—" : formatNumber(value)
const percent = (value: number | null | undefined) => value === undefined || value === null ? "—" : `${formatNumber(value, { maximumFractionDigits: 1 })}%`

function Section({ title, children, id }: { title: string; children: React.ReactNode; id: string }) {
  return <Card role="region" aria-labelledby={id}>
    <CardHeader><CardTitle id={id} className="text-base">{title}</CardTitle></CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-0.5 text-2xl font-semibold tabular-nums text-foreground">{value}</dd></div>
}

export default function Page() {
  const { can } = useRole()
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [error, setError] = useState<{ cause: unknown } | null>(null)
  // A refresh runs in the background: the page keeps what it shows, only the first load shows the loader.
  const load = useCallback(async () => {
    try {
      setSummary(await getDashboardSummary())
      setError(null)
    } catch (cause) {
      setError({ cause })
    }
  }, [])
  const { updatedAt, refreshing, refresh } = usePolling(load, true)

  const attention = summary?.Attention ?? []
  const events = summary?.Events ?? []
  const trends = summary?.Trends
  const infra = summary?.Infra
  const canEvent = can("events.write")
  const canInvite = can("users.invite")

  return <div className="flex min-h-full flex-col gap-5">
    <PageHeader title={t("admin.dashboard.title")} sub={t("admin.dashboard.subtitle")} actions={<>
      <RefreshIndicator updatedAt={updatedAt} refreshing={refreshing} />
      {canInvite && <Button asChild variant="outline"><Link href="/users?invite=1">{t("admin.dashboard.action.invite")}</Link></Button>}
      {canEvent && <Button asChild><Link href="/events/new">{t("admin.dashboard.action.createEvent")}</Link></Button>}
    </>} />
    {!summary && !error ? <LoadingArea className="flex-1" label={t("admin.loading")} />
      : !summary ? <LoadError message={t("admin.dashboard.loadError")} error={error?.cause} onRetry={() => void refresh(true)} className="flex-1" />
      : <>
        {error && <LoadError message={t("admin.dashboard.partialError")} error={error.cause} compact onRetry={() => void refresh(true)} />}
        <Section id="dash-attention" title={t("admin.dashboard.attention")}>
          {attention.length === 0 ? <EmptyState compact message={t("admin.dashboard.attentionNone")} /> : <ul className="divide-y divide-border">{attention.map((item) => (
            <li key={item.Kind} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0">
              <Link href={ATTENTION_HREF[item.Kind]} className="inline-flex min-w-0 items-center gap-2 text-sm font-medium text-foreground hover:underline">
                {t(`admin.dashboard.attention.${item.Kind}`, { count: item.Count })}<ArrowUpRight aria-hidden="true" className="h-4 w-4 opacity-60" />
              </Link>
              {item.Items && item.Items.length > 0 && <span className="flex flex-wrap gap-x-3 gap-y-1 text-sm">{item.Items.map((entry) => <Link key={entry.Href + entry.Label} href={entry.Href} className="text-primary hover:underline">{entry.Label}</Link>)}</span>}
            </li>
          ))}</ul>}
        </Section>

        {summary.Events != null && <Section id="dash-events" title={t("admin.dashboard.nowSoon")}>
          {events.length === 0 ? <EmptyState compact message={t("admin.dashboard.nowSoonNone")} /> : <ul className="divide-y divide-border">{events.map((event) => (
            <li key={event.ID} className="grid grid-cols-1 gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
              <span className="flex min-w-0 flex-wrap items-center gap-2">
                <Link href={`/events/detail?id=${encodeURIComponent(event.ID)}`} className="min-w-0 truncate text-sm font-medium text-foreground hover:underline">{event.Name || event.Tag}</Link>
                <Badge tone={event.Running ? "ok" : "info"} size="sm">{event.Running ? t("admin.dashboard.running") : t(`admin.events.lifecycle.${event.LifecycleStatus ?? "not_published"}`)}</Badge>
              </span>
              <span className="text-sm text-muted-foreground">{event.StartAt ? formatListDateTime(event.StartAt) : "—"}</span>
              <span className="text-sm tabular-nums text-muted-foreground">{t("admin.dashboard.eventCounts", { participants: dash(event.Participants), teams: dash(event.Teams), stands: event.StandsTotal === undefined ? "—" : `${event.StandsReady ?? 0}/${event.StandsTotal}` })}</span>
            </li>
          ))}</ul>}
        </Section>}

        {trends && <Section id="dash-trends" title={t("admin.dashboard.trends")}>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {([["signups", trends.Signups], ["activeUsers", trends.ActiveUsers], ["solves", trends.Solves]] as const).map(([key, values]) => (
              <div key={key} className="flex items-end justify-between gap-3">
                <Stat label={t(`admin.dashboard.trend.${key}`)} value={dash(values.reduce((sum, value) => sum + value, 0))} />
                <Sparkline values={values} label={t("admin.dashboard.trendLabel", { name: t(`admin.dashboard.trend.${key}`), values: values.join(", ") })} />
              </div>
            ))}
          </dl>
        </Section>}

        {infra && <Section id="dash-infra" title={t("admin.dashboard.infrastructure")}>
          <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label={t("admin.dashboard.clusterCpu")} value={percent(infra.CPUPercent)} />
            <Stat label={t("admin.dashboard.clusterMemory")} value={percent(infra.MemoryPercent)} />
            <Stat label={t("admin.dashboard.standsActive")} value={dash(infra.StandsActive)} />
            <Stat label={t("admin.dashboard.standsFailed")} value={dash(infra.StandsFailed)} />
          </dl>
          <p className="mt-3 text-sm"><Link href="/labs" className="text-primary hover:underline">{t("admin.dashboard.openLabs")}</Link></p>
        </Section>}
      </>}
  </div>
}
