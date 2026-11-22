// The connect-src of deploy/csp.sh: the API host, plus the origin of the retention file only when NEXT_PUBLIC_RETENTION_URL is set (the
// root domain is no longer there: the retention file was the only reason). The container test of the whole script needs Docker; this runs the
// block that builds connect_src in a POSIX shell with the same values.
import { describe, expect, it } from "vitest"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const script = fs.readFileSync(path.resolve(import.meta.dirname, "../deploy/csp.sh"), "utf8")
const start = script.indexOf(`connect_src="'self' https://$host"`)
const end = script.indexOf("\nfi\n", start) + 4
const block = script.slice(start, end)

function connectSrc(retention: string | null): string {
  const env: NodeJS.ProcessEnv = { ...process.env, host: "api.example.test" }
  delete env.NEXT_PUBLIC_RETENTION_URL
  if (retention !== null) env.NEXT_PUBLIC_RETENTION_URL = retention
  const run = spawnSync("sh", ["-c", `${block}\nprintf '%s' "$connect_src"`], { env })
  expect(run.status, String(run.stderr)).toBe(0)
  return String(run.stdout)
}

describe("csp.sh connect-src", () => {
  it("finds the block it tests", () => {
    expect(start).toBeGreaterThan(0)
    expect(block).toContain("NEXT_PUBLIC_RETENTION_URL")
  })

  it.each([[null], [""]])("is the site and the API host only when the retention URL is %j (no root domain)", (value) => {
    expect(connectSrc(value)).toBe("'self' https://api.example.test")
  })

  it.each([
    ["https://policy.example.org/legal/retention.json", "https://policy.example.org"],
    ["https://policy.example.org", "https://policy.example.org"],
    ["https://policy.example.org:8443/a/b?c=d", "https://policy.example.org:8443"],
    ["https://policy.example.org?x=1", "https://policy.example.org"],
  ])("adds the origin of the retention URL %s", (url, origin) => {
    expect(connectSrc(url)).toBe(`'self' https://api.example.test ${origin}`)
  })
})
