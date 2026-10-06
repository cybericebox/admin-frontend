import type { ChartOption } from "@/components/analytics/chartOptions"
import type { ChartTheme } from "@/components/analytics/chartTheme"
import { MIB, type Resource, type TimelineModel } from "@/lib/resourceCalendar"

type Labels = {
  capacity: string
  pool: string
  conflict: string
  /** Formats a resource value (millicores or bytes) for axes and tooltips. */
  format: (value: number) => string
  /** One line per bar for the tooltip: window and size. */
  tooltip: (bar: TimelineModel["bars"][number]) => string
}

// Semantic colours come from the tokens at render time (both themes); the series palette is the fallback.
const token = (name: string, fallback: string) =>
  typeof document === "undefined" ? fallback : getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback

// Rectangles only: no shadows, no left accents. A reservation that is not covered by
// resources is drawn dashed in the warning hue; a conflict range is a danger-tinted band.
export function timelineOption(model: TimelineModel, resource: Resource, theme: ChartTheme, labels: Labels): ChartOption {
  const eventColor = theme.palette[0]
  const bookingColor = theme.palette[2]
  const warnColor = token("--ib-warn", theme.palette[3])
  const dangerColor = token("--ib-danger", theme.palette[4])
  const yMax = model.top > 0 ? model.top * 1.1 : resource === "cpu" ? 1000 : 1024 * MIB
  const capacityLine = model.capacity === null ? [] : [{ name: labels.capacity, yAxis: model.capacity }]
  return {
    color: theme.palette,
    animation: !theme.reducedMotion,
    textStyle: { color: theme.axisText, fontSize: theme.fsAxis, fontFamily: theme.font },
    grid: { left: 64, right: 16, top: 16, bottom: 64 },
    tooltip: {
      trigger: "item", backgroundColor: theme.tooltipBg, borderColor: theme.tooltipBorder, borderWidth: 1, textStyle: { color: theme.tooltipText, fontSize: 13, fontFamily: theme.font }, extraCssText: "box-shadow:none;border-radius:6px;",
      formatter: (params: { data?: { bar?: TimelineModel["bars"][number] } }) => (params.data?.bar ? labels.tooltip(params.data.bar) : ""),
    },
    xAxis: { type: "time", min: model.from, max: model.to, axisLine: { lineStyle: { color: theme.axisLine } }, axisLabel: { color: theme.axisText, fontSize: theme.fsAxis, fontFamily: theme.font, hideOverlap: true }, splitLine: { show: false } },
    yAxis: {
      type: "value", min: 0, max: yMax, axisLine: { lineStyle: { color: theme.axisLine } }, axisLabel: { color: theme.axisText, fontSize: theme.fsAxis, fontFamily: theme.font, formatter: (value: number) => labels.format(value) },
      splitLine: { lineStyle: { color: theme.splitLine } },
    },
    dataZoom: [{ type: "inside", filterMode: "none", xAxisIndex: 0, zoomOnMouseWheel: "ctrl", moveOnMouseMove: true }, { type: "slider", height: 18, bottom: 8, filterMode: "none", xAxisIndex: 0, textStyle: { color: theme.axisText, fontSize: theme.fsAxis, fontFamily: theme.font } }],
    series: [
      {
        name: labels.pool, type: "custom", silent: true, z: 1,
        renderItem: (_: unknown, api: { coord: (point: number[]) => number[] }) => {
          const [x0, y1] = api.coord([model.from, model.pool])
          const [x1, y0] = api.coord([model.to, 0])
          return { type: "rect", shape: { x: x0, y: y1, width: x1 - x0, height: y0 - y1 }, style: { fill: theme.axisLine, opacity: 0.35 } }
        },
        data: model.pool > 0 ? [[model.from, model.pool]] : [],
      },
      {
        name: labels.conflict, type: "custom", silent: true, z: 0,
        renderItem: (_: unknown, api: { value: (dim: number) => number; coord: (point: number[]) => number[] }) => {
          const [x0, top] = api.coord([api.value(0), yMax])
          const [x1, bottom] = api.coord([api.value(1), 0])
          return { type: "rect", shape: { x: x0, y: top, width: Math.max(2, x1 - x0), height: bottom - top }, style: { fill: dangerColor, opacity: 0.14 } }
        },
        data: model.conflicts.map((range) => [range.from, range.to]),
      },
      {
        name: "reservations", type: "custom", z: 2,
        renderItem: (_: unknown, api: { value: (dim: number) => number; coord: (point: number[]) => number[] }) => {
          const index = api.value(4)
          const bar = model.bars[index]
          const [x0, top] = api.coord([bar.from, bar.y1])
          const [x1, bottom] = api.coord([bar.to, bar.y0])
          const color = !bar.covered ? warnColor : bar.kind === "event" ? eventColor : bookingColor
          return {
            type: "rect", shape: { x: x0, y: top, width: Math.max(2, x1 - x0), height: Math.max(2, bottom - top) },
            style: { fill: color, opacity: bar.covered ? 0.5 : 0.28, stroke: color, lineWidth: 1, lineDash: bar.covered ? undefined : [5, 3] },
          }
        },
        encode: { x: [0, 1], y: [2, 3] },
        data: model.bars.map((bar, index) => ({ value: [bar.from, bar.to, bar.y0, bar.y1, index], bar })),
      },
      {
        name: labels.capacity, type: "line", symbol: "none", silent: true, z: 3, data: [],
        markLine: {
          silent: true, symbol: "none", lineStyle: { type: "solid", color: theme.axisText, width: 2 },
          label: { formatter: () => labels.capacity, color: theme.axisText, fontSize: theme.fsAxis, fontFamily: theme.font, position: "insideEndTop" },
          data: capacityLine,
        },
      },
    ],
  }
}
