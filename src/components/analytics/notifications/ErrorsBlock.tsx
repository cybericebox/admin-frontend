"use client"

import { AnalyticsBlock, CsvExportButton, DataTable, type Column } from "@/components/analytics"
import type { AnalyticsParams } from "@/api/platformAnalytics"
import { formatDateTime, formatNumber } from "@/lib/locale"
import { t } from "@/i18n/t"
import type { MailErrorRow, MailResource } from "./types"

const P = "admin.platformAnalytics.mail."

export function ErrorsBlock({ res, params }: { res: MailResource; params: AnalyticsParams }) {
  const rows = res.data?.Errors
  const columns: Column<MailErrorRow>[] = [
    { key: "code", header: t(P + "errors.code"), className: "whitespace-nowrap tabular-nums", sortValue: (row) => row.Code, cell: (row) => row.Code || "–" },
    { key: "message", header: t(P + "errors.message"), className: "max-w-xl break-words", sortValue: (row) => row.Message, cell: (row) => row.Message || <span className="text-muted-foreground">{t(P + "errors.noMessage")}</span> },
    { key: "total", header: t(P + "errors.total"), numeric: true, sortValue: (row) => row.Total, cell: (row) => formatNumber(row.Total) },
    { key: "last", header: t(P + "errors.last"), sortValue: (row) => row.LastAt, cell: (row) => formatDateTime(row.LastAt) },
  ]
  return <AnalyticsBlock title={t(P + "errors.title")} hint={t(P + "errors.hint")}
    actions={<CsvExportButton section="mail" table="errors" params={params} disabled={!rows || rows.length === 0} />}>
    <DataTable ariaLabel={t(P + "errors.title")} columns={columns} rows={rows} rowKey={(row) => `${row.Code}|${row.Message}`} loading={res.loading} error={res.error} onRetry={res.reload}
      errorMessage={t(P + "errors.error")} emptyMessage={t(P + "errors.empty")} defaultSort={{ field: "total", direction: "desc" }} minHeight={240} />
  </AnalyticsBlock>
}
