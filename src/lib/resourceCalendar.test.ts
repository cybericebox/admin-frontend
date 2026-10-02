import { describe, expect, it } from "vitest"
import type { Reservation, Timeline } from "@/api/resourceCalendar"
import { chartThemes } from "@/components/analytics/chartTheme"
import { timelineOption } from "@/components/resources/timelineOption"
import { MIB, amountToText, attentionIDs, buildTimelineModel, rangeFrom, textToAmount } from "./resourceCalendar"

const amount = (cpu: number, mem = 0) => ({ CPUMillicores: cpu, MemoryBytes: mem * MIB })
const at = (hour: number) => `2026-10-05T${String(hour).padStart(2, "0")}:00:00Z`

const reservation = (over: Partial<Reservation>): Reservation => ({
  ID: "r1", Kind: "event", EventID: "e1", EventName: "CTF", EventTag: "ctf", OwnerID: "", From: at(8), To: at(12), Teams: 2,
  PerTeam: amount(500), LargestDevice: amount(100), BufferPercent: 15, Dynamic: amount(0), TailGapMinutes: 60, Size: amount(1000, 2048),
  Placement: null, Unplaced: 0, Covered: true, Used: amount(0), Alarms: null, ...over,
})

const timeline = (over: Partial<Timeline> = {}): Timeline => ({
  From: at(0), To: "2026-10-06T00:00:00Z", SlotMinutes: 15, Reservations: [], Reserved: [], Conflicts: [], MaintenanceReported: false,
  Capacity: { Total: amount(4000, 8192), CPUUnlimited: false, MemoryUnlimited: false, TestPool: amount(250, 512), PerNodeRoomReported: true, Agents: [] },
  ...over,
})

describe("buildTimelineModel", () => {
  it("puts a reservation above the test pool band with its exact height", () => {
    const model = buildTimelineModel(timeline({ Reservations: [reservation({})] }), "cpu")
    expect(model.pool).toBe(250)
    expect(model.bars).toHaveLength(1)
    expect(model.bars[0]).toMatchObject({ y0: 250, y1: 1250, size: 1000, from: Date.parse(at(8)), to: Date.parse(at(12)) })
    expect(model.capacity).toBe(4000)
  })

  it("stacks reservations that overlap in time and reuses the level when they do not", () => {
    const model = buildTimelineModel(timeline({
      Reservations: [
        reservation({ ID: "a", From: at(8), To: at(12), Size: amount(1000) }),
        reservation({ ID: "b", From: at(10), To: at(14), Size: amount(500) }),
        reservation({ ID: "c", From: at(15), To: at(16), Size: amount(700) }),
      ],
    }), "cpu")
    const byID = Object.fromEntries(model.bars.map((bar) => [bar.id, bar]))
    expect(byID.a.y0).toBe(250)
    expect(byID.b.y0).toBe(1250)
    expect(byID.c.y0).toBe(250)
    expect(model.top).toBe(4000)
  })

  it("never lets overlapping rectangles share height", () => {
    const model = buildTimelineModel(timeline({
      Reservations: [
        reservation({ ID: "a", From: at(8), To: at(10), Size: amount(300) }),
        reservation({ ID: "b", From: at(9), To: at(13), Size: amount(300) }),
        reservation({ ID: "c", From: at(11), To: at(14), Size: amount(300) }),
      ],
    }), "cpu")
    for (const x of model.bars) for (const y of model.bars) {
      if (x.id === y.id || x.from >= y.to || y.from >= x.to) continue
      expect(x.y1 <= y.y0 || y.y1 <= x.y0).toBe(true)
    }
  })

  it("reads memory in bytes and skips reservations without size in that resource", () => {
    const model = buildTimelineModel(timeline({ Reservations: [reservation({}), reservation({ ID: "z", Size: amount(500, 0) })] }), "memory")
    expect(model.bars.map((bar) => bar.id)).toEqual(["r1"])
    expect(model.pool).toBe(512 * MIB)
    expect(model.bars[0].y1).toBe(512 * MIB + 2048 * MIB)
  })

  it("flags an unlimited resource and keeps the capacity unknown when no agent reports it", () => {
    const base = timeline()
    const model = buildTimelineModel({ ...base, Capacity: { ...base.Capacity, Total: amount(0, 0), CPUUnlimited: true } }, "cpu")
    expect(model.unlimited).toBe(true)
    expect(model.capacity).toBeNull()
  })

  it("keeps Covered=false and the conflict ranges", () => {
    const model = buildTimelineModel(timeline({
      Reservations: [reservation({ Covered: false })],
      Conflicts: [{ From: at(9), To: at(10), ReservationIDs: ["r1"], PoolShort: true, Unplaced: 0, Short: amount(100) }],
    }), "cpu")
    expect(model.bars[0].covered).toBe(false)
    expect(model.conflicts).toEqual([{ from: Date.parse(at(9)), to: Date.parse(at(10)), poolShort: true }])
  })
})

describe("attentionIDs", () => {
  it("lists uncovered reservations and the ones named in a conflict", () => {
    const ids = attentionIDs(timeline({
      Reservations: [reservation({ ID: "a", Covered: false }), reservation({ ID: "b" }), reservation({ ID: "c" })],
      Conflicts: [{ From: at(9), To: at(10), ReservationIDs: ["b"], PoolShort: false, Unplaced: 1, Short: amount(100) }],
    }))
    expect([...ids].sort()).toEqual(["a", "b"])
  })
})

describe("timelineOption", () => {
  it("draws the capacity line, the pool band, the conflicts and one rectangle per reservation", () => {
    const model = buildTimelineModel(timeline({
      Reservations: [reservation({}), reservation({ ID: "x", Covered: false, From: at(14), To: at(16) })],
      Conflicts: [{ From: at(9), To: at(10), ReservationIDs: null, PoolShort: false, Unplaced: 0, Short: amount(1) }],
    }), "cpu")
    const option = timelineOption(model, "cpu", chartThemes.light, { capacity: "Cap", pool: "Pool", conflict: "Conf", format: String, tooltip: (bar) => bar.label }) as { series: { name: string; data: unknown[]; markLine?: { data: { yAxis: number }[] } }[] }
    const byName = Object.fromEntries(option.series.map((series) => [series.name, series]))
    expect(byName.Pool.data).toHaveLength(1)
    expect(byName.Conf.data).toHaveLength(1)
    expect(byName.reservations.data).toHaveLength(2)
    expect(byName.Cap.markLine?.data).toEqual([{ name: "Cap", yAxis: 4000 }])
  })
})

describe("rangeFrom", () => {
  it("never asks for more than 31 days", () => {
    const { from, to } = rangeFrom(new Date(2026, 9, 5, 15, 30), 90)
    expect((Date.parse(to) - Date.parse(from)) / 86_400_000).toBeGreaterThan(30.9)
    expect((Date.parse(to) - Date.parse(from)) / 86_400_000).toBeLessThan(31.1)
  })
})

describe("amount text", () => {
  it("round-trips CPU millicores and memory MiB, and treats empty as not set", () => {
    expect(textToAmount({ cpu: "", memoryMiB: "" })).toBeNull()
    expect(textToAmount({ cpu: "500", memoryMiB: "256" })).toEqual({ CPUMillicores: 500, MemoryBytes: 256 * MIB })
    expect(amountToText({ CPUMillicores: 500, MemoryBytes: 256 * MIB })).toEqual({ cpu: "500", memoryMiB: "256" })
  })
})
