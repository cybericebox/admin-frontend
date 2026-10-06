/* eslint-disable @typescript-eslint/no-explicit-any -- ECharts options are read loosely in assertions */
import { describe, expect, it } from "vitest"
import { barOption, donutOption, hBarOption, lineOption } from "./chartOptions"
import { testChartTheme } from "@/test/chartTheme"

describe("chart options", () => {
  it("draws smooth time lines with an axis tooltip and zoom, in the theme colours", () => {
    const option = lineOption([{ name: "a", data: [["2026-01-01T00:00:00Z", 3]] }, { name: "b", data: [], hidden: true }], { theme: testChartTheme }) as any
    expect(option.series[0]).toMatchObject({ type: "line", smooth: true, data: [[Date.parse("2026-01-01T00:00:00Z"), 3]] })
    expect(option.tooltip.trigger).toBe("axis")
    expect(option.dataZoom).toHaveLength(2)
    expect(option.legend.selected).toEqual({ b: false })
    expect(option.color).toEqual(testChartTheme.palette)
    expect(option.yAxis.axisLabel.color).toBe(testChartTheme.axisText)
  })
  it("follows the design system chart theme: monotone 2px lines, axis 12 and legend 13, Ctrl+wheel zoom", () => {
    const option = lineOption([{ name: "a", data: [["2026-01-01T00:00:00Z", 3], ["2026-01-02T00:00:00Z", 4]] }, { name: "b", data: [["2026-01-01T00:00:00Z", 1]] }], { theme: testChartTheme }) as any
    expect(option.series[0]).toMatchObject({ smooth: true, smoothMonotone: "x", showSymbol: false, lineStyle: { width: 2 } })
    expect(option.series[1].showSymbol).toBe(true)
    expect(option.xAxis.axisLabel.fontSize).toBe(12)
    expect(option.legend.textStyle.fontSize).toBe(13)
    expect(option.dataZoom[0].zoomOnMouseWheel).toBe("ctrl")
    expect(option.animation).toBe(true)
  })
  it("stacks or groups bars", () => {
    const stacked = barOption(["x"], [{ name: "a", data: [1] }, { name: "b", data: [2] }], { stacked: true }) as any
    expect(stacked.series.every((s: any) => s.stack === "total")).toBe(true)
    const grouped = barOption(["x"], [{ name: "a", data: [1] }]) as any
    expect(grouped.series[0].stack).toBeUndefined()
  })
  it("ranks horizontal bars and builds a donut", () => {
    const h = hBarOption([{ name: "small", value: 1 }, { name: "big", value: 9 }]) as any
    expect(h.yAxis.data).toEqual(["big", "small"])
    const d = donutOption([{ name: "a", value: 1 }]) as any
    expect(d.series[0].type).toBe("pie")
  })
})
