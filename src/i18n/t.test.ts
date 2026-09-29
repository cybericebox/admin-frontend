import { describe, it, expect } from "vitest"
import { t } from "./t"

describe("t", () => {
  it("returns the active-language string, or the key when unknown", () => {
    expect(t("theme.dark")).not.toBe("theme.dark")
    expect(t("no.such.key")).toBe("no.such.key")
  })

  it("fills {name} placeholders from vars", () => {
    expect(t("no.such.{who}", { who: "x" })).toBe("no.such.x")
    expect(t("{a}/{b}", { a: 1, b: 0 })).toBe("1/0")
  })

  it("keeps {{variable}} tokens and unmatched placeholders", () => {
    expect(t("{{name}} {missing} {x}", { name: "n", x: "y" })).toBe("{{name}} {missing} y")
  })
})
