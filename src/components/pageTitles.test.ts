import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sources(path)
    return /\.tsx$/.test(name) && !/\.test\./.test(name) ? [path] : []
  })
}

// Every page owns its one h1 through PageHeader; the top bar shows the trail only. Full-screen states (error, not found,
// no access) are the only other places with an h1.
const SCREENS = ["ErrorPage.tsx", "NoAccessScreen.tsx"]

describe("page titles", () => {
  it("no component draws its own page h1", () => {
    const root = join(__dirname, "..")
    const offenders = [...sources(join(root, "components")), ...sources(join(root, "app"))]
      .filter((path) => !SCREENS.some((screen) => path.endsWith(screen)) && !path.endsWith("page-header.tsx"))
      .filter((path) => /<h1[\s>]/.test(readFileSync(path, "utf8")))
    expect(offenders).toEqual([])
  })

  it("the shell no longer watches the DOM for an h1", () => {
    expect(readFileSync(join(__dirname, "shell/AdminShell.tsx"), "utf8")).not.toContain("MutationObserver")
  })
})
