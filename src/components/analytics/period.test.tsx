import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, renderHook, screen } from "@testing-library/react"
import { DEFAULT_PERIOD, parsePreset, periodRange } from "./period"
import { usePlatformPeriod } from "./usePlatformPeriod"
import { PeriodFilter } from "./PeriodFilter"

const nav = vi.hoisted(() => ({ search: "", replace: vi.fn() }))
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({ replace: nav.replace }),
  usePathname: () => "/analytics/events",
}))

beforeEach(() => { nav.search = ""; nav.replace.mockClear() })

describe("period", () => {
  it("parses presets with a 30d default", () => {
    expect(parsePreset("7d")).toBe("7d")
    expect(parsePreset("bogus")).toBe(DEFAULT_PERIOD)
    expect(parsePreset(null)).toBe("30d")
  })
  it("resolves RFC 3339 UTC bounds, none for all time", () => {
    const now = Date.parse("2026-03-31T12:00:00Z")
    expect(periodRange("7d", now)).toEqual({ from: "2026-03-24T12:00:00.000Z", to: "2026-03-31T12:00:00.000Z" })
    expect(periodRange("all", now)).toEqual({})
  })
  it("usePlatformPeriod reads ?period and writes it back, dropping the default", () => {
    nav.search = "period=90d&x=1"
    const { result } = renderHook(() => usePlatformPeriod())
    expect(result.current.preset).toBe("90d")
    expect(result.current.from).toBeTypeOf("string")
    expect(result.current.query).toEqual({ from: result.current.from, to: result.current.to })
    result.current.setPreset("7d")
    expect(nav.replace).toHaveBeenCalledWith("/analytics/events?period=7d&x=1", { scroll: false })
    result.current.setPreset("30d")
    expect(nav.replace).toHaveBeenLastCalledWith("/analytics/events?x=1", { scroll: false })
  })
  it("all time has no bounds", () => {
    nav.search = "period=all"
    const { result } = renderHook(() => usePlatformPeriod())
    expect(result.current.from).toBeUndefined()
    expect(result.current.query).toEqual({})
  })
  it("PeriodFilter marks the active preset and reports clicks", () => {
    const onChange = vi.fn()
    render(<PeriodFilter preset="30d" onChange={onChange} />)
    expect(screen.getByRole("button", { name: "30 днів" })).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(screen.getByRole("button", { name: "Весь час" }))
    expect(onChange).toHaveBeenCalledWith("all")
  })
})
