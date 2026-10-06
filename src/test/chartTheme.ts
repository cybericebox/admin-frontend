import type { ChartTheme } from "@/components/analytics/chartTheme"

// A fixed chart theme for tests: jsdom cannot resolve the design tokens the real one reads.
export const testChartTheme: ChartTheme = {
  mode: "light",
  palette: ["#111111", "#222222", "#333333", "#444444", "#555555", "#666666", "#777777", "#888888", "#999999", "#aaaaaa"],
  axisText: "#101010", axisLine: "#202020", splitLine: "#303030", legendText: "#404040",
  tooltipBg: "#505050", tooltipBorder: "#606060", tooltipText: "#707070", surface: "#808080",
  font: "Geist", fsAxis: 12, fsLegend: 13, lineWidth: 2, reducedMotion: false,
}
