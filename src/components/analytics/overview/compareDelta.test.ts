import { describe, expect, it, vi } from "vitest"
vi.mock("@/i18n/t", () => ({ t: (key: string) => key }))
import { compareDelta } from "./format"

describe("the comparison with the previous period", () => {
  it("shows the relative change, green for a rise and red for a fall (inverted for «less is better»)", () => {
    expect(compareDelta(120, 100)).toEqual({ text: "+20%", tone: "up" })
    expect(compareDelta(80, 100)).toEqual({ text: "−20%", tone: "down" })
    expect(compareDelta(3, 5, true)).toEqual({ text: "−40%", tone: "up" })
    expect(compareDelta(100, 100)).toEqual({ text: "0%", tone: "flat" })
  })
  it("shows the plain difference when the previous period had nothing", () => {
    expect(compareDelta(7, 0)?.text).toBe("+7")
  })
  it("shows nothing without a previous report or a number", () => {
    expect(compareDelta(5, null)).toBeUndefined()
    expect(compareDelta(5, undefined)).toBeUndefined()
    expect(compareDelta(undefined, 5)).toBeUndefined()
  })
})
