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
    const setPreset = vi.fn()
    render(<PeriodFilter period={{ preset: "30d", compare: false, setPreset, setCustom: vi.fn(), setCompare: vi.fn() }} />)
    expect(screen.getByRole("button", { name: "30 днів" })).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(screen.getByRole("button", { name: "Весь час" }))
    expect(setPreset).toHaveBeenCalledWith("all")
  })
  it("reads a custom range and the comparison from the address, with inclusive local days", () => {
    nav.search = "period=custom&from=2026-10-01&to=2026-10-31&compare=1"
    const { result } = renderHook(() => usePlatformPeriod())
    expect(result.current.preset).toBe("custom")
    expect(result.current.compare).toBe(true)
    expect(result.current.query).toEqual({ from: new Date("2026-10-01T00:00:00").toISOString(), to: new Date("2026-10-31T23:59:59.999").toISOString(), compare: "true" })
    expect(result.current.key).toContain("2026-10-01")
  })
  it("falls back to the default period for a broken custom range", () => {
    nav.search = "period=custom&from=2026-10-31&to=2026-10-01"
    const { result } = renderHook(() => usePlatformPeriod())
    expect(result.current.preset).toBe("30d")
  })
  it("writes a custom range and the comparison back to the address", () => {
    const { result } = renderHook(() => usePlatformPeriod())
    result.current.setCustom("2026-10-01", "2026-10-31")
    expect(nav.replace).toHaveBeenLastCalledWith("/analytics/events?period=custom&from=2026-10-01&to=2026-10-31", { scroll: false })
    result.current.setCompare(true)
    expect(nav.replace).toHaveBeenLastCalledWith("/analytics/events?compare=1", { scroll: false })
  })
  it("the custom range popover applies a valid range only", () => {
    const setCustom = vi.fn()
    render(<PeriodFilter period={{ preset: "30d", compare: false, setPreset: vi.fn(), setCustom, setCompare: vi.fn() }} />)
    fireEvent.click(screen.getByRole("button", { name: "Свій діапазон" }))
    fireEvent.change(screen.getByLabelText("Від"), { target: { value: "2026-10-01" } })
    fireEvent.change(screen.getByLabelText("До"), { target: { value: "2026-09-01" } })
    expect(screen.getByRole("button", { name: "Застосувати" })).toBeDisabled()
    fireEvent.change(screen.getByLabelText("До"), { target: { value: "2026-10-31" } })
    fireEvent.click(screen.getByRole("button", { name: "Застосувати" }))
    expect(setCustom).toHaveBeenCalledWith("2026-10-01", "2026-10-31")
  })
})
