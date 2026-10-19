/**
 * Every literal key the code translates exists in the catalog: t("…") / tRich("…") directly, and tPlural("…") with its
 * .one/.few/.many forms. catalogParity only compares uk with en, so a key missing from both slipped through (F7).
 */
import { describe, it, expect } from "vitest"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, resolve } from "node:path"
import en from "../../messages/en.json"
import uk from "../../messages/uk.json"

const root = resolve(import.meta.dirname, "..")
const files: string[] = []
const walk = (dir: string) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path)
    else if (/\.tsx?$/.test(name) && !/\.test\./.test(name)) files.push(path)
  }
}
walk(root)

describe("translated keys exist", () => {
  it("has every literal t/tRich/tPlural key in uk and en", () => {
    const missing: string[] = []
    const has = (key: string) => key in uk && key in en
    for (const file of files) {
      const source = readFileSync(file, "utf8")
      for (const match of source.matchAll(/\bt(?:Rich)?\(\s*"([a-zA-Z0-9_.-]+)"/g)) if (!has(match[1])) missing.push(`${match[1]} (${file.slice(root.length)})`)
      for (const match of source.matchAll(/\btPlural\(\s*"([a-zA-Z0-9_.-]+)"/g)) {
        for (const form of ["one", "few", "many"]) if (!has(`${match[1]}.${form}`)) missing.push(`${match[1]}.${form} (${file.slice(root.length)})`)
      }
    }
    expect(missing).toEqual([])
  })
})
