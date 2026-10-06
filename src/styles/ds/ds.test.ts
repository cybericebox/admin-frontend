/**
 * Drift guard: the files in src/styles/ds and the crest in public are copies of docs/design-system
 * (scripts/sync-ds.mjs). A hand edit changes the hash and fails here; change the design system and re-run the sync instead.
 */
import { describe, it, expect } from "vitest"
import { createHash } from "node:crypto"
import fs from "node:fs"
import path from "node:path"

const ROOT = path.resolve(import.meta.dirname, "../../..")
const lock = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "manifest.json"), "utf8")) as Record<string, string>

describe("design system copies", () => {
  it.each(Object.entries(lock))("%s matches the manifest", (file, hash) => {
    const actual = createHash("sha256").update(fs.readFileSync(path.join(ROOT, file))).digest("hex")
    expect(actual).toBe(hash)
  })
})
