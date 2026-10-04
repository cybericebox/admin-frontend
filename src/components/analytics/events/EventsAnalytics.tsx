"use client"

import { AnalyticsChart, CsvExportButton, KpiTile, donutOption, lineOption, useAnalyticsResource, type ChartTheme } from "@/components/analytics"
import { AnalyticsBlock } from "@/components/analytics/AnalyticsBlock"
import { t } from "@/i18n/t"
import type { EventsAnalytics as EventsReport } from "@/api/platformAnalyticsCatalog"
import { EventsTable } from "./EventsTable"
import { UpcomingEventsTable } from "./UpcomingEventsTable"
import { formatCount } from "./format"

/** Body of the «Заходи» section: KPIs, events and registrations over time, events by status, the per-event table and the upcoming events. */
export function EventsAnalytics() {
  const resource = useAnalyticsResource<EventsReport>("events")
  const { data, loading, error, reload } = resource
  const empty = !loading && !error && !!data && data.Series.every((day) => day.EventsCreated + day.EventsStarted + day.Registrations === 0)
  const statusSlices = (data?.Statuses ?? []).filter((s) => s.Events > 0).map((s) => ({ name: t(`admin.events.lifecycle.${s.Status}`), value: s.Events }))
  const seriesOption = data && !empty ? (theme: ChartTheme) => lineOption([
    { name: t("admin.platformAnalytics.events.series.created"), data: data.Series.map((d) => [d.Day, d.EventsCreated]) },
    { name: t("admin.platformAnalytics.events.series.started"), data: data.Series.map((d) => [d.Day, d.EventsStarted]) },
    { name: t("admin.platformAnalytics.events.series.registrations"), data: data.Series.map((d) => [d.Day, d.Registrations]) },
  ], { theme }) : undefined
  return <div className="space-y-6">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiTile label={t("admin.platformAnalytics.events.kpi.events")} hint={t("admin.platformAnalytics.events.kpi.eventsHint")} href="/events"
        value={formatCount(data?.Totals.Events)} loading={loading} empty={!!error} />
      <KpiTile label={t("admin.platformAnalytics.events.kpi.created")} hint={t("admin.platformAnalytics.events.kpi.createdHint")}
        value={formatCount(data?.Totals.Created)} loading={loading} empty={!!error} />
      <KpiTile label={t("admin.platformAnalytics.events.kpi.started")} hint={t("admin.platformAnalytics.events.kpi.startedHint")}
        value={formatCount(data?.Totals.Started)} loading={loading} empty={!!error} />
      <KpiTile label={t("admin.platformAnalytics.events.kpi.registrations")} hint={t("admin.platformAnalytics.events.kpi.registrationsHint")}
        value={formatCount(data?.Totals.Registrations)} loading={loading} empty={!!error} />
    </div>
    <div className="grid gap-4 xl:grid-cols-3">
      <AnalyticsBlock className="xl:col-span-2" title={t("admin.platformAnalytics.events.series.title")}
        actions={<CsvExportButton section="events" table="series" disabled={loading || !!error || empty} />}>
        <AnalyticsChart option={seriesOption} loading={loading} error={error} empty={empty} onRetry={reload}
          ariaLabel={t("admin.platformAnalytics.events.series.title")} />
      </AnalyticsBlock>
      <AnalyticsBlock title={t("admin.platformAnalytics.events.status.title")} hint={t("admin.platformAnalytics.events.status.hint")}>
        <AnalyticsChart option={(theme) => donutOption(statusSlices, { theme })} loading={loading} error={error} empty={statusSlices.length === 0} onRetry={reload}
          ariaLabel={t("admin.platformAnalytics.events.status.title")} emptyMessage={t("admin.platformAnalytics.events.status.empty")} />
      </AnalyticsBlock>
    </div>
    <EventsTable rows={data?.Events} total={data?.EventsTotal ?? 0} limit={data?.EventsLimit ?? 0} loading={loading} error={error} onRetry={reload} />
    <UpcomingEventsTable rows={data?.Upcoming} loading={loading} error={error} onRetry={reload} />
  </div>
}
