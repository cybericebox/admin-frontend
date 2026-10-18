import { existsSync } from "node:fs"
import { join } from "node:path"
import { expect, it } from "vitest"

it.each(["images", "test-mode"])("has no /settings/%s route any more", (name) => {
  expect(existsSync(join(__dirname, name))).toBe(false)
})
