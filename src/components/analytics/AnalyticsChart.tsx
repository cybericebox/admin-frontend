"use client"

import { lazy, Suspense, type CSSProperties } from "react"
import type { EChartsOption } from "echarts"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadError } from "@/components/ui/load-error"
import { LoadingArea } from "@/components/ui/spinner"
import { t } from "@/i18n/t"
import { useChartTheme, type ChartTheme } from "./chartTheme"
import type { ChartOption } from "./chartOptions"

// echarts is heavy: load it on the first chart only.
const ReactECharts = lazy(() => import("echarts-for-react"))

// A chart whose every value is zero says «no data» instead of drawing flat lines.
function allZero(option: ChartOption | undefined): boolean {
  const series = option?.series
  if (!Array.isArray(series) || series.length === 0) return false
  const values = series.flatMap((item) => Array.isArray(item?.data) ? item.data as unknown[] : [])
  if (values.length === 0) return false
  return values.every((point) => {
    const raw = Array.isArray(point) ? point[point.length - 1] : point && typeof point === "object" ? (point as { value?: unknown }).value : point
    const value = Array.isArray(raw) ? raw[raw.length - 1] : raw
    return typeof value === "number" && value === 0
  })
}

/**
 * The chart block every analytics section uses. Constant height; loading (crest),
 * error (LoadError) and empty (EmptyState) are centred inside that same block, so
 * nothing jumps between states. `option` is an ECharts option, or a function of the
 * current chart theme (light/dark) - build it with lineOption / barOption / hBarOption
 * / donutOption from chartOptions.ts.
 */
export function AnalyticsChart({ option, loading = false, error, empty = false, height = 320, ariaLabel, emptyMessage, errorMessage, onRetry, onEvents, className }: {
  option?: ChartOption | ((theme: ChartTheme) => ChartOption)
  loading?: boolean
  error?: unknown
  empty?: boolean
  height?: number
  ariaLabel: string
  emptyMessage?: string
  errorMessage?: string
  onRetry?: () => void
  /** ECharts event handlers by event name, e.g. { click: (params) => … }. */
  onEvents?: Record<string, (params: never) => void>
  className?: string
}) {
  const theme = useChartTheme()
  const failed = error !== undefined && error !== null && error !== false
  const resolved = typeof option === "function" ? option(theme) : option
  const state = loading ? "loading" : failed ? "error" : empty || !option || allZero(resolved) ? "empty" : "ready"
  // Only the canvas is an image: the state components keep their own roles (a retry button inside role=img is unreachable).
  return <div className={className} style={{ height, "--analytics-block-h": `${height}px` } as CSSProperties} role={state === "ready" ? "img" : undefined} aria-label={state === "ready" ? ariaLabel : undefined} aria-busy={loading}>
    {state === "loading" && <LoadingArea className="h-full w-full" label={t("admin.loading")} />}
    {state === "error" && <LoadError className="h-full" message={errorMessage ?? t("admin.platformAnalytics.chart.error")} error={error} onRetry={onRetry} />}
    {state === "empty" && <EmptyState className="h-full" message={emptyMessage ?? t("admin.platformAnalytics.chart.empty")} />}
    {state === "ready" && resolved && (
      <Suspense fallback={<LoadingArea className="h-full w-full" label={t("admin.loading")} />}>
        <ReactECharts style={{ height: "100%", width: "100%" }} option={resolved as EChartsOption} onEvents={onEvents} notMerge />
      </Suspense>
    )}
  </div>
}
