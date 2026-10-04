"use client"

import type { ReactNode } from "react"
import { AnalyticsBlock, CsvExportButton, DataTable, type Column } from "@/components/analytics"
import type { AnalyticsParams } from "@/api/platformAnalytics"
import { formatNumber } from "@/lib/locale"
import { t } from "@/i18n/t"
import { percent } from "./labels"
import type { MailKeyRow, MailResource } from "./types"

const P = "admin.platformAnalytics.mail."

/** The sent / failed table of one grouping: by transport or by notification type. */
export function KeyTableBlock({ res, params, title, hint, table, keyHeader, label, rows, actions }: {
  res: MailResource
  params: AnalyticsParams
  title: string
  hint: string
  table: "by_transport" | "by_type"
  keyHeader: string
  label: (key: string) => string
  rows: MailKeyRow[] | undefined
  actions?: ReactNode
}) {
  const columns: Column<MailKeyRow>[] = [
    { key: "key", header: keyHeader, sortValue: (row) => label(row.Key), cell: (row) => <span className="font-medium text-foreground">{label(row.Key)}</span> },
    { key: "sent", header: t(P + "col.sent"), numeric: true, sortValue: (row) => row.Sent, cell: (row) => formatNumber(row.Sent) },
    { key: "failed", header: t(P + "col.failed"), numeric: true, sortValue: (row) => row.Failed, cell: (row) => formatNumber(row.Failed) },
    { key: "rate", header: t(P + "col.rate"), numeric: true, sortValue: (row) => row.FailureRate, cell: (row) => percent(row.FailureRate, formatNumber) },
    { key: "fallbacks", header: t(P + "col.fallbacks"), numeric: true, sortValue: (row) => row.Fallbacks, cell: (row) => formatNumber(row.Fallbacks) },
  ]
  return <AnalyticsBlock title={title} hint={hint}
    actions={<>{actions}<CsvExportButton section="mail" table={table} params={params} disabled={!rows || rows.length === 0} /></>}>
    <DataTable ariaLabel={title} columns={columns} rows={rows} rowKey={(row) => row.Key} loading={res.loading} error={res.error} onRetry={res.reload}
      errorMessage={t(P + "table.error")} emptyMessage={t(P + "table.empty")} defaultSort={{ field: "sent", direction: "desc" }} minHeight={240} />
  </AnalyticsBlock>
}
