/**
 * signalDefaults.test.ts — TDD RED→GREEN for the platform signal-defaults API module.
 *
 * vi.mock('@/api/client') intercepts apiGet/apiPut. Paths match the settings
 * handler's Init routes: GET/PUT /api/notifications/signal-defaults.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/api/client")

import * as client from "@/api/client"
import { listSignalDefaults, updateSignalDefault, type SignalDefault } from "./signalDefaults"

const mockApiGet = vi.mocked(client.apiGet)
const mockApiPut = vi.mocked(client.apiPut)

const item: SignalDefault = {
  SignalType: "participant.enrolled",
  Channel: "email",
  Enabled: false,
  Audience: { kind: "signal_subject" },
}

describe("listSignalDefaults", () => {
  beforeEach(() => vi.clearAllMocks())

  it("calls apiGet with the signal-defaults path", async () => {
    mockApiGet.mockResolvedValue([item])
    const result = await listSignalDefaults()
    expect(mockApiGet).toHaveBeenCalledWith("/api/notifications/signal-defaults")
    expect(result).toEqual([item])
  })
})

describe("updateSignalDefault", () => {
  beforeEach(() => vi.clearAllMocks())

  it("calls apiPut with the signal-defaults path and the given item", async () => {
    const updated = { ...item, Enabled: true }
    mockApiPut.mockResolvedValue(updated)
    const result = await updateSignalDefault(updated)
    expect(mockApiPut).toHaveBeenCalledWith("/api/notifications/signal-defaults", updated)
    expect(result).toEqual(updated)
  })
})
