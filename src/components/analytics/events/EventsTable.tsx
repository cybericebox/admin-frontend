"use client"

import Link from "next/link"
import { CsvExportButton, DataTable, type Column } from "@/components/analytics"
import { AnalyticsBlock } from "@/components/analytics/AnalyticsBlock"
import { EventSiteLink } from "@/components/events/EventSiteLink"
import { t } from "@/i18n/t"
import type { EventAnalyticsRow } from "@/api/platformAnalyticsCatalog"
import { formatCount, formatDateTime, formatDuration, formatPercent } from "./format"

export function eventHref(id: string): string {
  return `/events/detail?id=${encodeURIComponent(id)}`
}

/** The event's own analytics: the /manage/analytics page of its site. */
export function EventAnalyticsLink({ tag }: { tag: string }) {
  return <EventSiteLink tag={tag} path="/manage/analytics" tooltip={t("admin.platformAnalytics.events.openAnalytics")} />
}

const time = (iso: string | null) => (iso ? Date.parse(iso) : null)

/**
 * The per-event table: the newest events of the period with their aggregates.
 * Sorted client-side over the bounded list the API returns.
 */
export function EventsTable({ rows, total, limit, loading, error, onRetry }: {
  rows: EventAnalyticsRow[] | undefined
  total: number
  limit: number
  loading: boolean
  error: unknown
  onRetry: () => void
}) {
  const columns: Column<EventAnalyticsRow>[] = [
    { key: "name", header: t("admin.platformAnalytics.events.col.name"), sortValue: (row) => row.Name || row.Tag,
      cell: (row) => <Link href={eventHref(row.ID)} className="font-medium text-primary hover:underline">{row.Name || row.Tag}</Link> },
    { key: "status", header: t("admin.platformAnalytics.events.col.status"), sortValue: (row) => row.Status,
      cell: (row) => t(`admin.events.lifecycle.${row.Status}`) },
    { key: "start", header: t("admin.platformAnalytics.events.col.start"), sortValue: (row) => time(row.StartAt),
      cell: (row) => <span className="whitespace-nowrap">{formatDateTime(row.StartAt)}</span> },
    { key: "finish", header: t("admin.platformAnalytics.events.col.finish"), sortValue: (row) => time(row.FinishAt),
      cell: (row) => <span className="whitespace-nowrap">{formatDateTime(row.FinishAt)}</span> },
    { key: "participants", header: t("admin.platformAnalytics.events.col.participants"), align: "right", sortValue: (row) => row.Participants, cell: (row) => formatCount(row.Participants) },
    { key: "teams", header: t("admin.platformAnalytics.events.col.teams"), align: "right", sortValue: (row) => row.Teams, cell: (row) => formatCount(row.Teams) },
    { key: "solves", header: t("admin.platformAnalytics.events.col.solves"), align: "right", sortValue: (row) => row.Solves, cell: (row) => formatCount(row.Solves) },
    { key: "completion", header: t("admin.platformAnalytics.events.col.completion"), align: "right", sortValue: (row) => row.CompletionRate,
      cell: (row) => row.Teams > 0 ? formatPercent(row.CompletionRate) : "–" },
    { key: "duration", header: t("admin.platformAnalytics.events.col.duration"), align: "right", sortValue: (row) => row.DurationSeconds,
      cell: (row) => <span className="whitespace-nowrap">{formatDuration(row.DurationSeconds)}</span> },
    { key: "analytics", header: t("admin.platformAnalytics.events.col.analytics"), cell: (row) => <EventAnalyticsLink tag={row.Tag} /> },
  ]
  const truncated = !loading && !error && rows !== undefined && total > rows.length
  return <AnalyticsBlock title={t("admin.platformAnalytics.events.table.title")} hint={t("admin.platformAnalytics.events.table.hint")}
    subtitle={truncated ? t("admin.platformAnalytics.events.table.truncated", { shown: rows.length, total, limit }) : undefined}
    actions={<CsvExportButton section="events" table="events" disabled={loading || !!error || !rows?.length} />}>
    <DataTable columns={columns} rows={rows} rowKey={(row) => row.ID} loading={loading} error={error} onRetry={onRetry}
      emptyMessage={t("admin.platformAnalytics.events.table.empty")} errorMessage={t("admin.platformAnalytics.events.table.error")}
      ariaLabel={t("admin.platformAnalytics.events.table.title")} defaultSort={{ field: "start", direction: "desc" }} />
  </AnalyticsBlock>
}
