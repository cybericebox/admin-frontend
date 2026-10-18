import { describe, expect, it } from "vitest"
import { parsePolicyRetention } from "./privacyPolicy"

const DAY = 24 * 3600

describe("parsePolicyRetention", () => {
  it("gives seconds: a month is 30 days, a year 365", () => {
    expect(parsePolicyRetention({ A: { value: 90, unit: "days", kind: "upTo" }, B: { value: 14, unit: "months", kind: "for" }, C: { value: 3, unit: "years", kind: "over" } }))
      .toEqual({ A: { seconds: 90 * DAY, kind: "upTo" }, B: { seconds: 14 * 30 * DAY, kind: "for" }, C: { seconds: 3 * 365 * DAY, kind: "over" } })
  })

  it("refuses a file that is not a map of positive whole periods", () => {
    expect(() => parsePolicyRetention(null)).toThrow()
    expect(() => parsePolicyRetention([])).toThrow()
    expect(() => parsePolicyRetention({ A: { value: 0, unit: "days", kind: "upTo" } })).toThrow()
    expect(() => parsePolicyRetention({ A: { value: 1.5, unit: "days", kind: "upTo" } })).toThrow()
    expect(() => parsePolicyRetention({ A: { value: 1, unit: "weeks", kind: "upTo" } })).toThrow()
    expect(() => parsePolicyRetention({ A: 30 })).toThrow()
    expect(() => parsePolicyRetention({ A: { value: 1, unit: "days" } })).toThrow()
    expect(() => parsePolicyRetention({ A: { value: 1, unit: "days", kind: "about" } })).toThrow()
  })
})
