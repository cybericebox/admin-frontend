import { afterEach, describe, expect, it, vi } from "vitest"
import { getPreviewSettings } from "./participantPreviewSettings"

afterEach(() => vi.restoreAllMocks())

describe("getPreviewSettings", () => {
  it("reads an empty answer as nothing selected", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ Data: {} }), { headers: { "Content-Type": "application/json" } }))
    expect(await getPreviewSettings()).toMatchObject({ Selections: [], EffectiveSelections: [], GroupName: "" })
  })
})
