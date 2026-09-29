import { chartThemes, type ChartTheme } from "./chartTheme"

// Shared ECharts options for every analytics chart: smooth lines, axis tooltip,
// wheel / slider zoom, slate axes. Pass `theme` from useChartTheme() so the
// colours fit the light or dark admin theme.
export type ChartOption = Record<string, unknown>

export type Point = [x: number | string | Date, y: number]
export type LineSeries = { name: string; data: Point[]; color?: string; area?: boolean; stack?: string; hidden?: boolean }
export type LineOptions = {
  theme?: ChartTheme
  /** "time" (default) takes epoch ms / ISO strings / Date; "category" takes labels. */
  xType?: "time" | "category"
  zoom?: boolean
  legend?: boolean
  smooth?: boolean
  minInterval?: number
  /** Formats y values in tooltip and axis. */
  valueFormatter?: (value: number) => string
  /** Dashed vertical markers on the first series, «name» at a time. */
  markers?: { name: string; at: number | string | Date }[]
}

const toX = (x: number | string | Date, type: "time" | "category") =>
  type === "time" ? (x instanceof Date ? x.getTime() : typeof x === "string" ? Date.parse(x) : x) : x

function base(theme: ChartTheme, legend: boolean, valueFormatter?: (value: number) => string, trigger: "axis" | "item" = "axis"): ChartOption {
  return {
    color: theme.palette,
    textStyle: { color: theme.axisText },
    legend: legend ? { type: "scroll", top: 0, textStyle: { color: theme.axisText }, pageTextStyle: { color: theme.axisText } } : { show: false },
    tooltip: {
      trigger,
      backgroundColor: theme.tooltipBg,
      borderColor: theme.tooltipBorder,
      textStyle: { color: theme.tooltipText },
      extraCssText: "box-shadow:none;",
      ...(valueFormatter ? { valueFormatter: (value: unknown) => valueFormatter(Number(value)) } : {}),
    },
  }
}

const valueAxis = (theme: ChartTheme, minInterval?: number, formatter?: (value: number) => string) => ({
  type: "value", min: 0, ...(minInterval ? { minInterval } : {}),
  axisLabel: { color: theme.axisText, ...(formatter ? { formatter: (value: number) => formatter(value) } : {}) },
  splitLine: { lineStyle: { color: theme.splitLine } },
})

export function lineOption(series: LineSeries[], opts: LineOptions = {}): ChartOption {
  const theme = opts.theme ?? chartThemes.light
  const xType = opts.xType ?? "time"
  const legend = opts.legend ?? series.length > 1
  const zoom = opts.zoom ?? xType === "time"
  const legendSelected = Object.fromEntries(series.filter((s) => s.hidden).map((s) => [s.name, false]))
  return {
    ...base(theme, legend, opts.valueFormatter),
    grid: { left: 44, right: 16, top: legend ? 36 : 16, bottom: zoom ? 64 : 28, containLabel: false },
    ...(legend ? { legend: { type: "scroll", top: 0, textStyle: { color: theme.axisText }, pageTextStyle: { color: theme.axisText }, selected: legendSelected } } : {}),
    xAxis: {
      type: xType,
      axisLine: { lineStyle: { color: theme.axisLine } },
      axisLabel: { color: theme.axisText },
      splitLine: { show: false },
    },
    yAxis: valueAxis(theme, opts.minInterval ?? 1, opts.valueFormatter),
    ...(zoom ? { dataZoom: [{ type: "inside", filterMode: "none" }, { type: "slider", height: 18, bottom: 8, filterMode: "none", textStyle: { color: theme.axisText } }] } : {}),
    series: series.map((s, index) => ({
      name: s.name, type: "line", smooth: opts.smooth ?? true, showSymbol: false,
      color: s.color, lineStyle: { width: 2 }, emphasis: { focus: "series" },
      ...(s.area ? { areaStyle: { opacity: 0.12 } } : {}),
      ...(s.stack ? { stack: s.stack } : {}),
      data: s.data.map(([x, y]) => [toX(x, xType), y]),
      ...(index === 0 && opts.markers?.length ? {
        markLine: {
          silent: true, symbol: "none", lineStyle: { type: "dashed", color: theme.axisText }, label: { formatter: "{b}", color: theme.axisText },
          data: opts.markers.map((m) => ({ name: m.name, xAxis: toX(m.at, xType) })),
        },
      } : {}),
    })),
  }
}

