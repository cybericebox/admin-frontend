import { afterEach, describe, expect, it, vi } from "vitest"
import { getEventAnalyticsUsage } from "./analytics"

afterEach(() => vi.unstubAllGlobals())

const at = "2026-10-07T10:00:00Z"
const user = {
  UserID: "participant", UserName: "Ann", TeamID: "team", TeamName: "Blue", LastSeenAt: null, LastLabAt: null,
  VPN: { Online: false, LastHandshakeAt: null, FirstAt: null, Sessions: 0, Seconds: 0, RxBytes: 0, TxBytes: 0, Recent: [] },
  Proxy: { Requests: 0, BytesIn: 0, BytesOut: 0, FirstAt: null, LastAt: null },
}
const lab = { ChallengeID: "challenge", Task: "Lab", Surface: "vpn", Attempts: 0, BytesIn: 20, BytesOut: 10, FirstAt: null, LastAt: null }

function serve(labs: unknown[]) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
    Status: { Code: 0 }, Data: { Available: true, At: at, Summary: {}, Users: [{ ...user, Labs: labs }] },
  }), { status: 200, headers: { "Content-Type": "application/json" } })))
}

describe("getEventAnalyticsUsage lab traffic contract", () => {
  it("preserves lab-only counters and absent participant action dates from the backend", async () => {
    serve([{ ...lab, LabInitiatedAttempts: 7 }])
    const usage = await getEventAnalyticsUsage("event")
    expect(usage.Users[0].Labs[0]).toMatchObject({ Attempts: 0, LabInitiatedAttempts: 7, FirstAt: null, LastAt: null })
    expect(usage.Users[0].VPN.Online).toBe(false)
    expect(usage.Users[0].LastLabAt).toBeNull()
  })

  it("defaults the absent additive counter from an older backend to zero", async () => {
    serve([{ ...lab, Attempts: 3, FirstAt: at, LastAt: at }])
    const usage = await getEventAnalyticsUsage("event")
    expect(usage.Users[0].Labs[0]).toMatchObject({ Attempts: 3, LabInitiatedAttempts: 0, FirstAt: at, LastAt: at })
  })
})
