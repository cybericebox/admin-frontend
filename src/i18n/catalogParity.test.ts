/**
 * Whole-catalog guard: uk and en carry the same keys, no blank values, and the
 * same {placeholder} names per key (so t(key, vars) fills both languages).
 */
import { describe, it, expect } from "vitest"
import en from "../../messages/en.json"
import uk from "../../messages/uk.json"

const EN = en as Record<string, string>
const UK = uk as Record<string, string>
const placeholders = (s: string) => [...s.matchAll(/(?<!\{)\{(\w+)\}(?!\})/g)].map((m) => m[1]).sort()

describe("messages uk/en parity", () => {
  it("defines the same keys in both catalogs", () => {
    expect(Object.keys(UK).sort()).toEqual(Object.keys(EN).sort())
  })

  it("has no blank values", () => {
    for (const [name, cat] of [["en", EN], ["uk", UK]] as const) {
      for (const [k, v] of Object.entries(cat)) expect(v.trim(), `${name}: blank ${k}`).not.toBe("")
    }
  })

  it("uses the same placeholders in both languages", () => {
    for (const k of Object.keys(EN)) {
      if (k in UK) expect(placeholders(UK[k]), `placeholders differ for ${k}`).toEqual(placeholders(EN[k]))
    }
  })
})
