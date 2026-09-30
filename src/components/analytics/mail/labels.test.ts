import { describe, expect, it } from "vitest"
import { formatNumber } from "@/lib/locale"
import { engagementRate } from "./labels"

describe("engagementRate", () => {
  it("formats the rate of tracked emails", () => {
    expect(engagementRate(40, 0.425, formatNumber)).toBe("42,5%")
  })
  it("shows a dash when nothing was tracked, whatever the rate", () => {
    expect(engagementRate(0, 0, formatNumber)).toBe("–")
    expect(engagementRate(undefined, undefined, formatNumber)).toBe("–")
  })
})
