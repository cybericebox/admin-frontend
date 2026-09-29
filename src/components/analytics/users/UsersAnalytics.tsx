"use client"

import { AnalyticsBlock, AnalyticsChart, CsvExportButton, DataTable, KpiTile, barOption, donutOption, lineOption, useAnalyticsResource, type ChartTheme, type Column } from "@/components/analytics"
import { t } from "@/i18n/t"
import { roleLabel } from "@/lib/roles"
import { useRole } from "@/lib/useRole"
import type { UsersReport } from "@/api/platformAnalyticsOverview"
import { deltaOf, formatCount, previousLine } from "../overview/format"
import { PeopleTable } from "./PeopleTable"

type RoleRow = UsersReport["ByRole"][number]

/** Body of the «Користувачі» section: the admin user stats bound to the period, activity, sign-in methods, event retention and, for super admins, the most active accounts. */
export function UsersAnalytics() {
  const { data, loading, error, reload } = useAnalyticsResource<UsersReport>("users")
  const { can } = useRole()
  const failed = !!error
  const busy = loading || failed

  const registrationsEmpty = !data || data.Registrations.every((d) => d.New === 0)
  const activeEmpty = !data || data.ActiveByDay.every((d) => d.DAU === 0 && d.WAU === 0)
  const methods = (data?.Methods ?? []).filter((m) => m.Total > 0)
  const retention = data?.Retention
  const retentionEmpty = !retention || retention.One + retention.Two + retention.ThreePlus === 0

  const registrationsOption = data && !registrationsEmpty ? (theme: ChartTheme) => lineOption([
    { name: t("admin.platformAnalytics.users.series.registrations"), data: data.Registrations.map((d) => [d.Day, d.New]), area: true },
  ], { theme }) : undefined
  const activeOption = data && !activeEmpty ? (theme: ChartTheme) => lineOption([
    { name: t("admin.platformAnalytics.users.series.dau"), data: data.ActiveByDay.map((d) => [d.Day, d.DAU]), color: theme.palette[0] },
    { name: t("admin.platformAnalytics.users.series.wau"), data: data.ActiveByDay.map((d) => [d.Day, d.WAU]), color: theme.palette[1] },
  ], { theme }) : undefined
  const methodsOption = (theme: ChartTheme) => donutOption(methods.map((m) => ({ name: t(`admin.platformAnalytics.users.method.${m.Method}`), value: m.Total })), { theme })
  const retentionOption = retention && !retentionEmpty ? (theme: ChartTheme) => barOption(
    [t("admin.platformAnalytics.users.retention.one"), t("admin.platformAnalytics.users.retention.two"), t("admin.platformAnalytics.users.retention.threePlus")],
    [{ name: t("admin.platformAnalytics.users.retention.accounts"), data: [retention.One, retention.Two, retention.ThreePlus] }], { theme },
  ) : undefined

  const roleColumns: Column<RoleRow>[] = [
    { key: "role", header: t("admin.platformAnalytics.users.role.role"), cell: (row) => roleLabel(row.Role), sortValue: (row) => roleLabel(row.Role) },
    { key: "count", header: t("admin.platformAnalytics.users.role.count"), cell: (row) => formatCount(row.Count), sortValue: (row) => row.Count, align: "right" },
  ]

  return <div className="space-y-6">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <KpiTile label={t("admin.platformAnalytics.users.kpi.total")} hint={t("admin.platformAnalytics.users.kpi.totalHint")} href="/users"
        value={formatCount(data?.Total)} loading={loading} empty={failed} />
      <KpiTile label={t("admin.platformAnalytics.users.kpi.blocked")} hint={t("admin.platformAnalytics.users.kpi.blockedHint")} href="/users"
        value={formatCount(data?.Blocked)} loading={loading} empty={failed} />
      <KpiTile label={t("admin.platformAnalytics.users.kpi.new")} hint={t("admin.platformAnalytics.users.kpi.newHint")}
        value={formatCount(data?.New.Value)} delta={deltaOf(data?.New)} sub={previousLine(data?.New)} loading={loading} empty={failed} />
      <KpiTile label={t("admin.platformAnalytics.users.kpi.active")} hint={t("admin.platformAnalytics.users.kpi.activeHint")}
        value={formatCount(data?.Active.Value)} delta={deltaOf(data?.Active)} sub={previousLine(data?.Active)} loading={loading} empty={failed} />
      <KpiTile label={t("admin.platformAnalytics.users.kpi.avgDaily")} hint={t("admin.platformAnalytics.users.kpi.avgDailyHint")}
        value={data ? data.AvgDailyActive.toLocaleString("uk-UA", { maximumFractionDigits: 1 }) : undefined} loading={loading} empty={failed} />
    </div>
    <div className="grid gap-4 xl:grid-cols-2">
      <AnalyticsBlock title={t("admin.platformAnalytics.users.series.registrationsTitle")}
        actions={<CsvExportButton section="users" table="registrations" disabled={busy || registrationsEmpty} />}>
        <AnalyticsChart option={registrationsOption} loading={loading} error={error} empty={registrationsEmpty} onRetry={reload} height={260}
          ariaLabel={t("admin.platformAnalytics.users.series.registrationsTitle")} />
      </AnalyticsBlock>
      <AnalyticsBlock title={t("admin.platformAnalytics.users.series.activeTitle")} hint={t("admin.platformAnalytics.users.series.activeHint")}
        actions={<CsvExportButton section="users" table="activity" disabled={busy || activeEmpty} />}>
        <AnalyticsChart option={activeOption} loading={loading} error={error} empty={activeEmpty} onRetry={reload} height={260}
          ariaLabel={t("admin.platformAnalytics.users.series.activeTitle")} />
      </AnalyticsBlock>
    </div>
    <div className="grid gap-4 xl:grid-cols-3">
      <AnalyticsBlock title={t("admin.platformAnalytics.users.methodsTitle")} hint={t("admin.platformAnalytics.users.methodsHint")}
        actions={<CsvExportButton section="users" table="methods" disabled={busy || methods.length === 0} />}>
        <AnalyticsChart option={methodsOption} loading={loading} error={error} empty={methods.length === 0} onRetry={reload} height={260}
          ariaLabel={t("admin.platformAnalytics.users.methodsTitle")} />
      </AnalyticsBlock>
      <AnalyticsBlock title={t("admin.platformAnalytics.users.retention.title")} hint={t("admin.platformAnalytics.users.retention.hint")}
        subtitle={retention ? t("admin.platformAnalytics.users.retention.never", { count: formatCount(retention.Never) }) : undefined}
        actions={<CsvExportButton section="users" table="retention" disabled={busy} />}>
        <AnalyticsChart option={retentionOption} loading={loading} error={error} empty={retentionEmpty} onRetry={reload} height={260}
          ariaLabel={t("admin.platformAnalytics.users.retention.title")} emptyMessage={t("admin.platformAnalytics.users.retention.empty")} />
      </AnalyticsBlock>
      <AnalyticsBlock title={t("admin.platformAnalytics.users.role.title")}>
        <DataTable columns={roleColumns} rows={data?.ByRole} rowKey={(row) => row.Role} loading={loading} error={error} onRetry={reload} minHeight={260}
          ariaLabel={t("admin.platformAnalytics.users.role.title")} emptyMessage={t("admin.platformAnalytics.users.role.empty")} defaultSort={{ field: "count", direction: "desc" }} />
      </AnalyticsBlock>
    </div>
    {can("analytics.users.read") && <PeopleTable />}
  </div>
}
