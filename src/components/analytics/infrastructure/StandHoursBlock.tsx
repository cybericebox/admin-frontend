"use client"

import Link from "next/link"
import { AnalyticsBlock, CsvExportButton, DataTable, type Column } from "@/components/analytics"
import { formatNumber } from "@/lib/locale"
import { t } from "@/i18n/t"
import type { InfrastructureResource, StandHoursEvent } from "./types"

const P = "admin.platformAnalytics.infrastructure."

export function StandHoursBlock({ res }: { res: InfrastructureResource }) {
  const rows = res.data?.StandHours.Events
  const columns: Column<StandHoursEvent>[] = [
    { key: "event", header: t(P + "standHours.event"), sortValue: (row) => row.EventName, cell: (row) => <Link href={`/events/detail?id=${encodeURIComponent(row.EventID)}`} className="font-medium text-primary hover:underline">{row.EventName || row.EventID}</Link> },
    { key: "hours", header: t(P + "standHours.hours"), numeric: true, sortValue: (row) => row.Hours, cell: (row) => t(P + "unit.hours", { value: formatNumber(row.Hours, { maximumFractionDigits: 1 }) }) },
    { key: "stands", header: t(P + "standHours.stands"), numeric: true, sortValue: (row) => row.Stands, cell: (row) => formatNumber(row.Stands) },
  ]
  return <AnalyticsBlock title={t(P + "standHours.title")} hint={t(P + "standHours.hint")}
    actions={<CsvExportButton section="infrastructure" table="stand_hours" disabled={!rows || rows.length === 0} />}>
    <DataTable ariaLabel={t(P + "standHours.title")} columns={columns} rows={rows} rowKey={(row) => row.EventID}
      loading={res.loading} error={res.error} onRetry={res.reload} errorMessage={t(P + "standHours.error")}
      emptyMessage={t(P + "standHours.empty")} defaultSort={{ field: "hours", direction: "desc" }} minHeight={280} />
  </AnalyticsBlock>
}
