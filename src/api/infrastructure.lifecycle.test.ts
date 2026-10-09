import { afterEach, describe, expect, it, vi } from "vitest"
import { getStandDetail, getTestLabDetail, resetStandDevice, rescueStandDevice } from "./infrastructure"
import { getStats } from "./resourceCalendar"
import { allocation, managedGroup, managedLab, resourceObservation } from "@/test/labLifecycle"

afterEach(() => vi.unstubAllGlobals())

const live = {
  Phase: "Ready", Ready: true, Queue: null, ImageWarning: "", GroupImageWarning: "",
  Devices: [{ Name: "web", Type: "container", LogicalName: "web", Ready: true, Reason: "", Scheduling: null, Snapshot: null }],
}
const legacyRow = { ChallengeID: "question-1", ChallengeName: "First objective", Status: "ready", Reason: "", Live: live, LiveUnavailable: false }
const legacyDetail = {
  TeamID: managedLab.TeamID, TeamName: "Blue", Moderators: false, Status: "ready", Reason: "",
  Generation: 1, LaboratoriesAvailable: true, Labs: [legacyRow],
}
const questions = [
  { EventChallengeID: "00000000-0000-4000-8000-000000000401", Name: "First objective" },
  { EventChallengeID: "00000000-0000-4000-8000-000000000402", Name: "Second objective" },
]
const stats = { At: "2026-10-08T12:00:00Z", Agents: null, Events: null, TestPool: { CPUMillicores: 250, MemoryBytes: 104857600 }, TestLabsHeld: { CPUMillicores: 0, MemoryBytes: 0 }, PendingChangeRequests: 0, OpenAlarms: 0 }

function serve(data: unknown) {
  const fetch = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ Status: { Code: 0 }, Data: data }), {
    status: 200, headers: { "Content-Type": "application/json" },
  }))
  vi.stubGlobal("fetch", fetch)
  return fetch
}

describe("stand lifecycle transport", () => {
  it.each([undefined, null])("normalizes missing legacy observations (%j) without physical-state assumptions", async (missing) => {
    serve({ ...legacyDetail, Group: missing, Labs: [{ ...legacyRow, Lab: missing, Questions: missing }] })
    const detail = await getStandDetail("event", managedLab.TeamID)
    expect(detail.Group).toBeNull()
    expect(detail.Labs[0].Lab).toBeNull()
    expect(detail.Labs[0].Questions).toEqual([])
    expect(detail.Labs[0].Live).toEqual(live)
    expect(detail.Status).toBe("ready")
  })

  it("preserves one canonical shared lab row with both questions and one live block", async () => {
    const fetch = serve({ ...legacyDetail, Group: managedGroup, Labs: [{ ...legacyRow, ChallengeID: questions[0].EventChallengeID, Lab: managedLab, Questions: questions }] })
    const detail = await getStandDetail("event/name", "team/name")
    expect(fetch.mock.calls[0][0]).toEqual(expect.stringContaining("/api/infrastructure/stands/event%2Fname/team%2Fname/detail"))
    expect(detail.Group).toEqual(managedGroup)
    expect(detail.Labs).toHaveLength(1)
    expect(detail.Labs[0].Questions).toEqual(questions)
    expect(detail.Labs[0].Live).toEqual(live)
    expect(detail.Labs[0].Lab?.Resources.SnapshotQuotaBytes).toBe("9007199254740993")
    expect(detail.Labs[0].Lab?.ActualState).toBe("StopFailed")
  })

  it("retains an explicit unknown resource state and unavailable live block", async () => {
    serve({ ...legacyDetail, Labs: [{ ...legacyRow, Live: null, LiveUnavailable: true, Lab: { ...managedLab, ActualState: "Unknown", Resources: { ...allocation, RuntimeState: "Unknown", UsageAvailable: false } } }] })
    const detail = await getStandDetail("event", "team")
    expect(detail.Labs[0].Lab?.Resources.RuntimeState).toBe("Unknown")
    expect(detail.Labs[0].Lab?.Resources.AllocatedRequests.CPUMillicores).toBe("250")
    expect(detail.Labs[0].Live).toBeNull()
    expect(detail.Labs[0].LiveUnavailable).toBe(true)
  })

  it.each([{}, false, 0, "", { ...managedGroup, Revision: 12 }])("rejects a malformed present group %j", async (Group) => {
    serve({ ...legacyDetail, Group })
    await expect(getStandDetail("event", "team")).rejects.toThrow()
  })

  it.each([{}, false, 0, "", { ...managedLab, Resources: { ...allocation, SnapshotQuotaBytes: 9007199254740992 } }])("rejects a malformed present lab %j", async (Lab) => {
    serve({ ...legacyDetail, Labs: [{ ...legacyRow, Lab }] })
    await expect(getStandDetail("event", "team")).rejects.toThrow()
  })

  it.each([{}, false, "", [{ EventChallengeID: questions[0].EventChallengeID }]])("rejects malformed present questions %j", async (Questions) => {
    serve({ ...legacyDetail, Labs: [{ ...legacyRow, Questions }] })
    await expect(getStandDetail("event", "team")).rejects.toThrow()
  })

  it("keeps author test-environment details on their existing contract", async () => {
    serve({ ID: "test-lab", GroupName: "test-group", Status: "ready", Live: live })
    expect(await getTestLabDetail("test-lab")).toEqual({ ID: "test-lab", GroupName: "test-group", Status: "ready", Live: live })
  })

  it("keeps representative-question device endpoints and request bodies", async () => {
    const fetch = serve({})
    await resetStandDevice("event/name", "team/name", "question/name", "web/name")
    await rescueStandDevice("event/name", "team/name", "question/name", "web/name", true)
    expect(fetch.mock.calls[0][0]).toEqual(expect.stringContaining("/stands/event%2Fname/team%2Fname/challenges/question%2Fname/devices/web%2Fname/reset"))
    expect(fetch.mock.calls[0][1]).toMatchObject({ method: "POST", body: "{}" })
    expect(fetch.mock.calls[1][0]).toEqual(expect.stringContaining("/challenges/question%2Fname/devices/web%2Fname/rescue"))
    expect(fetch.mock.calls[1][1]).toMatchObject({ method: "POST", body: '{"Enable":true}' })
  })
})

describe("aggregate observation transport", () => {
  it.each([undefined, null])("keeps missing aggregate observations (%j) unknown and legacy amounts numeric", async (Observation) => {
    serve({ ...stats, Observation })
    const result = await getStats()
    expect(result.Observation).toBeNull()
    expect(result.TestPool).toEqual({ CPUMillicores: 250, MemoryBytes: 104857600 })
  })

  it("keeps producer aggregate totals exact without adding included group services or pending starts", async () => {
    serve({ ...stats, Observation: resourceObservation })
    const result = await getStats()
    expect(result.Observation).toEqual(resourceObservation)
    expect(result.Observation?.Held.CPUMillicores).toBe("325")
    expect(result.Observation?.Held.SnapshotQuotaBytes).toBe("9007199254740993")
    expect(result.Observation?.Complete).toBe(false)
  })

  it.each([{}, false, 0, "", { ...resourceObservation, Held: { ...resourceObservation.Held, MemoryBytes: 138412032 } }])("rejects a malformed present aggregate observation %j", async (Observation) => {
    serve({ ...stats, Observation })
    await expect(getStats()).rejects.toThrow()
  })
})