export type BarSeries = { name: string; data: number[]; color?: string }
export type BarOptions = { theme?: ChartTheme; stacked?: boolean; legend?: boolean; valueFormatter?: (value: number) => string; minInterval?: number }

/** Vertical bars over categories; `stacked` stacks the series, otherwise they are grouped. */
export function barOption(categories: string[], series: BarSeries[], opts: BarOptions = {}): ChartOption {
  const theme = opts.theme ?? chartThemes.light
  const legend = opts.legend ?? series.length > 1
  return {
    ...base(theme, legend, opts.valueFormatter),
    grid: { left: 44, right: 16, top: legend ? 36 : 16, bottom: 28 },
    xAxis: { type: "category", data: categories, axisLine: { lineStyle: { color: theme.axisLine } }, axisLabel: { color: theme.axisText } },
    yAxis: valueAxis(theme, opts.minInterval ?? 1, opts.valueFormatter),
    series: series.map((s) => ({
      name: s.name, type: "bar", color: s.color, data: s.data, emphasis: { focus: "series" },
      ...(opts.stacked ? { stack: "total" } : {}), itemStyle: { borderRadius: opts.stacked ? 0 : [3, 3, 0, 0] },
    })),
  }
}

export type Slice = { name: string; value: number; color?: string }

/** Ranked horizontal bars (largest on top) for a distribution. */
export function hBarOption(items: Slice[], opts: { theme?: ChartTheme; valueFormatter?: (value: number) => string; name?: string } = {}): ChartOption {
  const theme = opts.theme ?? chartThemes.light
  const sorted = [...items].sort((a, b) => b.value - a.value)
  return {
    ...base(theme, false, opts.valueFormatter),
    grid: { left: 8, right: 24, top: 8, bottom: 8, containLabel: true },
    xAxis: { type: "value", min: 0, axisLabel: { color: theme.axisText }, splitLine: { lineStyle: { color: theme.splitLine } } },
    yAxis: { type: "category", inverse: true, data: sorted.map((item) => item.name), axisLine: { lineStyle: { color: theme.axisLine } }, axisLabel: { color: theme.axisText, width: 140, overflow: "truncate" } },
    series: [{
      name: opts.name, type: "bar", barMaxWidth: 22, itemStyle: { borderRadius: [0, 3, 3, 0] },
      data: sorted.map((item, index) => ({ value: item.value, itemStyle: { color: item.color ?? theme.palette[index % theme.palette.length] } })),
    }],
  }
}

/** Donut of shares with the legend below. */
export function donutOption(items: Slice[], opts: { theme?: ChartTheme; valueFormatter?: (value: number) => string; name?: string } = {}): ChartOption {
  const theme = opts.theme ?? chartThemes.light
  return {
    ...base(theme, true, opts.valueFormatter, "item"),
    legend: { type: "scroll", bottom: 0, textStyle: { color: theme.axisText }, pageTextStyle: { color: theme.axisText } },
    series: [{
      name: opts.name, type: "pie", radius: ["50%", "72%"], center: ["50%", "44%"], avoidLabelOverlap: true,
      label: { show: false }, labelLine: { show: false },
      itemStyle: { borderColor: theme.surface, borderWidth: 2 },
      data: items.map((item) => ({ name: item.name, value: item.value, ...(item.color ? { itemStyle: { color: item.color, borderColor: theme.surface, borderWidth: 2 } } : {}) })),
    }],
  }
}
