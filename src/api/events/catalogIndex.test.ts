import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock("@/api/client", () => ({ apiGet: mocks.get, apiPost: vi.fn(), apiPut: vi.fn(), apiDelete: vi.fn() }))
import { eventFilterParams, getEvent, listEventsIndex } from "./catalog"

describe("the events index API", () => {
  beforeEach(() => mocks.get.mockReset())

  it("sends one status, the start period (the end day inclusive), one organizer and the infrastructure flag", () => {
    const p = eventFilterParams({
      status: { op: "in", v: ["started"] },
      period: { op: "between", v: ["2026-11-01", "2026-11-30"] },
      organizer: { op: "in", v: ["u1"] },
      infrastructure: { op: "is", v: ["true"] },
    })
    expect(p.get("status")).toBe("started")
    expect(new Date(p.get("startFrom")!).getTime()).toBe(new Date("2026-11-01T00:00:00").getTime())
    expect(new Date(p.get("startTo")!).getTime()).toBe(new Date("2026-12-01T00:00:00").getTime())
    expect(p.get("organizer")).toBe("u1")
    expect(p.get("infrastructure")).toBe("true")
    expect(eventFilterParams({}).toString()).toBe("")
  })

  it("flattens the Counts object onto the row and keeps StartAt / FinishAt", async () => {
    mocks.get.mockResolvedValue({ Items: [{ ID: "e1", Counts: { Participants: 4, Teams: 2, StandsReady: 1, StandsTotal: 2 }, StartAt: "2026-11-01T09:00:00Z", FinishAt: null, ArchiveAt: null }], Total: 1 })
    const page = await listEventsIndex({ search: "", bag: {}, page: 1, pageSize: 50, sortBy: "stands", sortDir: "desc" })
    expect(page.Items[0]).toMatchObject({ ParticipantsCount: 4, TeamsCount: 2, StandsReady: 1, StandsTotal: 2, StartAt: "2026-11-01T09:00:00Z" })
    expect(mocks.get.mock.calls[0][0]).toContain("sortBy=stands")
  })

  it("reads the same counts on the card", async () => {
    mocks.get.mockResolvedValue({ ID: "e1", Counts: { Participants: 9 }, ArchiveAt: null })
    expect(await getEvent("e1")).toMatchObject({ ParticipantsCount: 9 })
  })
})
