import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AutosaveQueue, type AutosaveStatus } from "./autosaveQueue"

function deferred() {
  let resolve!: (value: boolean) => void
  const promise = new Promise<boolean>((res) => { resolve = res })
  return { promise, resolve }
}

describe("AutosaveQueue", () => {
  let statuses: AutosaveStatus[]
  beforeEach(() => { vi.useFakeTimers(); statuses = [] })
  afterEach(() => { vi.useRealTimers() })

  function createQueue(save: () => Promise<boolean>, onSaved = vi.fn()) {
    return new AutosaveQueue({ delayMs: 1000, save, onStatus: (status) => statuses.push(status), onSaved })
  }

  it("debounces a burst of changes into one save one second after the last change", async () => {
    const save = vi.fn().mockResolvedValue(true)
    const onSaved = vi.fn()
    const queue = createQueue(save, onSaved)
    queue.markChanged()
    await vi.advanceTimersByTimeAsync(600)
    queue.markChanged()
    await vi.advanceTimersByTimeAsync(999)
    expect(save).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(save).toHaveBeenCalledTimes(1)
    expect(onSaved).toHaveBeenCalledTimes(1)
    expect(statuses.at(-1)).toBe("saved")
    expect(queue.hasUnsaved()).toBe(false)
  })

  it("never overlaps requests and folds changes made in flight into one follow-up", async () => {
    const first = deferred()
    let calls = 0
    let active = 0
    let maxActive = 0
    const save = vi.fn(async () => {
      calls += 1
      active += 1
      maxActive = Math.max(maxActive, active)
      const result = calls === 1 ? await first.promise : true
      active -= 1
      return result
    })
    const queue = createQueue(save)
    queue.markChanged()
    const flushed = queue.flush()
    expect(save).toHaveBeenCalledTimes(1)
    queue.markChanged()
    queue.markChanged()
    queue.markChanged()
    await vi.advanceTimersByTimeAsync(5000)
    expect(save).toHaveBeenCalledTimes(1)
    first.resolve(true)
    await expect(flushed).resolves.toBe(true)
    expect(save).toHaveBeenCalledTimes(2)
    expect(maxActive).toBe(1)
  })

  it("flush sends immediately and resolves true without changes", async () => {
    const save = vi.fn().mockResolvedValue(true)
    const queue = createQueue(save)
    await expect(queue.flush()).resolves.toBe(true)
    expect(save).not.toHaveBeenCalled()
    queue.markChanged()
    await expect(queue.flush()).resolves.toBe(true)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it("reports an error, keeps the changes, and retries on the next flush", async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(true)
    const queue = createQueue(save)
    queue.markChanged()
    await expect(queue.flush()).resolves.toBe(false)
    expect(statuses.at(-1)).toBe("error")
    expect(queue.hasUnsaved()).toBe(true)
    await expect(queue.flush()).resolves.toBe(true)
    expect(save).toHaveBeenCalledTimes(2)
  })

  it("keeps changes pending when there is nothing to persist yet", async () => {
    const save = vi.fn().mockResolvedValue(false)
    const queue = createQueue(save)
    queue.markChanged()
    await expect(queue.flush()).resolves.toBe(false)
    expect(statuses.at(-1)).toBe("idle")
    expect(queue.hasUnsaved()).toBe(true)
  })

  it("discard drops pending changes and the timer", async () => {
    const save = vi.fn().mockResolvedValue(true)
    const queue = createQueue(save)
    queue.markChanged()
    queue.discard()
    await vi.advanceTimersByTimeAsync(2000)
    expect(save).not.toHaveBeenCalled()
    expect(queue.hasUnsaved()).toBe(false)
  })
})
