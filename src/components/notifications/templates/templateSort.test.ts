import { describe, expect, it, vi } from "vitest"
vi.mock("@/i18n/t", () => ({ t: (key: string) => key }))
import { compareEntries, nextSort } from "./templateSort"

const entry = (type: string, status: "published" | "draft", updated: string, by: string) => {
  const version = { UpdatedAt: updated, UpdatedByUserID: by }
  return { NotificationType: type, Draft: status === "draft" ? version : null, Published: status === "published" ? version : null, Unpublished: null }
}
const names: Record<string, string> = { u1: "Анна", u2: "Богдан" }
const nameOf = (id: string | null | undefined) => (id ? names[id] ?? "" : "")

describe("template list sorting", () => {
  const a = entry("password_reset", "published", "2026-10-01T00:00:00Z", "u2")
  const b = entry("email_confirmation", "draft", "2026-10-05T00:00:00Z", "u1")
  it("sorts by the last change, newest first on the first click of the column", () => {
    const sort = nextSort({ key: "type", dir: "asc" }, "updated")
    expect(sort).toEqual({ key: "updated", dir: "desc" })
    expect([a, b].sort(compareEntries(sort, nameOf))).toEqual([b, a])
  })
  it("sorts by who changed it and flips on a second click", () => {
    const asc = { key: "updatedBy" as const, dir: "asc" as const }
    expect([a, b].sort(compareEntries(asc, nameOf))).toEqual([b, a])
    expect(nextSort(asc, "updatedBy").dir).toBe("desc")
  })
})
