// Inbox categories (docs/INBOX-DESIGN.md §3): tolerant parsing, default tab per app,
// request ordering, optimistic counts and the resolved line keys.
import { test } from "vitest"
import { strict as assert } from "node:assert"
import en from "../../../messages/en.json"
import uk from "../../../messages/uk.json"
import * as inbox from "./inboxModel"
type Message = inbox.InboxMessage

const messages = (lang: string) => (lang === "uk" ? uk : en) as Record<string, string>

function item(id: string, fields: Partial<Message> = {}): Message {
  return { ID: id, Title: id, Body: "", Link: "", ReadAt: null, CreatedAt: "2026-09-29T09:00:00Z", ...fields }
}

test("older backend: no Counts means no categories", () => {
  assert.equal(inbox.parseCounts(undefined), null)
  assert.equal(inbox.parseCounts(null), null)
  assert.equal(inbox.parseCounts(3), null)
  assert.equal(inbox.resolveDefaultTab("personal", null), "all")
  assert.equal(inbox.resolveDefaultTab("requestsIfOpen", null), "all")
})

test("counts are parsed tolerantly", () => {
  assert.deepEqual(inbox.parseCounts({ All: 4, Requests: 2, Personal: "x", Activity: -1 }), { all: 4, requests: 2, personal: 0, activity: 0 })
  assert.deepEqual(inbox.parseCounts({}), { all: 0, requests: 0, personal: 0, activity: 0 })
  assert.equal(inbox.parseOtherEvents(5), 5)
  assert.equal(inbox.parseOtherEvents(undefined), 0)
  assert.equal(inbox.parseOtherEvents("5"), 0)
})

test("default tab per app", () => {
  const none = { all: 0, requests: 0, personal: 0, activity: 0 }
  const open = { ...none, requests: 2 }
  assert.equal(inbox.resolveDefaultTab("all", open), "all") // landing, event participant
  assert.equal(inbox.resolveDefaultTab("personal", open), "personal") // id
  assert.equal(inbox.resolveDefaultTab("requests", none), "requests") // event /manage
  assert.equal(inbox.resolveDefaultTab("requestsIfOpen", open), "requests") // admin, exercises
  assert.equal(inbox.resolveDefaultTab("requestsIfOpen", none), "all")
})

const request = (id: string, fields: Partial<Message> = {}) => item(id, { Category: "requests", ActionRequired: true, ...fields })

test("requests: open first, resolved below, order kept inside each group", () => {
  const list = [
    request("r1", { ResolvedAt: "2026-09-29T10:00:00Z" }),
    request("o1"),
    request("r2", { ResolvedAt: "2026-09-29T08:00:00Z" }),
    request("o2"),
  ]
  assert.deepEqual(inbox.orderForTab(list, "requests").map((entry) => entry.ID), ["o1", "o2", "r1", "r2"])
  assert.deepEqual(inbox.orderForTab(list, "all").map((entry) => entry.ID), ["r1", "o1", "r2", "o2"])
})

test("open = ActionRequired and not resolved (§8.3)", () => {
  assert.equal(inbox.isOpenRequest(request("r", { ResolvedAt: "2026-09-29T10:00:00Z" })), false)
  assert.equal(inbox.isOpenRequest(request("o")), true)
  assert.equal(inbox.isOpenRequest(request("read", { ReadAt: "2026-09-29T10:00:00Z" })), true)
  // Backfilled legacy rows keep ActionRequired false even in «Запити».
  assert.equal(inbox.isOpenRequest(item("legacy", { Category: "requests" })), false)
  assert.equal(inbox.isUnread(item("u")), true)
  assert.equal(inbox.isUnread(item("x", { ReadAt: "2026-09-29T10:00:00Z" })), false)
})

test("«Вирішено» only on open «Лабораторія впала» requests", () => {
  assert.equal(inbox.canResolve(request("lab", { Type: "event.lab.failed" })), true)
  assert.equal(inbox.canResolve(request("lab", { Type: "event.lab.failed", ResolvedAt: "2026-09-29T10:00:00Z" })), false)
  assert.equal(inbox.canResolve(request("app", { Type: "event.application.submitted" })), false)
  assert.equal(inbox.canResolve(item("fyi", { Type: "event.lab.failed" })), false)
})

