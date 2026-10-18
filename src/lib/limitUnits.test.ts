import { describe, expect, it } from "vitest"
import { bestUnit, fromBase, toBase } from "./limitUnits"

const HOUR = 3600
const DAY = 24 * HOUR
const MIB = 1024 * 1024

describe("limit units", () => {
  it("picks the largest allowed unit that divides the value exactly", () => {
    expect(bestUnit("duration", 36 * HOUR, ["hours", "days"])).toBe("hours")
    expect(bestUnit("duration", 72 * HOUR, ["hours", "days"])).toBe("days")
    expect(bestUnit("duration", 3 * 365 * DAY, ["days", "years"])).toBe("years")
    expect(bestUnit("duration", 366 * DAY, ["years", "days"])).toBe("days")
    expect(bestUnit("size", 2048 * MIB, ["MiB", "GiB"])).toBe("GiB")
    expect(bestUnit("size", 512 * MIB, ["MiB", "GiB"])).toBe("MiB")
  })

  it("falls back to the smallest allowed unit when none divides", () => {
    expect(bestUnit("duration", 90 * 60, ["days", "hours"])).toBe("hours")
  })

  it("has no unit for counts or units of another kind", () => {
    expect(bestUnit("count", 1000, [])).toBeUndefined()
    expect(bestUnit("duration", DAY, ["MiB"])).toBeUndefined()
  })

  it("converts both ways without rounding", () => {
    expect(toBase(36, "hours")).toBe(36 * HOUR)
    expect(toBase(1, "years")).toBe(365 * DAY)
    expect(toBase(3, "GiB")).toBe(3 * 1024 * MIB)
    expect(fromBase(36 * HOUR, "days")).toBe(1.5)
    expect(fromBase(512 * MIB, "MiB")).toBe(512)
  })
})
