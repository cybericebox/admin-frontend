import { describe, expect, it } from "vitest"
import type { ErrorFilters, ErrorGroup, ErrorStreamEvent } from "@/api/errorJournal"
import { applyStreamEvent, groupMatches, isChatID, notFoundPerDay, replaceGroup, validateSettings } from "./errorJournal"

const group = (over: Partial<ErrorGroup> = {}): ErrorGroup => ({
  ID: "g1", Kind: "http_5xx", Source: "/api/events/:id", Title: "boom", Status: "open", Occurrences: 1,
  FirstSeenAt: "2026-10-01T10:00:00Z", LastSeenAt: "2026-10-01T10:00:00Z", ResolvedAt: null, LastNotifiedAt: null, ...over,
})
const none: ErrorFilters = { kinds: [], status: "", q: "" }
const event = (g: ErrorGroup, isNew = false): ErrorStreamEvent => ({ Group: g, Sample: null, New: isNew })

describe("groupMatches", () => {
  it("applies kind, status, text and period like the server", () => {
    expect(groupMatches(group(), none)).toBe(true)
    expect(groupMatches(group(), { ...none, kinds: ["panic"] })).toBe(false)
    expect(groupMatches(group(), { ...none, kinds: ["panic", "http_5xx"] })).toBe(true)
    expect(groupMatches(group(), { ...none, status: "resolved" })).toBe(false)
    expect(groupMatches(group(), { ...none, q: "EVENTS" })).toBe(true)
    expect(groupMatches(group(), { ...none, q: "nope" })).toBe(false)
    expect(groupMatches(group(), { ...none, from: "2026-10-02T00:00:00Z" })).toBe(false)
  })
})

describe("applyStreamEvent", () => {
  const filters = none
  it("replaces a known group in place and keeps the newest first", () => {
    const page = { items: [group({ ID: "a", LastSeenAt: "2026-10-01T12:00:00Z" }), group({ ID: "b", LastSeenAt: "2026-10-01T11:00:00Z" })], total: 2 }
    const next = applyStreamEvent(page, event(group({ ID: "b", Occurrences: 5, LastSeenAt: "2026-10-01T13:00:00Z" })), filters, 50, 0)
    expect(next.items.map((g) => g.ID)).toEqual(["b", "a"])
    expect(next.items[0].Occurrences).toBe(5)
    expect(next.total).toBe(2)
  })

  it("with a request filter a live event joins only when its own sample is that request", () => {
    const filters = { ...none, request: "a1b2c3d4" }
    const page = { items: [group({ ID: "a" })], total: 1 }
    const other = applyStreamEvent(page, { Group: group({ ID: "n" }), Sample: { RequestID: "ffffffff-0000" } as ErrorStreamEvent["Sample"], New: true }, filters, 50, 0)
    expect(other.items.map((g) => g.ID)).toEqual(["a"])
    const hit = applyStreamEvent(page, { Group: group({ ID: "n", LastSeenAt: "2026-10-02T00:00:00Z" }), Sample: { RequestID: "A1B2C3D4-0000" } as ErrorStreamEvent["Sample"], New: true }, filters, 50, 0)
    expect(hit.items.map((g) => g.ID)).toEqual(["n", "a"])
    expect(applyStreamEvent(page, event(group({ ID: "a", Occurrences: 3 })), filters, 50, 0).items[0].Occurrences).toBe(3)
  })

  it("adds a new group on the first page and counts it", () => {
    const next = applyStreamEvent({ items: [group({ ID: "a" })], total: 1 }, event(group({ ID: "n", LastSeenAt: "2026-10-02T00:00:00Z" }), true), filters, 50, 0)
    expect(next.items.map((g) => g.ID)).toEqual(["n", "a"])
    expect(next.total).toBe(2)
  })

  it("trims to the page size and only counts on later pages", () => {
    const full = { items: [group({ ID: "a" })], total: 1 }
    expect(applyStreamEvent(full, event(group({ ID: "old", LastSeenAt: "2026-09-01T00:00:00Z" }), true), filters, 1, 0).items.map((g) => g.ID)).toEqual(["a"])
    const later = applyStreamEvent(full, event(group({ ID: "n" }), true), filters, 50, 50)
    expect(later.items).toBe(full.items)
    expect(later.total).toBe(2)
  })

  it("ignores groups outside the filters and drops rows that stop matching", () => {
    const page = { items: [group({ ID: "a" })], total: 1 }
    expect(applyStreamEvent(page, event(group({ ID: "x", Kind: "panic" }), true), { ...none, kinds: ["http_5xx"] }, 50, 0)).toBe(page)
    const dropped = applyStreamEvent(page, event(group({ ID: "a", Status: "resolved" })), { ...none, status: "open" }, 50, 0)
    expect(dropped).toEqual({ items: [], total: 0 })
  })
})

describe("replaceGroup", () => {
  it("returns the same page when the answer changes nothing", () => {
    const page = { items: [group()], total: 1 }
    expect(replaceGroup(page, group())).toBe(page)
    expect(replaceGroup(page, group({ Status: "ignored" })).items[0].Status).toBe("ignored")
  })
})

describe("settings validation", () => {
  it("accepts numbers, negative group ids and @channels", () => {
    for (const ok of ["123", "-1001234567890", "@ops_alerts"]) expect(isChatID(ok)).toBe(true)
    for (const bad of ["", "abc", "@a", "12 3", "1.5"]) expect(isChatID(bad)).toBe(false)
  })

  it("flags bad and repeated addresses and chats", () => {
    const issues = validateSettings({ emails: ["a@example.test", "A@example.test", "nope"], chats: [{ chatID: "1", label: "" }, { chatID: "x", label: "" }, { chatID: "1", label: "" }] })
    expect(issues.map((i) => i.key)).toEqual([
      "admin.errors.settings.emailDuplicate", "admin.errors.settings.emailInvalid",
      "admin.errors.settings.chatInvalid", "admin.errors.settings.chatDuplicate",
    ])
  })

  it("enforces the limits of 20", () => {
    const emails = Array.from({ length: 21 }, (_, i) => `u${i}@example.test`)
    const chats = Array.from({ length: 21 }, (_, i) => ({ chatID: String(i + 1), label: "" }))
    const keys = validateSettings({ emails, chats }).map((i) => i.key)
    expect(keys).toEqual(["admin.errors.settings.tooManyEmails", "admin.errors.settings.tooManyChats"])
    expect(validateSettings({ emails: [], chats: [] })).toEqual([])
  })
})

describe("notFoundPerDay", () => {
  it("sums routes per day and fills quiet days with zero", () => {
    const rows = notFoundPerDay({
      From: "2026-10-01T00:00:00Z", To: "2026-10-04T00:00:00Z", Total: 6, Routes: [],
      Days: [{ Day: "2026-10-01", Route: "", Hits: 2 }, { Day: "2026-10-01", Route: "/a", Hits: 1 }, { Day: "2026-10-03", Route: "", Hits: 3 }],
    })
    expect(rows).toEqual([["2026-10-01", 3], ["2026-10-02", 0], ["2026-10-03", 3], ["2026-10-04", 0]])
    expect(notFoundPerDay({ From: "2026-10-01T00:00:00Z", To: "2026-10-04T00:00:00Z", Total: 0, Routes: [], Days: [] })).toEqual([])
  })
})
