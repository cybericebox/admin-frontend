"use client"

import Link from "next/link"
import { CsvExportButton, type Column } from "@/components/analytics"
import { PagedTable } from "@/components/analytics/PagedTable"
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

/** The per-event table: every event of the period with its aggregates, paged, searched and sorted on the server. */
export function EventsTable() {
  const columns: Column<EventAnalyticsRow>[] = [
    { key: "name", header: t("admin.platformAnalytics.events.col.name"), sortValue: (row) => row.Name || row.Tag,
      cell: (row) => <Link href={eventHref(row.ID)} className="font-medium text-primary hover:underline">{row.Name || row.Tag}</Link> },
    { key: "status", header: t("admin.platformAnalytics.events.col.status"), sortValue: (row) => row.Status,
      cell: (row) => t(`admin.events.lifecycle.${row.Status}`) },
    { key: "start", header: t("admin.platformAnalytics.events.col.start"), sortValue: (row) => time(row.StartAt),
      cell: (row) => <span className="whitespace-nowrap">{formatDateTime(row.StartAt)}</span> },
    { key: "finish", header: t("admin.platformAnalytics.events.col.finish"), cell: (row) => <span className="whitespace-nowrap">{formatDateTime(row.FinishAt)}</span> },
    { key: "participants", header: t("admin.platformAnalytics.events.col.participants"), numeric: true, sortValue: (row) => row.Participants, cell: (row) => formatCount(row.Participants) },
    { key: "teams", header: t("admin.platformAnalytics.events.col.teams"), numeric: true, sortValue: (row) => row.Teams, cell: (row) => formatCount(row.Teams) },
    { key: "solves", header: t("admin.platformAnalytics.events.col.solves"), numeric: true, sortValue: (row) => row.Solves, cell: (row) => formatCount(row.Solves) },
    { key: "teamsSolved", header: t("admin.platformAnalytics.events.col.completion"), numeric: true, sortValue: (row) => row.TeamsSolved,
      cell: (row) => row.Teams > 0 ? formatPercent(row.CompletionRate) : "–" },
    { key: "duration", header: t("admin.platformAnalytics.events.col.duration"), numeric: true,
      cell: (row) => <span className="whitespace-nowrap">{formatDuration(row.DurationSeconds)}</span> },
    { key: "analytics", header: t("admin.platformAnalytics.events.col.analytics"), cell: (row) => <EventAnalyticsLink tag={row.Tag} /> },
  ]
  return <PagedTable<EventAnalyticsRow> section="events" path="table" columns={columns} rowKey={(row) => row.ID} title={t("admin.platformAnalytics.events.table.title")} hint={t("admin.platformAnalytics.events.table.hint")}
    actions={({ loading, error, empty }) => <CsvExportButton section="events" table="events" disabled={loading || !!error || empty} />}
    ariaLabel={t("admin.platformAnalytics.events.table.title")} emptyMessage={t("admin.platformAnalytics.events.table.empty")} errorMessage={t("admin.platformAnalytics.events.table.error")}
    searchLabel={t("admin.platformAnalytics.events.table.search")} defaultSort={{ field: "start", direction: "desc" }} />
}
