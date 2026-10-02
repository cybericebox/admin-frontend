import { describe, expect, it, vi } from "vitest"
import type { ErrorGroup } from "@/api/errorJournal"
import { createStatusQueue } from "./statusQueue"

const group = (status: ErrorGroup["Status"]): ErrorGroup => ({ ID: "g", Kind: "job", Source: "", Title: "t", Status: status, Occurrences: 1, FirstSeenAt: "", LastSeenAt: "", ResolvedAt: null, LastNotifiedAt: null })
const deferred = () => { let resolve!: (g: ErrorGroup) => void; let reject!: (e: unknown) => void; const promise = new Promise<ErrorGroup>((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }

describe("status queue", () => {
  it("shows the choice before the server answers and does not block a second change", async () => {
    const first = deferred(), second = deferred()
    const patch = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const hooks = { patch, optimistic: vi.fn(), confirmed: vi.fn(), failed: vi.fn() }
    const queue = createStatusQueue(hooks)
    queue.set("g", "open", "resolved")
    queue.set("g", "resolved", "ignored")
    expect(hooks.optimistic.mock.calls).toEqual([["g", "resolved"], ["g", "ignored"]])
    await vi.waitFor(() => expect(patch).toHaveBeenCalledTimes(1))
    await Promise.resolve()
    expect(patch).toHaveBeenCalledTimes(1) // saved one after another, never concurrently
    first.resolve(group("resolved"))
    await vi.waitFor(() => expect(patch).toHaveBeenCalledTimes(2))
    expect(hooks.confirmed).not.toHaveBeenCalled() // a newer change is waiting: the older answer is not applied
    second.resolve(group("ignored"))
    await vi.waitFor(() => expect(hooks.confirmed).toHaveBeenCalledWith(group("ignored")))
    expect(hooks.confirmed).toHaveBeenCalledTimes(1)
  })

  it("rolls back to the last confirmed status when the save fails", async () => {
    const hooks = { patch: vi.fn().mockRejectedValue(new Error("boom")), optimistic: vi.fn(), confirmed: vi.fn(), failed: vi.fn() }
    createStatusQueue(hooks).set("g", "open", "ignored")
    await vi.waitFor(() => expect(hooks.failed).toHaveBeenCalledWith("g", "open", expect.any(Error)))
    expect(hooks.confirmed).not.toHaveBeenCalled()
  })

  it("keeps a failed change from undoing a later one that is still waiting", async () => {
    const first = deferred(), second = deferred()
    const hooks = { patch: vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise), optimistic: vi.fn(), confirmed: vi.fn(), failed: vi.fn() }
    const queue = createStatusQueue(hooks)
    queue.set("g", "open", "resolved")
    queue.set("g", "resolved", "ignored")
    first.reject(new Error("boom"))
    await vi.waitFor(() => expect(hooks.patch).toHaveBeenCalledTimes(2))
    expect(hooks.failed).not.toHaveBeenCalled()
    second.resolve(group("ignored"))
    await vi.waitFor(() => expect(hooks.confirmed).toHaveBeenCalled())
  })
})
