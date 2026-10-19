import { describe, expect, it } from "vitest"
import uk from "../../messages/uk.json"
import en from "../../messages/en.json"
import type { AlarmKind, ReservationPart } from "@/api/resourceCalendar"
import { shrinksBelowUse } from "@/lib/resourceCalendar"

const KINDS: AlarmKind[] = ["not_placed", "agent_lost", "agent_shrunk", "not_connected", "cluster_sync_failed", "cluster_shrink_held"]

describe("cluster reservations", () => {
  it("new alarm kinds have texts", () => {
    for (const messages of [uk, en] as Record<string, string>[]) {
      for (const kind of KINDS) expect(messages[`admin.resources.alarms.kind.${kind}`], kind).toBeTruthy()
    }
  })

  const part = (over: Partial<ReservationPart> = {}): ReservationPart => ({
    PartID: "p", AgentID: "a", AgentName: "a", From: "2026-10-19T10:00:00Z", To: "2026-10-19T14:00:00Z", Amount: { CPUMillicores: 4000, MemoryBytes: 4000 },
    Used: { CPUMillicores: 2000, MemoryBytes: 1000 }, Groups: 2, Phase: "Active", EndsAt: null, Synced: true, SyncError: "", ShrinkHeld: false, Retiring: false, ...over,
  })

  it("asks before a size or an end below what runs", () => {
    const to = "2026-10-19T14:00:00Z"
    expect(shrinksBelowUse([part()], { CPUMillicores: 1500, MemoryBytes: 4000 }, to, to)).toBe(true)
    expect(shrinksBelowUse([part()], { CPUMillicores: 3000, MemoryBytes: 4000 }, to, to)).toBe(false)
    expect(shrinksBelowUse([part()], { CPUMillicores: 3000, MemoryBytes: 4000 }, "2026-10-19T13:00:00Z", to)).toBe(true)
    expect(shrinksBelowUse([part({ Groups: 0 })], { CPUMillicores: 1, MemoryBytes: 1 }, "2026-10-19T13:00:00Z", to)).toBe(false)
  })
})
