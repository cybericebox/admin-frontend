"use client"

import { AnalyticsBlock, CsvExportButton, DataTable, type Column } from "@/components/analytics"
import type { AnalyticsParams } from "@/api/platformAnalytics"
import { formatNumber } from "@/lib/locale"
import { t } from "@/i18n/t"
import { notifChannelLabel } from "@/utils/notifType"
import { percent } from "./labels"
import type { MailKeyRow, MailResource } from "./types"

const P = "admin.platformAnalytics.mail."

/** Channel × delivered / failed / deferred counts. */
export function ChannelTableBlock({ res, params }: { res: MailResource; params: AnalyticsParams }) {
  const rows = res.data?.ByChannel
  const columns: Column<MailKeyRow>[] = [
    { key: "key", header: t(P + "col.channel"), sortValue: (row) => notifChannelLabel(row.Key), cell: (row) => <span className="font-medium text-foreground">{notifChannelLabel(row.Key)}</span> },
    { key: "sent", header: t(P + "col.sent"), numeric: true, sortValue: (row) => row.Sent, cell: (row) => formatNumber(row.Sent) },
    { key: "failed", header: t(P + "col.failed"), numeric: true, sortValue: (row) => row.Failed, cell: (row) => formatNumber(row.Failed) },
    { key: "deferred", header: t(P + "col.deferred"), numeric: true, sortValue: (row) => row.Deferred ?? 0, cell: (row) => formatNumber(row.Deferred ?? 0) },
    { key: "rate", header: t(P + "col.rate"), numeric: true, sortValue: (row) => row.FailureRate, cell: (row) => percent(row.FailureRate, formatNumber) },
  ]
  return <AnalyticsBlock title={t(P + "byChannel.title")} hint={t(P + "byChannel.hint")}
    actions={<CsvExportButton section="mail" table="by_channel" params={params} disabled={!rows || rows.length === 0} />}>
    <DataTable ariaLabel={t(P + "byChannel.title")} columns={columns} rows={rows} rowKey={(row) => row.Key} loading={res.loading} error={res.error} onRetry={res.reload}
      errorMessage={t(P + "table.error")} emptyMessage={t(P + "table.empty")} defaultSort={{ field: "sent", direction: "desc" }} minHeight={240} />
  </AnalyticsBlock>
}
