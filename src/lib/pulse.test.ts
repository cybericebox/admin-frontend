import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Pulse } from "@/api/notifications/pulse"

const service = vi.hoisted(() => ({ restored: new Set<() => void>() }))
vi.mock("@/api/notifications/pulse", () => ({ fetchPulse: vi.fn() }))
vi.mock("@/lib/serviceStatus", () => ({ onServiceRestored: (l: () => void) => { service.restored.add(l); return () => service.restored.delete(l) } }))

import { PULSE_INTERVAL_MS, PULSE_JITTER, createPulseLoop, pulseDelay } from "./pulse"

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state })
}
const pulseOf = (banners = "1"): Pulse => ({ Banners: banners, Inbox: { Cursor: "c", Unread: 0 } })
async function flush() { await vi.advanceTimersByTimeAsync(0) }

describe("pulse delay", () => {
  it("is 30 s with +-20 % jitter", () => {
    expect(pulseDelay(() => 0.5)).toBe(PULSE_INTERVAL_MS)
    expect(pulseDelay(() => 0)).toBe(PULSE_INTERVAL_MS * (1 - PULSE_JITTER))
    expect(pulseDelay(() => 1)).toBe(PULSE_INTERVAL_MS * (1 + PULSE_JITTER))
  })
})

describe("pulse loop", () => {
  const fetchOnce = vi.fn()
  const stops: Array<() => void> = []
  const subscribe = (loop: ReturnType<typeof createPulseLoop>, listener: () => void) => { const stop = loop.subscribe(listener); stops.push(stop); return stop }
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(Math, "random").mockReturnValue(0.5)
    setVisibility("visible")
    fetchOnce.mockReset()
    fetchOnce.mockResolvedValue(pulseOf())
    service.restored.clear()
  })
  afterEach(() => { stops.splice(0).forEach((stop) => stop()); vi.useRealTimers(); vi.restoreAllMocks(); setVisibility("visible") })

  it("pulses at once, then every interval with jitter, and shares one request between listeners", async () => {
    const loop = createPulseLoop(fetchOnce)
    const a = vi.fn(), b = vi.fn()
    const stopA = subscribe(loop, a)
    subscribe(loop, b)
    await flush()
    expect(fetchOnce).toHaveBeenCalledTimes(1)
    expect(a).toHaveBeenCalledWith(pulseOf())
    expect(b).toHaveBeenCalledWith(pulseOf())
    await vi.advanceTimersByTimeAsync(PULSE_INTERVAL_MS - 1)
    expect(fetchOnce).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(fetchOnce).toHaveBeenCalledTimes(2)
    stopA()
  })

  it("uses the jittered delay", async () => {
    vi.mocked(Math.random).mockReturnValue(0)
    const loop = createPulseLoop(fetchOnce)
    subscribe(loop, vi.fn())
    await flush()
    await vi.advanceTimersByTimeAsync(PULSE_INTERVAL_MS * (1 - PULSE_JITTER) - 1)
    expect(fetchOnce).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(fetchOnce).toHaveBeenCalledTimes(2)
  })

  it("pauses while hidden and pulses at once when visible again", async () => {
    const loop = createPulseLoop(fetchOnce)
    subscribe(loop, vi.fn())
    await flush()
    setVisibility("hidden")
    document.dispatchEvent(new Event("visibilitychange"))
    await vi.advanceTimersByTimeAsync(PULSE_INTERVAL_MS * 3)
    expect(fetchOnce).toHaveBeenCalledTimes(1)
    setVisibility("visible")
    document.dispatchEvent(new Event("visibilitychange"))
    await flush()
    expect(fetchOnce).toHaveBeenCalledTimes(2)
  })

  it("pulses on focus and online at most once per 5 s", async () => {
    const loop = createPulseLoop(fetchOnce)
    subscribe(loop, vi.fn())
    await flush()
    window.dispatchEvent(new Event("focus"))
    window.dispatchEvent(new Event("online"))
    await flush()
    expect(fetchOnce).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(5_000)
    window.dispatchEvent(new Event("focus"))
    await flush()
    expect(fetchOnce).toHaveBeenCalledTimes(2)
    window.dispatchEvent(new Event("online"))
    await flush()
    expect(fetchOnce).toHaveBeenCalledTimes(2)
  })

  it("pulses once at once when the API is restored", async () => {
    const loop = createPulseLoop(fetchOnce)
    subscribe(loop, vi.fn())
    await flush()
    service.restored.forEach((listener) => listener())
    await flush()
    expect(fetchOnce).toHaveBeenCalledTimes(2)
  })

  it("keeps going after a failed pulse and stops when the last listener leaves", async () => {
    fetchOnce.mockRejectedValueOnce(new Error("down"))
    const loop = createPulseLoop(fetchOnce)
    const stop = subscribe(loop, vi.fn())
    await flush()
    await vi.advanceTimersByTimeAsync(PULSE_INTERVAL_MS)
    expect(fetchOnce).toHaveBeenCalledTimes(2)
    stop()
    await vi.advanceTimersByTimeAsync(PULSE_INTERVAL_MS * 3)
    expect(fetchOnce).toHaveBeenCalledTimes(2)
  })
})
