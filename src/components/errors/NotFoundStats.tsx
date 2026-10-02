"use client"
import { useCallback, useEffect, useMemo, useState } from "react"
import { getNotFoundStats, type NotFoundStats as Stats } from "@/api/errorJournal"
import { AnalyticsChart } from "@/components/analytics/AnalyticsChart"
import { DataTable, type Column } from "@/components/analytics/DataTable"
import { lineOption } from "@/components/analytics/chartOptions"
import { SelectMenu } from "@/components/ui/select-menu"
import { t } from "@/i18n/t"
import { formatNumber } from "@/lib/locale"
import { notFoundPerDay } from "@/lib/errorJournal"

const DAY_MS = 86_400_000
const PERIODS = ["7", "30", "90"] as const

type Row = { Route: string; Hits: number }

export function NotFoundStats() {
  const [days, setDays] = useState<(typeof PERIODS)[number]>("30")
  const [reload, setReload] = useState(0)
  const [data, setData] = useState<{ key: string; stats: Stats } | null>(null)
  const [failure, setFailure] = useState<{ key: string; cause: unknown } | null>(null)
  const key = `${days}|${reload}`

  useEffect(() => {
    let active = true
    const now = Date.now()
    getNotFoundStats({ from: new Date(now - Number(days) * DAY_MS).toISOString(), to: new Date(now).toISOString() })
      .then((stats) => { if (active) { setData({ key, stats }); setFailure(null) } })
      .catch((cause) => { if (active) setFailure({ key, cause }) })
    return () => { active = false }
  }, [days, key])

  const failed = failure?.key === key ? failure : null
  const refreshing = !failed && data?.key !== key
  const stats = data?.stats
  const perDay = useMemo(() => (stats ? notFoundPerDay(stats) : []), [stats])
  const retry = useCallback(() => setReload((value) => value + 1), [])
  const columns: Column<Row>[] = [
    { key: "route", header: t("admin.errors.notFound.route"), cell: (row) => row.Route ? <span className="font-mono">{row.Route}</span> : <span className="text-muted-foreground">{t("admin.errors.notFound.unmatched")}</span>, sortValue: (row) => row.Route },
    { key: "hits", header: t("admin.errors.notFound.hits"), numeric: true, cell: (row) => formatNumber(row.Hits), sortValue: (row) => row.Hits },
  ]

  return (
    <div className="flex flex-col gap-4" aria-busy={refreshing}>
      <div className="flex flex-wrap items-center gap-3">
        <SelectMenu value={days} onChange={(value) => setDays(value as (typeof PERIODS)[number])} ariaLabel={t("admin.errors.filter.period")} className="min-w-44"
          options={PERIODS.map((value) => ({ value, label: t("admin.errors.notFound.period", { count: value }) }))} />
        {stats && <span className="text-sm text-muted-foreground">{t("admin.errors.notFound.total", { count: formatNumber(stats.Total) })}</span>}
      </div>
      <p className="text-sm text-muted-foreground">{t("admin.errors.notFound.help")}</p>
      <AnalyticsChart ariaLabel={t("admin.errors.notFound.chart")} loading={!data && !failed} error={failed ? failed.cause : undefined} onRetry={retry}
        errorMessage={t("admin.errors.notFound.loadError")} emptyMessage={t("admin.errors.notFound.empty")} empty={perDay.length === 0}
        option={(theme) => lineOption([{ name: t("admin.errors.notFound.hits"), data: perDay, area: true }], { theme, xType: "category", zoom: false, legend: false })} />
      <DataTable<Row> ariaLabel={t("admin.errors.notFound.byRoute")} columns={columns} rows={stats?.Routes} rowKey={(row) => row.Route || "_unmatched"}
        loading={!data && !failed} error={failed ? failed.cause : undefined} onRetry={retry} errorMessage={t("admin.errors.notFound.loadError")}
        emptyMessage={t("admin.errors.notFound.empty")} minHeight={200} />
    </div>
  )
}
