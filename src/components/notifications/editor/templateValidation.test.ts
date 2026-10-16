import { describe, expect, it } from "vitest"
import { templateFieldError } from "./templateValidation"
describe("template field validation", () => {
  it("reports the unknown names for that field once, keeping supported names valid", () => {
    expect(templateFieldError("{{.Name}} {{.ghost}} {{ghost}} {{other}}", [{ name: "Name" }])).toContain("ghost, other")
    expect(templateFieldError("{{.Name}}", [{ name: "Name" }])).toBe("")
  })
  it("accepts ordinary Lexical structure without treating JSON braces as template syntax", () => {
    const blocks = [{ type: "rich_text", content: { root: { children: [{ type: "paragraph", children: [{ type: "text", text: "Welcome" }] }] } } }]
    expect(templateFieldError(blocks, [{ name: "Name" }])).toBe("")
  })
  it("reports a stored Lexical variable node even when there is no literal token", () => {
    const blocks = [{ type: "rich_text", content: { root: { children: [{ type: "paragraph", children: [{ type: "variable", varName: "Name" }, { type: "variable", varName: "ghost" }] }] } } }]
    expect(templateFieldError(blocks, [{ name: "Name" }])).toContain("ghost")
    expect(templateFieldError(blocks, [{ name: "Name" }])).not.toContain("«Name»")
  })
  it("reports unfinished template syntax and required blank fields", () => {
    expect(templateFieldError("{{.Na", [{ name: "Name" }])).not.toBe("")
    expect(templateFieldError("  ", [], true)).not.toBe("")
    expect(templateFieldError("", [])).toBe("")
  })
})