test("bell and resolver name", () => {
  assert.equal(inbox.bellCount(3, null), 3)
  assert.equal(inbox.bellCount(3, { all: 5, requests: 2, personal: 3, activity: 0 }), 5)
  assert.equal(inbox.resolverName(item("a", { ResolvedBy: { ID: "u", Name: " Іван П. " } })), "Іван П.")
  assert.equal(inbox.resolverName(item("c", { ResolvedBy: null })), "")
})

test("tab membership", () => {
  assert.equal(inbox.inTab(item("x"), "all"), true)
  assert.equal(inbox.inTab(item("x"), "personal"), false)
  assert.equal(inbox.inTab(item("x", { Category: "activity" }), "activity"), true)
})

test("optimistic counts", () => {
  const counts = { all: 5, requests: 2, personal: 3, activity: 2 }
  assert.deepEqual(inbox.countsAfterRead(counts, item("p", { Category: "personal" })), { all: 4, requests: 2, personal: 2, activity: 2 })
  // An open request stays in All and Requests until it is resolved.
  assert.deepEqual(inbox.countsAfterRead(counts, request("q")), counts)
  assert.deepEqual(inbox.countsAfterResolve(counts, request("q")), { all: 4, requests: 1, personal: 3, activity: 2 })
  assert.deepEqual(inbox.countsAfterResolve(counts, item("p", { Category: "personal" })), counts)
  assert.deepEqual(inbox.countsAfterRead(counts, item("x", { ReadAt: "2026-09-29T10:00:00Z", Category: "personal" })), counts)
  assert.deepEqual(inbox.countsAfterReadAll(counts, "personal"), { all: 2, requests: 2, personal: 0, activity: 2 })
  assert.deepEqual(inbox.countsAfterReadAll(counts, "all"), { all: 2, requests: 2, personal: 0, activity: 0 })
  assert.deepEqual(inbox.countsAfterReadAll(counts, "requests"), counts)
})

test("queries carry the category and the event scope", () => {
  assert.equal(inbox.inboxQuery("all"), "")
  assert.equal(inbox.inboxQuery("requests"), "?category=requests")
  assert.equal(inbox.inboxQuery("personal", "ev1"), "?category=personal&event=ev1")
  assert.equal(inbox.inboxQuery("all", undefined, { since_id: "a" }), "?since_id=a")
})

test("resolved line keys exist in both catalogs", () => {
  assert.equal(inbox.resolutionKey("approved", true), "inbox.resolved.approved")
  assert.equal(inbox.resolutionKey("fixed", false), "inbox.resolved.fixed.system")
  assert.equal(inbox.resolutionKey("expired", true), "inbox.resolved.expired.system")
  assert.equal(inbox.resolutionKey("withdrawn", false), "inbox.resolved.withdrawn.system")
  assert.equal(inbox.resolutionKey("something-new", true), "inbox.resolved.other")
  assert.equal(inbox.resolutionKey(null, false), "inbox.resolved.other.system")
  for (const lang of ["uk", "en"]) {
    const catalog = messages(lang)
    for (const resolution of [...inbox.INBOX_RESOLUTIONS, "other"]) {
      for (const named of [true, false]) {
        const key = inbox.resolutionKey(resolution, named)
        assert.ok(catalog[key], `${lang}: ${key}`)
        assert.ok(catalog[key].includes("{time}"), `${lang}: ${key} has {time}`)
        if (named && !key.endsWith(".system")) assert.ok(catalog[key].includes("{name}"), `${lang}: ${key} has {name}`)
      }
    }
    for (const tab of inbox.INBOX_TABS) assert.ok(catalog[`inbox.tab.${tab}`], `${lang}: inbox.tab.${tab}`)
  }
})

test("row time: HH:MM today, date with time otherwise", () => {
  const now = new Date(2026, 8, 29, 18, 0)
  assert.equal(inbox.formatInboxTime(new Date(2026, 8, 29, 12, 4).toISOString(), now, "en-GB"), "12:04")
  assert.match(inbox.formatInboxTime(new Date(2026, 8, 27, 9, 30).toISOString(), now, "en-GB"), /27 Sept?, 09:30/)
  assert.equal(inbox.formatInboxTime("not a date", now), "")
})
