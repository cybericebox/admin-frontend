"use client"

import Link from "next/link"
import { CsvExportButton, DataTable, type Column } from "@/components/analytics"
import { AnalyticsBlock } from "@/components/analytics/AnalyticsBlock"
import { t } from "@/i18n/t"
import type { UpcomingEvent } from "@/api/platformAnalyticsCatalog"
import { EventAnalyticsLink, eventHref } from "./EventsTable"
import { formatCount, formatDateTime } from "./format"

/** The next scheduled events by start date, with the registrations so far. Not bound to the period. */
export function UpcomingEventsTable({ rows, loading, error, onRetry }: {
  rows: UpcomingEvent[] | undefined
  loading: boolean
  error: unknown
  onRetry: () => void
}) {
  const columns: Column<UpcomingEvent>[] = [
    { key: "name", header: t("admin.platformAnalytics.events.col.name"), sortValue: (row) => row.Name || row.Tag,
      cell: (row) => <Link href={eventHref(row.ID)} className="font-medium text-primary hover:underline">{row.Name || row.Tag}</Link> },
    { key: "start", header: t("admin.platformAnalytics.events.col.start"), sortValue: (row) => Date.parse(row.StartAt),
      cell: (row) => <span className="whitespace-nowrap">{formatDateTime(row.StartAt)}</span> },
    { key: "published", header: t("admin.platformAnalytics.events.col.status"), sortValue: (row) => (row.Published ? 1 : 0),
      cell: (row) => t(row.Published ? "admin.events.lifecycle.published" : "admin.events.lifecycle.not_published") },
    { key: "registrations", header: t("admin.platformAnalytics.events.col.registrations"), align: "right", sortValue: (row) => row.Registrations, cell: (row) => formatCount(row.Registrations) },
    { key: "analytics", header: t("admin.platformAnalytics.events.col.analytics"), cell: (row) => <EventAnalyticsLink tag={row.Tag} /> },
  ]
  return <AnalyticsBlock title={t("admin.platformAnalytics.events.upcoming.title")} subtitle={t("admin.platformAnalytics.events.upcoming.subtitle")}
    actions={<CsvExportButton section="events" table="upcoming" disabled={loading || !!error || !rows?.length} />}>
    <DataTable columns={columns} rows={rows} rowKey={(row) => row.ID} loading={loading} error={error} onRetry={onRetry} minHeight={200}
      emptyMessage={t("admin.platformAnalytics.events.upcoming.empty")} errorMessage={t("admin.platformAnalytics.events.upcoming.error")}
      ariaLabel={t("admin.platformAnalytics.events.upcoming.title")} defaultSort={{ field: "start", direction: "asc" }} />
  </AnalyticsBlock>
}
