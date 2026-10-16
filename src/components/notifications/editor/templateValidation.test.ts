import { describe, expect, it } from "vitest"
import { templateFieldError } from "./templateValidation"
describe("template field validation", () => {
  it("reports the unknown names for that field once, keeping supported names valid", () => {
    expect(templateFieldError("{{.Name}} {{.ghost}} {{ghost}} {{other}}", [{ name: "Name" }])).toContain("ghost, other")
    expect(templateFieldError("{{.Name}}", [{ name: "Name" }])).toBe("")
  })
  it("reports unfinished template syntax and required blank fields", () => {
    expect(templateFieldError("{{.Na", [{ name: "Name" }])).not.toBe("")
    expect(templateFieldError("  ", [], true)).not.toBe("")
    expect(templateFieldError("", [])).toBe("")
  })
})
