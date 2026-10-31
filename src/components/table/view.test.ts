import { describe, expect, it } from "vitest"
import { fromPrefs, toPrefs } from "./view"

const all = ["user", "email", "role", "status"]
describe("the view as server prefs", () => {
  it("writes the shown order, the hidden keys, widths, sort and page size", () => {
    expect(toPrefs({ cols: ["user", "role"], widths: { role: 220 }, sort: "name", dir: "desc", size: "25" }, all, "user", all)).toEqual({
      ColumnOrder: ["user", "role"], Hidden: ["email", "status"], ColumnWidths: { role: 220 }, Sort: { Key: "name", Dir: "desc" }, PageSize: 25,
    })
    expect(toPrefs({}, all, "user", all)).toMatchObject({ ColumnOrder: all, Hidden: [], Sort: null, PageSize: 0 })
  })
  it("reads prefs back, keeping the identity first and showing a new column at the end", () => {
    const view = fromPrefs({ ColumnOrder: ["role", "user"], Hidden: ["status"], Sort: { Key: "role", Dir: "asc" }, PageSize: 100 }, [...all, "created"], "user")
    expect(view.cols).toEqual(["user", "role", "email", "created"])
    expect(view.sort).toBe("role")
    expect(view.size).toBe("100")
  })
})
