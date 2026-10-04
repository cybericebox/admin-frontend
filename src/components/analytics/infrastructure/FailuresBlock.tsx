"use client"

import { AnalyticsBlock, CsvExportButton, DataTable, type Column } from "@/components/analytics"
import { formatDateTime, formatNumber } from "@/lib/locale"
import { t } from "@/i18n/t"
import { failureLabel } from "./failureLabels"
import type { FailureReason, InfrastructureResource } from "./types"

const P = "admin.platformAnalytics.infrastructure."

export function FailuresBlock({ res }: { res: InfrastructureResource }) {
  const rows = res.data?.Failures
  const columns: Column<FailureReason>[] = [
    { key: "reason", header: t(P + "failures.reason"), sortValue: (row) => failureLabel(row.Code), cell: (row) => <span className="font-medium text-foreground">{failureLabel(row.Code)}</span> },
    { key: "labs", header: t(P + "failures.labs"), numeric: true, sortValue: (row) => row.Labs, cell: (row) => formatNumber(row.Labs) },
    { key: "stands", header: t(P + "failures.stands"), numeric: true, sortValue: (row) => row.Stands, cell: (row) => formatNumber(row.Stands) },
    { key: "events", header: t(P + "failures.events"), numeric: true, sortValue: (row) => row.Events, cell: (row) => formatNumber(row.Events) },
    { key: "last", header: t(P + "failures.last"), sortValue: (row) => row.LastAt, cell: (row) => formatDateTime(row.LastAt) },
  ]
  return <AnalyticsBlock title={t(P + "failures.title")} hint={t(P + "failures.hint")}
    actions={<CsvExportButton section="infrastructure" table="failures" disabled={!rows || rows.length === 0} />}>
    <DataTable ariaLabel={t(P + "failures.title")} columns={columns} rows={rows} rowKey={(row) => row.Code}
      loading={res.loading} error={res.error} onRetry={res.reload} errorMessage={t(P + "failures.error")}
      emptyMessage={t(P + "failures.empty")} defaultSort={{ field: "labs", direction: "desc" }} minHeight={240} />
  </AnalyticsBlock>
}
