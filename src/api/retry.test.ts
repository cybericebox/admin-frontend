import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ApiError } from "./client"
import { fetchWithOverloadRetry, isOverloadError, retryDelayMs } from "./retry"

const answer = (status: number, headers: Record<string, string> = {}) => new Response(status === 200 ? "ok" : "", { status, headers })

/** A doFetch mock that answers with `statuses` in order (the last one repeats). */
function answers(...statuses: Array<number | Response>) {
  let call = 0
  return vi.fn(async () => {
    const next = statuses[Math.min(call++, statuses.length - 1)]
    return typeof next === "number" ? answer(next) : next
  })
}

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe("retryDelayMs", () => {
  it("backs off exponentially with jitter, capped at 4 s", () => {
    expect(retryDelayMs(0, null, () => 1)).toBe(500)
    expect(retryDelayMs(0, null, () => 0)).toBe(250)
    expect(retryDelayMs(2, null, () => 1)).toBe(2000)
    expect(retryDelayMs(5, null, () => 1)).toBe(4000)
  })

  it("takes Retry-After seconds and refuses waits above 10 s", () => {
    expect(retryDelayMs(0, "2")).toBe(2000)
    expect(retryDelayMs(0, "10")).toBe(10_000)
    expect(retryDelayMs(0, "30")).toBeNull()
  })

  it("takes a Retry-After HTTP-date", () => {
    vi.setSystemTime(new Date("2026-10-18T12:00:00Z"))
    expect(retryDelayMs(0, "Sun, 18 Oct 2026 12:00:03 GMT")).toBe(3000)
    expect(retryDelayMs(0, "Sun, 18 Oct 2026 11:59:00 GMT")).toBe(0)
    expect(retryDelayMs(0, "Sun, 18 Oct 2026 12:01:00 GMT")).toBeNull()
  })

  it("falls back to backoff on an unparseable Retry-After", () => {
    expect(retryDelayMs(1, "soon", () => 1)).toBe(1000)
  })
})

describe("fetchWithOverloadRetry", () => {
  it("retries a GET 503 and returns the 200", async () => {
    const doFetch = answers(503, 200)
    const result = fetchWithOverloadRetry(doFetch, { method: "GET" })
    await vi.runAllTimersAsync()
    expect((await result).status).toBe(200)
    expect(doFetch).toHaveBeenCalledTimes(2)
  })

  it("retries a GET 429 too", async () => {
    const doFetch = answers(429, 200)
    const result = fetchWithOverloadRetry(doFetch, { method: "get" })
    await vi.runAllTimersAsync()
    expect((await result).status).toBe(200)
  })

  it("waits the Retry-After seconds before the next try", async () => {
    const doFetch = answers(answer(503, { "Retry-After": "2" }), 200)
    const result = fetchWithOverloadRetry(doFetch, { method: "GET" })
    await vi.advanceTimersByTimeAsync(1999)
    expect(doFetch).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(doFetch).toHaveBeenCalledTimes(2)
    expect((await result).status).toBe(200)
  })

  it("waits until a Retry-After HTTP-date", async () => {
    vi.setSystemTime(new Date("2026-10-18T12:00:00Z"))
    const doFetch = answers(answer(503, { "Retry-After": "Sun, 18 Oct 2026 12:00:03 GMT" }), 200)
    const result = fetchWithOverloadRetry(doFetch, { method: "GET" })
    await vi.advanceTimersByTimeAsync(2999)
    expect(doFetch).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect((await result).status).toBe(200)
  })

  it("does not retry when Retry-After is above 10 s", async () => {
    const doFetch = answers(answer(503, { "Retry-After": "30" }), 200)
    const result = await fetchWithOverloadRetry(doFetch, { method: "GET" })
    expect(result.status).toBe(503)
    expect(doFetch).toHaveBeenCalledTimes(1)
  })

  it.each(["POST", "PUT", "PATCH", "DELETE"])("never repeats a %s", async (method) => {
    const doFetch = answers(503, 200)
    const result = await fetchWithOverloadRetry(doFetch, { method })
    expect(result.status).toBe(503)
    expect(doFetch).toHaveBeenCalledTimes(1)
  })

  it.each([500, 502, 504, 404])("does not retry a GET %i", async (status) => {
    const doFetch = answers(status, 200)
    expect((await fetchWithOverloadRetry(doFetch, { method: "GET" })).status).toBe(status)
    expect(doFetch).toHaveBeenCalledTimes(1)
  })

  it("gives up after 4 tries and returns the last 503", async () => {
    const last = answer(503)
    const doFetch = answers(503, 503, 503, last, 200)
    const result = fetchWithOverloadRetry(doFetch, { method: "GET" })
    await vi.runAllTimersAsync()
    expect(await result).toBe(last)
    expect(doFetch).toHaveBeenCalledTimes(4)
  })

  it("rejects with the AbortError when aborted during the wait and sends nothing more", async () => {
    const controller = new AbortController()
    const doFetch = answers(503, 200)
    const result = fetchWithOverloadRetry(doFetch, { method: "GET", signal: controller.signal })
    const settled = expect(result).rejects.toMatchObject({ name: "AbortError" })
    await vi.advanceTimersByTimeAsync(100)
    controller.abort()
    await settled
    await vi.runAllTimersAsync()
    expect(doFetch).toHaveBeenCalledTimes(1)
  })

  it("uses the given sleep", async () => {
    const sleep = vi.fn(async () => undefined)
    const doFetch = answers(answer(429, { "Retry-After": "1" }), 200)
    expect((await fetchWithOverloadRetry(doFetch, { method: "GET", sleep })).status).toBe(200)
    expect(sleep).toHaveBeenCalledWith(1000, undefined)
  })
})

describe("isOverloadError", () => {
  it("is true only for an API 429 or 503", () => {
    expect(isOverloadError(new ApiError(503, null))).toBe(true)
    expect(isOverloadError(new ApiError(429, null))).toBe(true)
    expect(isOverloadError(new ApiError(500, null))).toBe(false)
    expect(isOverloadError(new Error("503"))).toBe(false)
    expect(isOverloadError(null)).toBe(false)
  })
})
