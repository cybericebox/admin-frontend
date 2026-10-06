"use client"

import { useMemo, useSyncExternalStore } from "react"
import "@/styles/ds/chart-theme"

// ECharts needs concrete colours, not CSS variables. The design system helper (src/styles/ds/chart-theme.js, copied from
// docs/design-system) reads the --ib-chart-* and --ib-s* tokens from the page at render time, so both themes follow the
// tokens and no colour is written here.
export type ChartTheme = {
  mode: "light" | "dark"
  /** Series colours --ib-s1..s10. */
  palette: string[]
  axisText: string
  axisLine: string
  splitLine: string
  legendText: string
  tooltipBg: string
  tooltipBorder: string
  tooltipText: string
  surface: string
  font: string
  /** Axis label size (12) and legend size (13), px. */
  fsAxis: number
  fsLegend: number
  lineWidth: number
  reducedMotion: boolean
}

function currentMode(): "light" | "dark" {
  if (typeof document === "undefined") return "light"
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light"
}

/** The chart theme the page shows now, read from the design tokens. */
export function readChartTheme(el?: Element): ChartTheme {
  const tokens = window.IB.ChartTheme.tokens(el)
  return {
    mode: currentMode(),
    palette: tokens.series,
    axisText: tokens.axis,
    axisLine: tokens.line,
    splitLine: tokens.grid,
    legendText: tokens.legend,
    tooltipBg: tokens.raised,
    tooltipBorder: tokens.tipLine,
    tooltipText: tokens.ink,
    surface: tokens.surface,
    font: tokens.font,
    fsAxis: tokens.fsAxis,
    fsLegend: tokens.fsLegend,
    lineWidth: tokens.lineWidth,
    reducedMotion: tokens.reducedMotion,
  }
}

function subscribe(onChange: () => void): () => void {
  if (typeof document === "undefined") return () => {}
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] })
  return () => observer.disconnect()
}

/** The chart theme of the admin theme shown now; follows theme switches. */
export function useChartTheme(): ChartTheme {
  const mode = useSyncExternalStore(subscribe, currentMode, () => "light" as const)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the tokens change with the mode only
  return useMemo(() => readChartTheme(), [mode])
}
