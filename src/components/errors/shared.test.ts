import { describe, expect, it } from "vitest"
import { kindLabel } from "./shared"

describe("error kind label", () => {
  it("names a known kind and falls back to «Інше (kind)» for a kind the catalog does not know", () => {
    expect(kindLabel("panic")).toBe("Паніка")
    expect(kindLabel("brand_new_kind")).toBe("Інше (brand_new_kind)")
  })
})
