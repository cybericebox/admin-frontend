import { describe, expect, it } from "vitest"
import { columnsMenuList, columnWidth, insertionIndex, moveCol, moveColBy, normalizeCols, toggleCol } from "./columns"

const all = ["user", "email", "role", "status"]
describe("table columns", () => {
  it("keeps the identity first and drops unknown and repeated keys", () => {
    expect(normalizeCols(["role", "x", "role", "user", "email"], all, "user")).toEqual(["user", "role", "email"])
    expect(normalizeCols(undefined, all, "user")).toEqual(["user"])
  })
  it("never moves or hides the identity and never places anything before it", () => {
    const cols = ["user", "email", "role"]
    expect(moveCol(cols, "user", 2, "user")).toBe(cols)
    expect(moveCol(cols, "role", 0, "user")).toEqual(["user", "role", "email"])
    expect(toggleCol(cols, "user", "user")).toBe(cols)
    expect(moveColBy(cols, "email", -1, "user")).toBe(cols)
    expect(moveColBy(cols, "email", 1, "user")).toEqual(["user", "role", "email"])
  })
  it("toggles a column: hide drops it, show appends it", () => {
    expect(toggleCol(["user", "email"], "email", "user")).toEqual(["user"])
    expect(toggleCol(["user"], "role", "user")).toEqual(["user", "role"])
  })
  it("lists shown columns in order, then the hidden ones", () => {
    expect(columnsMenuList(["user", "role"], all, "user").map((e) => `${e.key}${e.on ? "+" : "-"}`)).toEqual(["user+", "role+", "email-", "status-"])
  })
  it("finds the drop place from the pointer and never before the identity", () => {
    const rects = [{ top: 0, bottom: 10 }, { top: 10, bottom: 20 }, { top: 20, bottom: 30 }]
    expect(insertionIndex(rects, 1)).toBe(1)
    expect(insertionIndex(rects, 17)).toBe(2)
    expect(insertionIndex(rects, 99)).toBe(3)
  })
  it("draws a column at the dragged width, else the configured one, within the range", () => {
    expect(columnWidth(200, 300)).toBe(300)
    expect(columnWidth(200, undefined)).toBe(200)
    expect(columnWidth(undefined, undefined)).toBe(160)
    expect(columnWidth(undefined, 10)).toBe(80)
  })
})
