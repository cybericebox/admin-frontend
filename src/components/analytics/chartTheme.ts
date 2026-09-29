"use client"

import { useSyncExternalStore } from "react"

// ECharts needs concrete colours, not CSS variables, so the admin light and dark
// themes (html[data-theme]) each get a palette. The look follows the event
// analytics charts: slate axes and grid, the same series hues.
export type ChartTheme = {
  mode: "light" | "dark"
  palette: string[]
  axisText: string
  axisLine: string
  splitLine: string
  tooltipBg: string
  tooltipBorder: string
  tooltipText: string
  surface: string
}

const light: ChartTheme = {
  mode: "light",
  palette: ["#0091EA", "#1E2A6B", "#22C55E", "#F59E0B", "#EF4444", "#8B5CF6", "#14B8A6", "#EC4899"],
  axisText: "#64748b",
  axisLine: "#cbd5e1",
  splitLine: "#e2e8f0",
  tooltipBg: "#ffffff",
  tooltipBorder: "#e4e4ec",
  tooltipText: "#2C2B42",
  surface: "#ffffff",
}

const dark: ChartTheme = {
  mode: "dark",
  palette: ["#38BDF8", "#818CF8", "#4ADE80", "#FBBF24", "#F87171", "#A78BFA", "#2DD4BF", "#F472B6"],
  axisText: "#BBB9CB",
  axisLine: "#646363",
  splitLine: "rgba(255,255,255,0.12)",
  tooltipBg: "#58575A",
  tooltipBorder: "#646363",
  tooltipText: "#DAD9E5",
  surface: "#4C4B4D",
}

export const chartThemes = { light, dark }

function currentMode(): "light" | "dark" {
  if (typeof document === "undefined") return "light"
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light"
}

function subscribe(onChange: () => void): () => void {
  if (typeof document === "undefined") return () => {}
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] })
  return () => observer.disconnect()
}

/** The chart palette of the theme the admin shows now; follows theme switches. */
export function useChartTheme(): ChartTheme {
  const mode = useSyncExternalStore(subscribe, currentMode, () => "light" as const)
  return chartThemes[mode]
}
