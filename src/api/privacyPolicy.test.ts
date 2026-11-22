import { describe, expect, it } from "vitest"
import fs from "node:fs"
import path from "node:path"
import { KINDS, UNIT_SECONDS, parsePolicyRetention } from "./privacyPolicy"

const DAY = 24 * 3600

describe("parsePolicyRetention", () => {
  it("gives seconds: a month is 30 days, a year 365", () => {
    expect(parsePolicyRetention({ A: { value: 90, unit: "days", kind: "upTo" }, B: { value: 14, unit: "months", kind: "for" }, C: { value: 3, unit: "years", kind: "over" } }))
      .toEqual({ A: { seconds: 90 * DAY, kind: "upTo" }, B: { seconds: 14 * 30 * DAY, kind: "for" }, C: { seconds: 3 * 365 * DAY, kind: "over" } })
  })

  it("refuses a file that is not a map of positive whole periods", () => {
    expect(() => parsePolicyRetention(null)).toThrow()
    expect(() => parsePolicyRetention([])).toThrow()
    expect(() => parsePolicyRetention({ A: { value: 0, unit: "days", kind: "upTo" } })).toThrow()
    expect(() => parsePolicyRetention({ A: { value: 1.5, unit: "days", kind: "upTo" } })).toThrow()
    expect(() => parsePolicyRetention({ A: { value: 1, unit: "weeks", kind: "upTo" } })).toThrow()
    expect(() => parsePolicyRetention({ A: 30 })).toThrow()
    expect(() => parsePolicyRetention({ A: { value: 1, unit: "days" } })).toThrow()
    expect(() => parsePolicyRetention({ A: { value: 1, unit: "days", kind: "about" } })).toThrow()
  })
})

// The published file is the contract another installation builds on (README, "Retention file"): the schema and the example next to the README
// say the same as the code that reads it.
const ROOT = path.resolve(import.meta.dirname, "../..")
const readJson = (file: string) => JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8")) as Record<string, unknown>

describe("the retention file contract", () => {
  it("has a schema whose units and kinds are the ones the code reads", () => {
    const period = (readJson("retention.schema.json").$defs as { period: { properties: { unit: { enum: string[] }; kind: { enum: string[] } } } }).period
    expect(period.properties.unit.enum).toEqual(Object.keys(UNIT_SECONDS))
    expect(period.properties.kind.enum).toEqual(KINDS)
  })

  it("has an example that the code accepts", () => {
    const example = readJson("retention.example.json")
    expect(Object.keys(parsePolicyRetention(example))).toEqual(Object.keys(example))
  })
})
