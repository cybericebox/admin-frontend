"use client"

import { AnalyticsBlock, CsvExportButton, DataTable, type Column } from "@/components/analytics"
import { formatNumber } from "@/lib/locale"
import { t } from "@/i18n/t"
import type { InfrastructureResource, KindHours } from "./types"

const P = "admin.platformAnalytics.infrastructure."

/** Active hours split by lab kind: event teams, the moderators team and catalog test labs. */
export function KindHoursBlock({ res }: { res: InfrastructureResource }) {
  const rows = res.data?.StandHours.Kinds
  const columns: Column<KindHours>[] = [
    { key: "kind", header: t(P + "kinds.kind"), sortValue: (row) => t(P + `kinds.${row.Kind}`), cell: (row) => <span className="font-medium text-foreground">{t(P + `kinds.${row.Kind}`)}</span> },
    { key: "hours", header: t(P + "kinds.hours"), numeric: true, sortValue: (row) => row.Hours, cell: (row) => t(P + "unit.hours", { value: formatNumber(row.Hours, { maximumFractionDigits: 1 }) }) },
    { key: "labs", header: t(P + "kinds.labs"), numeric: true, sortValue: (row) => row.Labs, cell: (row) => formatNumber(row.Labs) },
  ]
  return <AnalyticsBlock title={t(P + "kinds.title")} hint={t(P + "kinds.hint")}
    actions={<CsvExportButton section="infrastructure" table="kinds" disabled={!rows || rows.length === 0} />}>
    <DataTable ariaLabel={t(P + "kinds.title")} columns={columns} rows={rows} rowKey={(row) => row.Kind}
      loading={res.loading} error={res.error} onRetry={res.reload} errorMessage={t(P + "kinds.error")}
      emptyMessage={t(P + "kinds.empty")} minHeight={160} />
  </AnalyticsBlock>
}
