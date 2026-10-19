import { describe, expect, it } from "vitest"
import uk from "../../messages/uk.json"
import en from "../../messages/en.json"
import type { AlarmKind, Reservation, ReservationPart } from "@/api/resourceCalendar"
import { SHRINK_NOTICE_MINUTES, shrinksBelowUse } from "@/lib/resourceCalendar"

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

  // Two agents: a holds 2 of 4 teams, b the other 2; each part uses what runs on its agent.
  const next = (over: Partial<Pick<Reservation, "Size" | "Teams" | "Placement" | "To">> = {}) => ({
    Size: { CPUMillicores: 8000, MemoryBytes: 8000 }, Teams: 4, To: "2026-10-19T14:00:00Z",
    Placement: [{ AgentID: "a", AgentName: "a", Units: 2 }, { AgentID: "b", AgentName: "b", Units: 2 }], ...over,
  })
  const now = Date.parse("2026-10-19T12:00:00Z")
  const to = "2026-10-19T14:00:00Z"

  it("compares each part with its agent's new share, not the whole size with the sum", () => {
    const parts = [part({ AgentID: "a", Used: { CPUMillicores: 3500, MemoryBytes: 1000 } }), part({ AgentID: "b", Used: { CPUMillicores: 100, MemoryBytes: 100 } })]
    // 8000 x 2 / 4 = 4000 per agent: both fit.
    expect(shrinksBelowUse(parts, next(), to, now)).toBe(false)
    // 6000 in total still covers the 3600 used, but a's share of 3000 is under its 3500.
    expect(shrinksBelowUse(parts, next({ Size: { CPUMillicores: 6000, MemoryBytes: 8000 } }), to, now)).toBe(true)
    // An agent that leaves the placement keeps nothing for what runs on it.
    expect(shrinksBelowUse(parts, next({ Placement: [{ AgentID: "a", AgentName: "a", Units: 4 }] }), to, now)).toBe(true)
    expect(shrinksBelowUse([part({ Groups: 0 })], next({ Size: { CPUMillicores: 1, MemoryBytes: 1 } }), to, now)).toBe(false)
  })

  it("asks for an earlier end only inside the cluster's notice", () => {
    // Ending in an hour: the agent gives its notice first, nothing is held.
    expect(shrinksBelowUse([part()], next({ To: "2026-10-19T13:00:00Z" }), to, now)).toBe(false)
    // Ending sooner than the notice from now cuts the labs without it.
    expect(shrinksBelowUse([part()], next({ To: new Date(now + (SHRINK_NOTICE_MINUTES - 1) * 60_000).toISOString() }), to, now)).toBe(true)
    // A current end already inside the notice: only an end before it counts.
    const soon = new Date(now + 60_000).toISOString()
    expect(shrinksBelowUse([part()], next({ To: soon }), soon, now)).toBe(false)
  })
})
