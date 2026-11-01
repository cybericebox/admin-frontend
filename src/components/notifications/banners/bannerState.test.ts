import { describe, expect, it } from "vitest"
import { bannersBySite } from "./BannersAdmin"

const now = Date.parse("2026-11-01T12:00:00Z")
const banner = (over: object) => ({ IsActive: true, ActiveFrom: null, ActiveTo: null, TargetMode: "all", TargetSites: [], ...over }) as Parameters<typeof bannersBySite>[0][number]

describe("where the banners show now", () => {
  it("counts a banner for every site it targets, only while it is inside its window and switched on", () => {
    const counts = bannersBySite([
      banner({}),
      banner({ TargetMode: "selected", TargetSites: ["main", "event"] }),
      banner({ IsActive: false }),
      banner({ ActiveTo: "2026-10-01T00:00:00Z" }),
      banner({ ActiveFrom: "2026-12-01T00:00:00Z" }),
    ], now)
    expect(counts).toEqual({ main: 2, id: 1, admin: 1, exercises: 1, event: 2 })
  })
})
