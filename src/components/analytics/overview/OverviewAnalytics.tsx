"use client"

import { AnalyticsBlock, AnalyticsChart, CsvExportButton, KpiTile, lineOption, useAnalyticsResource, type ChartTheme } from "@/components/analytics"
import { t } from "@/i18n/t"
import type { Metric, OverviewReport } from "@/api/platformAnalyticsOverview"
import { deltaOf, formatCount, previousLine } from "./format"

/** Body of the «Огляд» section: headline tiles with the change against the previous period, then three daily charts. */
export function OverviewAnalytics() {
  const { data, loading, error, reload } = useAnalyticsResource<OverviewReport>("overview")
  const failed = !!error
  const tile = (key: string, href: string, value: number | undefined, metric?: Metric, opts: { inverse?: boolean; sub?: string } = {}) => (
    <KpiTile key={key} label={t(`admin.platformAnalytics.overview.kpi.${key}`)} hint={t(`admin.platformAnalytics.overview.kpi.${key}Hint`)} href={href}
      value={formatCount(value)} delta={deltaOf(metric, opts.inverse)} sub={opts.sub ?? previousLine(metric)} loading={loading} empty={failed} />
  )
  const events = data?.Events
  const stands = data?.Stands
  const statusLine = events ? t("admin.platformAnalytics.overview.kpi.eventsStatus", { draft: events.Draft, published: events.Published, running: events.Running, finished: events.Finished }) : undefined
  const standsLine = stands ? t("admin.platformAnalytics.overview.kpi.standsSub", { creating: stands.Creating, failed: stands.Failed }) : undefined

  const series = data?.Series
  const usersEmpty = !series || series.NewUsers.every((d) => d.New === 0)
  const activityEmpty = !series || series.Activity.every((d) => d.Attempts === 0 && d.Solves === 0)
  const mailEmpty = !series || series.Mail.every((d) => d.Sent === 0 && d.Failed === 0)
  const busy = loading || failed
  const usersOption = series && !usersEmpty ? (theme: ChartTheme) => lineOption([
    { name: t("admin.platformAnalytics.overview.series.newUsers"), data: series.NewUsers.map((d) => [d.Day, d.New]), area: true },
  ], { theme }) : undefined
  const activityOption = series && !activityEmpty ? (theme: ChartTheme) => lineOption([
    { name: t("admin.platformAnalytics.overview.series.attempts"), data: series.Activity.map((d) => [d.Day, d.Attempts]), color: theme.palette[0] },
    { name: t("admin.platformAnalytics.overview.series.solves"), data: series.Activity.map((d) => [d.Day, d.Solves]), color: theme.palette[2] },
  ], { theme }) : undefined
  const mailOption = series && !mailEmpty ? (theme: ChartTheme) => lineOption([
    { name: t("admin.platformAnalytics.overview.series.sent"), data: series.Mail.map((d) => [d.Day, d.Sent]), color: theme.palette[2] },
    { name: t("admin.platformAnalytics.overview.series.failed"), data: series.Mail.map((d) => [d.Day, d.Failed]), color: theme.palette[4] },
  ], { theme }) : undefined

  return <div className="space-y-6">
    <div className="space-y-3">
      <div className="flex justify-end"><CsvExportButton section="overview" table="summary" label={t("admin.platformAnalytics.overview.csvSummary")} disabled={busy} /></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tile("users", "/analytics/users", data?.Users.Total, undefined, { sub: "" })}
        {tile("newUsers", "/analytics/users", data?.Users.New.Value, data?.Users.New)}
        {tile("activeUsers", "/analytics/users", data?.Users.Active.Value, data?.Users.Active)}
        {tile("events", "/analytics/events", events?.Total, undefined, { sub: statusLine })}
        {tile("registrations", "/analytics/events", data?.Participants.Registered.Value, data?.Participants.Registered)}
        {tile("approved", "/analytics/events", data?.Participants.Approved.Value, data?.Participants.Approved)}
        {tile("attempts", "/analytics/tasks", data?.Activity.Attempts.Value, data?.Activity.Attempts)}
        {tile("solves", "/analytics/tasks", data?.Activity.Solves.Value, data?.Activity.Solves)}
        {tile("emailSent", "/analytics/mail", data?.Mail.Sent.Value, data?.Mail.Sent)}
        {tile("emailFailed", "/analytics/mail", data?.Mail.Failed.Value, data?.Mail.Failed, { inverse: true })}
        {tile("stands", "/analytics/infrastructure", stands?.Ready, undefined, { sub: standsLine })}
        {tile("standFailures", "/analytics/infrastructure", stands?.Failures.Value, stands?.Failures, { inverse: true })}
      </div>
    </div>
    <div className="grid gap-4 xl:grid-cols-2">
      <AnalyticsBlock title={t("admin.platformAnalytics.overview.series.newUsersTitle")}
        actions={<CsvExportButton section="overview" table="series" label={t("admin.platformAnalytics.overview.csvSeries")} disabled={busy} />}>
        <AnalyticsChart option={usersOption} loading={loading} error={error} empty={usersEmpty} onRetry={reload} height={260}
          ariaLabel={t("admin.platformAnalytics.overview.series.newUsersTitle")} />
      </AnalyticsBlock>
      <AnalyticsBlock title={t("admin.platformAnalytics.overview.series.activityTitle")} hint={t("admin.platformAnalytics.overview.series.activityHint")}>
        <AnalyticsChart option={activityOption} loading={loading} error={error} empty={activityEmpty} onRetry={reload} height={260}
          ariaLabel={t("admin.platformAnalytics.overview.series.activityTitle")} />
      </AnalyticsBlock>
    </div>
    <AnalyticsBlock title={t("admin.platformAnalytics.overview.series.mailTitle")} hint={t("admin.platformAnalytics.overview.series.mailHint")}>
      <AnalyticsChart option={mailOption} loading={loading} error={error} empty={mailEmpty} onRetry={reload} height={260}
        ariaLabel={t("admin.platformAnalytics.overview.series.mailTitle")} />
    </AnalyticsBlock>
  </div>
}
