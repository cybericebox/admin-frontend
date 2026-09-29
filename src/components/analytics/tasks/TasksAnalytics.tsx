"use client"

import { useState } from "react"
import { AnalyticsChart, KpiTile, barOption, hBarOption, useAnalyticsResource } from "@/components/analytics"
import { AnalyticsBlock } from "@/components/analytics/AnalyticsBlock"
import { formatCount, formatPercent } from "@/components/analytics/events/format"
import { SelectMenu } from "@/components/ui/select-menu"
import { t } from "@/i18n/t"
import type { TasksAnalytics as TasksReport } from "@/api/platformAnalyticsCatalog"
import { TaskUsageTable, levelLabel } from "./TaskUsageTable"

type Options = { categories: string[]; levels: string[] }
const NO_OPTIONS: Options = { categories: [], levels: [] }
const ALL = "all"

/**
 * Body of the «Каталог завдань» section: filters (their options come from the
 * response), KPIs, usage by category, solve rate by level, the usage and
 * calibration table and the never-solved table.
 */
export function TasksAnalytics() {
  const [category, setCategory] = useState(ALL)
  const [level, setLevel] = useState(ALL)
  const filters = { category: category === ALL ? undefined : category, level: level === ALL ? undefined : level }
  const { data, loading, error, reload } = useAnalyticsResource<TasksReport>("tasks", filters)
  // The options stay while a filter change reloads the report.
  const [options, setOptions] = useState<Options>(NO_OPTIONS)
  if (data && (data.Categories !== options.categories || data.Levels !== options.levels)) setOptions({ categories: data.Categories, levels: data.Levels })

  const categoryChoices = [{ value: ALL, label: t("admin.platformAnalytics.tasks.filter.allCategories") }, ...options.categories.map((value) => ({ value, label: value }))]
  const levelChoices = [{ value: ALL, label: t("admin.platformAnalytics.tasks.filter.allLevels") }, ...options.levels.map((value) => ({ value, label: levelLabel(value) }))]
  const failed = !!error
  const byCategory = (data?.ByCategory ?? []).map((c) => ({ name: c.Category, value: c.Uses }))
  const byLevel = (data?.ByLevel ?? []).filter((l) => l.TeamsTried > 0)
  const noRows = !loading && !failed && !!data && data.TasksTotal === 0

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center gap-3">
      <SelectMenu value={category} onChange={setCategory} options={categoryChoices} ariaLabel={t("admin.platformAnalytics.tasks.filter.category")} className="h-10 min-w-44 text-sm" />
      <SelectMenu value={level} onChange={setLevel} options={levelChoices} ariaLabel={t("admin.platformAnalytics.tasks.filter.level")} className="h-10 min-w-44 text-sm" />
    </div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiTile label={t("admin.platformAnalytics.tasks.kpi.used")} hint={t("admin.platformAnalytics.tasks.kpi.usedHint")}
        value={formatCount(data?.Totals.TasksUsed)} loading={loading} empty={failed} />
      <KpiTile label={t("admin.platformAnalytics.tasks.kpi.uses")} hint={t("admin.platformAnalytics.tasks.kpi.usesHint")}
        value={formatCount(data?.Totals.Uses)} loading={loading} empty={failed} />
      <KpiTile label={t("admin.platformAnalytics.tasks.kpi.solveRate")} hint={t("admin.platformAnalytics.tasks.kpi.solveRateHint")}
        value={formatPercent(data?.Totals.SolveRate)} loading={loading} empty={failed || noRows} />
      <KpiTile label={t("admin.platformAnalytics.tasks.kpi.neverSolved")} hint={t("admin.platformAnalytics.tasks.kpi.neverSolvedHint")}
        value={formatCount(data?.Totals.NeverSolved)} loading={loading} empty={failed} />
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      <AnalyticsBlock title={t("admin.platformAnalytics.tasks.byCategory.title")} hint={t("admin.platformAnalytics.tasks.byCategory.hint")}>
        <AnalyticsChart option={(theme) => hBarOption(byCategory, { theme, name: t("admin.platformAnalytics.tasks.byCategory.series") })}
          loading={loading} error={error} empty={byCategory.length === 0} onRetry={reload} ariaLabel={t("admin.platformAnalytics.tasks.byCategory.title")} />
      </AnalyticsBlock>
      <AnalyticsBlock title={t("admin.platformAnalytics.tasks.byLevel.title")} hint={t("admin.platformAnalytics.tasks.byLevel.hint")}>
        <AnalyticsChart option={(theme) => barOption(byLevel.map((l) => levelLabel(l.Level)),
          [{ name: t("admin.platformAnalytics.tasks.byLevel.series"), data: byLevel.map((l) => Math.round(l.SolveRate * 100)) }],
          { theme, valueFormatter: (value) => `${value}%` })}
          loading={loading} error={error} empty={byLevel.length === 0} onRetry={reload} ariaLabel={t("admin.platformAnalytics.tasks.byLevel.title")} />
      </AnalyticsBlock>
    </div>
    <TaskUsageTable variant="usage" rows={data?.Tasks} total={data?.TasksTotal ?? 0} loading={loading} error={error} onRetry={reload} filters={filters} />
    <TaskUsageTable variant="unsolved" rows={data?.Unsolved} total={data?.UnsolvedTotal ?? 0} loading={loading} error={error} onRetry={reload} filters={filters} />
  </div>
}
