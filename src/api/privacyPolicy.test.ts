import { describe, expect, it } from "vitest"
import { parsePolicyRetention } from "./privacyPolicy"

const DAY = 24 * 3600

describe("parsePolicyRetention", () => {
  it("gives seconds: a month is 30 days, a year 365", () => {
    expect(parsePolicyRetention({ A: { value: 90, unit: "days" }, B: { value: 14, unit: "months" }, C: { value: 3, unit: "years" } }))
      .toEqual({ A: 90 * DAY, B: 14 * 30 * DAY, C: 3 * 365 * DAY })
  })

  it("refuses a file that is not a map of positive whole periods", () => {
    expect(() => parsePolicyRetention(null)).toThrow()
    expect(() => parsePolicyRetention([])).toThrow()
    expect(() => parsePolicyRetention({ A: { value: 0, unit: "days" } })).toThrow()
    expect(() => parsePolicyRetention({ A: { value: 1.5, unit: "days" } })).toThrow()
    expect(() => parsePolicyRetention({ A: { value: 1, unit: "weeks" } })).toThrow()
    expect(() => parsePolicyRetention({ A: 30 })).toThrow()
  })
})
