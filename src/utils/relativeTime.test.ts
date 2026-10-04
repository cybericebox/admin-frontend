import { describe, expect, it } from "vitest"
import { relativeTime } from "./relativeTime"

const now = Date.parse("2026-10-01T12:00:00Z")

describe("relativeTime", () => {
  it("counts in the largest whole unit", () => {
    expect(relativeTime("2026-10-01T11:55:00Z", now)).toBe("5 хвилин тому")
    expect(relativeTime("2026-10-01T09:00:00Z", now)).toBe("3 години тому")
    expect(relativeTime("2026-09-28T12:00:00Z", now)).toBe("3 дні тому")
  })

  it("never goes into the future", () => {
    expect(relativeTime("2026-10-01T12:00:30Z", now)).toBe("зараз")
  })
})
