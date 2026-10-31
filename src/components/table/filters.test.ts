import { describe, expect, it } from "vitest"
import { bagFromUrl, bagSignature, chipParts, isComplete, orderFacetOptions, parseCond, serializeCond, withoutKey, type FilterDef } from "./filters"

const role: FilterDef = { key: "role", label: "Role", type: "choice", options: [{ value: "admin", label: "Admin" }, { value: "user", label: "User" }, { value: "x", label: "X" }], ops: ["in"] }
const bool: FilterDef = { key: "confirmed", label: "Confirmed", type: "boolean" }
const labels = (op: string) => op
describe("table filters", () => {
  it("round-trips a condition through the address form", () => {
    const cond = { op: "in" as const, v: ["a b", "c,d"] }
    expect(parseCond(serializeCond(cond), { ...role, ops: ["in"] })).toEqual(cond)
    expect(serializeCond({ op: "in", v: [] })).toBe("")
  })
  it("ignores an operator the page does not offer and incomplete conditions", () => {
    expect(parseCond("contains:x", role)).toBeUndefined()
    expect(parseCond("in:", role)).toBeUndefined()
    expect(isComplete({ op: "empty", v: [] })).toBe(true)
    expect(isComplete({ op: "in", v: [" "] })).toBe(false)
  })
  it("reads the bag from the f.<key> values and signs it stably", () => {
    const bag = bagFromUrl({ "f.role": "in:admin,user", "f.confirmed": "is:true", "f.other": "in:1" }, [role, bool])
    expect(Object.keys(bag).sort()).toEqual(["confirmed", "role"])
    expect(bagSignature(bag)).toBe("confirmed=is:true&role=in:admin,user")
    expect(Object.keys(withoutKey(bag, "role"))).toEqual(["confirmed"])
  })
  it("writes a chip in three parts", () => {
    expect(chipParts(role, { op: "in", v: ["admin"] }, labels, "Yes", "No", "any")).toEqual({ key: "Role", op: "is", value: "Admin" })
    expect(chipParts(role, { op: "in", v: ["admin", "user", "x"] }, labels, "Yes", "No", "any").value).toBe("Admin, User +1")
    expect(chipParts(bool, { op: "is", v: ["true"] }, labels, "Yes", "No", "any").value).toBe("Yes")
    expect(chipParts(role, undefined, labels, "Yes", "No", "any").value).toBe("any")
  })
  it("orders facet options by count and never invents a zero", () => {
    expect(orderFacetOptions(role.options!, { user: 5, admin: 2 }).map((o) => `${o.value}:${o.count}`)).toEqual(["user:5", "admin:2", "x:0"])
    expect(orderFacetOptions(role.options!, undefined).every((o) => o.count === undefined)).toBe(true)
    expect(orderFacetOptions(role.options!, null).every((o) => o.count === null)).toBe(true)
  })
})
