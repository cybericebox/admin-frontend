import { describe, expect, it, vi } from "vitest"
import { CHART_LOCALE } from "./chartLocaleName"

// The real echarts is heavy to load in jsdom; the registration is checked against a stub.
const registerLocale = vi.hoisted(() => vi.fn())
vi.mock("echarts", () => ({ registerLocale }))
vi.unmock("@/components/analytics/echartsLocale")

describe("chart locale", () => {
  it("registers the ECharts Ukrainian locale under the name every chart is created with", async () => {
    await import("@/components/analytics/echartsLocale")
    expect(registerLocale).toHaveBeenCalledOnce()
    const [name, locale] = registerLocale.mock.calls[0] as [string, { time: { monthAbbr: string[] } }]
    expect(name).toBe(CHART_LOCALE)
    expect(locale.time.monthAbbr[9]).toBe("Жов")
    expect(locale.time.monthAbbr).not.toContain("Oct")
  })
})
