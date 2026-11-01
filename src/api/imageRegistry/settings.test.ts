import { afterEach, describe, expect, it, vi } from "vitest"
import { getImageRegistrySettings } from "./settings"

afterEach(() => vi.restoreAllMocks())

describe("getImageRegistrySettings", () => {
  it.each([{}, { Configured: false }])("reads %j as not configured, with every field present", async (data) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ Data: data }), { headers: { "Content-Type": "application/json" } }))
    const settings = await getImageRegistrySettings()
    expect(settings).toMatchObject({ Configured: false, Account: "", Repository: "", PushTokenSet: false })
    expect(settings.PushCheck.State).toBe("")
  })
})
