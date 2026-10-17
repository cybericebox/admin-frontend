import { beforeEach, describe, expect, it, vi } from "vitest"

const get = vi.fn()
const put = vi.fn()
const del = vi.fn()
vi.mock("@/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/client")>()),
  apiGet: (path: string) => get(path),
  apiPut: (path: string, body: unknown) => put(path, body),
  apiDelete: (path: string) => del(path),
}))

import { getLimitSettings, resetLimitSettings, saveLimitSettings } from "./platformLimits"

const view = { Custom: false, UpdatedAt: null, Fields: [] }

describe("platform limits API", () => {
  beforeEach(() => { get.mockReset().mockResolvedValue(view); put.mockReset().mockResolvedValue(view); del.mockReset().mockResolvedValue(view) })

  it.each(["retention", "archive-limits", "test-runs"] as const)("reads, saves and resets /api/settings/%s", async (card) => {
    await expect(getLimitSettings(card)).resolves.toBe(view)
    expect(get).toHaveBeenCalledWith(`/api/settings/${card}`)
    await saveLimitSettings(card, { A: 3600, B: 7200 })
    expect(put).toHaveBeenCalledWith(`/api/settings/${card}`, { Values: { A: 3600, B: 7200 } })
    await resetLimitSettings(card)
    expect(del).toHaveBeenCalledWith(`/api/settings/${card}`)
  })
})
