"use client"

import { exercisesOrigin } from "@/lib/origins"
import { CsvExportButton, DataTable, type Column } from "@/components/analytics"
import { PagedTable } from "@/components/analytics/PagedTable"
import { AnalyticsBlock } from "@/components/analytics/AnalyticsBlock"
import { formatCount, formatDuration, formatPercent } from "@/components/analytics/events/format"
import { t } from "@/i18n/t"
import type { TaskUsageRow } from "@/api/platformAnalyticsCatalog"

export function levelLabel(level: string): string {
  return level ? t(`admin.platformAnalytics.tasks.level.${level}`) : "–"
}

function rowKey(row: TaskUsageRow): string {
  return `${row.ExerciseID}:${row.TaskID}`
}

function identityColumns(): Column<TaskUsageRow>[] {
  return [
    { key: "exercise", header: t("admin.platformAnalytics.tasks.col.exercise"), sortValue: (row) => row.Exercise, cell: (row) => <a href={`${exercisesOrigin}/detail?id=${encodeURIComponent(row.ExerciseID)}`} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">{row.Exercise}</a> },
    { key: "task", header: t("admin.platformAnalytics.tasks.col.task"), sortValue: (row) => row.Task, cell: (row) => row.Task || "–" },
    { key: "level", header: t("admin.platformAnalytics.tasks.col.level"), sortValue: (row) => row.Level, cell: (row) => levelLabel(row.Level) },
    { key: "categories", header: t("admin.platformAnalytics.tasks.col.categories"), cell: (row) => row.Categories.length ? row.Categories.join(", ") : "–" },
    { key: "eventsUsed", header: t("admin.platformAnalytics.tasks.col.events"), numeric: true, sortValue: (row) => row.EventsUsed, cell: (row) => formatCount(row.EventsUsed) },
    { key: "attempts", header: t("admin.platformAnalytics.tasks.col.attempts"), numeric: true, sortValue: (row) => row.Attempts, cell: (row) => formatCount(row.Attempts) },
  ]
}

function usageColumns(): Column<TaskUsageRow>[] {
  return [
    ...identityColumns(),
    { key: "solves", header: t("admin.platformAnalytics.tasks.col.solves"), numeric: true, sortValue: (row) => row.Solves, cell: (row) => formatCount(row.Solves) },
    { key: "solveRate", header: t("admin.platformAnalytics.tasks.col.solveRate"), numeric: true, sortValue: (row) => (row.TeamsTried > 0 ? row.SolveRate : null),
      cell: (row) => row.TeamsTried > 0 ? formatPercent(row.SolveRate) : "–" },
    { key: "medianSolveSeconds", header: t("admin.platformAnalytics.tasks.col.median"), numeric: true, sortValue: (row) => row.MedianSolveSeconds,
      cell: (row) => <span className="whitespace-nowrap">{formatDuration(row.MedianSolveSeconds)}</span> },
    { key: "hintRate", header: t("admin.platformAnalytics.tasks.col.hintRate"), numeric: true, sortValue: (row) => (row.TeamsEngaged > 0 ? row.HintRate : null),
      cell: (row) => row.TeamsEngaged > 0 ? formatPercent(row.HintRate) : "–" },
    { key: "calibration", header: t("admin.platformAnalytics.tasks.col.calibration"),
      cell: (row) => t(`admin.platformAnalytics.tasks.calibration.${row.Calibration}`) },
  ]
}

function unsolvedColumns(): Column<TaskUsageRow>[] {
  return [
    ...identityColumns(),
    { key: "teamsTried", header: t("admin.platformAnalytics.tasks.col.tried"), numeric: true, sortValue: (row) => row.TeamsTried, cell: (row) => formatCount(row.TeamsTried) },
  ]
}

/**
 * A bounded table of catalog tasks (most used first): the usage and
 * calibration table, or the never-solved one. Sorted client-side.
 */
export function TaskUsageTable({ variant, rows, total, loading, error, onRetry, filters }: {
  variant: "usage" | "unsolved"
  rows: TaskUsageRow[] | undefined
  /** Full size of the result behind the bounded rows. */
  total: number
  loading: boolean
  error: unknown
  onRetry: () => void
  /** The active category / level filters; the CSV export honours them. */
  filters?: { category?: string; level?: string }
}) {
  const unsolved = variant === "unsolved"
  const key = unsolved ? "unsolved" : "usage"
  const truncated = !loading && !error && rows !== undefined && total > rows.length
  return <AnalyticsBlock title={t(`admin.platformAnalytics.tasks.${key}.title`)} hint={t(`admin.platformAnalytics.tasks.${key}.hint`)}
    subtitle={truncated ? t("admin.platformAnalytics.tasks.truncated", { shown: rows.length, total }) : undefined}
    actions={<CsvExportButton section="tasks" table={unsolved ? "unsolved" : "tasks"} params={filters} disabled={loading || !!error || !rows?.length} />}>
    <DataTable columns={unsolved ? unsolvedColumns() : usageColumns()} rows={rows} rowKey={rowKey} loading={loading} error={error} onRetry={onRetry}
      minHeight={unsolved ? 200 : 320} emptyMessage={t(`admin.platformAnalytics.tasks.${key}.empty`)} errorMessage={t(`admin.platformAnalytics.tasks.${key}.error`)}
      ariaLabel={t(`admin.platformAnalytics.tasks.${key}.title`)} defaultSort={{ field: "teamsTried", direction: "desc" }} />
  </AnalyticsBlock>
}

/** The usage and calibration table: every catalog task of the period, paged, searched and sorted on the server. */
export function TaskUsagePagedTable({ filters }: { filters?: { category?: string; level?: string } }) {
  return <PagedTable<TaskUsageRow> section="tasks" path="table" extra={{ category: filters?.category, level: filters?.level }} columns={usageColumns()} rowKey={rowKey}
    title={t("admin.platformAnalytics.tasks.usage.title")} hint={t("admin.platformAnalytics.tasks.usage.hint")}
    actions={({ loading, error, empty }) => <CsvExportButton section="tasks" table="tasks" params={filters} disabled={loading || !!error || empty} />}
    ariaLabel={t("admin.platformAnalytics.tasks.usage.title")} emptyMessage={t("admin.platformAnalytics.tasks.usage.empty")} errorMessage={t("admin.platformAnalytics.tasks.usage.error")}
    searchLabel={t("admin.platformAnalytics.tasks.search")} defaultSort={{ field: "eventsUsed", direction: "desc" }} />
}
