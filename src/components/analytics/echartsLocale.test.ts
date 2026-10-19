import { describe, expect, it, vi } from "vitest"
import { init } from "echarts"
import { CHART_LOCALE } from "./chartLocaleName"

vi.unmock("@/components/analytics/echartsLocale")

describe("chart locale", () => {
  it("names months in Ukrainian on a time axis", async () => {
    await import("@/components/analytics/echartsLocale")
    const dom = document.createElement("div")
    Object.defineProperty(dom, "clientWidth", { value: 800 })
    Object.defineProperty(dom, "clientHeight", { value: 300 })
    const chart = init(dom, undefined, { renderer: "svg", width: 800, height: 300, locale: CHART_LOCALE })
    chart.setOption({ xAxis: { type: "time" }, yAxis: { type: "value" }, series: [{ type: "line", data: [[Date.UTC(2026, 8, 20), 1], [Date.UTC(2026, 10, 10), 2]] }] })
    const text = dom.textContent ?? ""
    chart.dispose()
    expect(text).toMatch(/Жов|Лис/)
    expect(text).not.toMatch(/Oct|Nov/)
  })
})
