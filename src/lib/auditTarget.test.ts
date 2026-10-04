import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/origins", () => ({ exercisesOrigin: "https://exercises.example.test" }))
import { parseAuditTarget } from "./auditTarget"

const A = "11111111-1111-4111-8111-111111111111"
const B = "22222222-2222-4222-8222-222222222222"

describe("parseAuditTarget", () => {
  it("links events, users, agents, labs and exercises", () => {
    expect(parseAuditTarget(`event:${A} team:${B}`)).toEqual([
      { kind: "event", id: A, href: `/events/detail?id=${A}` },
      { kind: "team", id: B },
    ])
    expect(parseAuditTarget(`userID:${A}`)[0]).toMatchObject({ kind: "user", href: `/users/detail?id=${A}` })
    expect(parseAuditTarget(`agent:${A}`)[0].href).toBe("/agents")
    expect(parseAuditTarget(`test-lab:${A} device:web`)).toEqual([{ kind: "test-lab", id: A, href: "/labs" }, { kind: "device", id: "web" }])
    expect(parseAuditTarget(`exercise:${A}`)[0]).toMatchObject({ href: `https://exercises.example.test/detail?id=${A}`, external: true })
  })

  it("does not link an ambiguous id or a malformed one, and handles empty", () => {
    expect(parseAuditTarget(`id:${A}`)).toEqual([{ kind: "id", id: A }])
    expect(parseAuditTarget("event:not-a-uuid")).toEqual([{ kind: "event", id: "not-a-uuid" }])
    expect(parseAuditTarget("")).toEqual([])
  })
})
