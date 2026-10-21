import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { InboxButton } from "./InboxButton"

const api = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), post: vi.fn() }))
const access = vi.hoisted(() => ({ allowed: true }))
const navigation = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock("@/api/client", async (importOriginal) => ({ ...await importOriginal<typeof import("@/api/client")>(), apiGet: api.get, apiPatch: api.patch, apiPost: api.post }))
vi.mock("@/lib/useRole", () => ({ useRole: () => ({ can: () => access.allowed }) }))
vi.mock("next/navigation", () => ({ useRouter: () => navigation }))

const pulse = vi.hoisted(() => ({ listeners: new Set<(value: unknown) => void>(), last: null as unknown }))
vi.mock("@/lib/pulse", () => ({
  getPulseLoop: () => ({
    subscribe: (listener: (value: unknown) => void) => {
      pulse.listeners.add(listener)
      if (pulse.last) queueMicrotask(() => listener(pulse.last))
      return () => pulse.listeners.delete(listener)
    },
    pulseNow: vi.fn(),
  }),
}))
const emitPulse = (value: unknown) => { pulse.last = value; act(() => pulse.listeners.forEach((listener) => listener(value))) }

const BASE_CURSOR = "c0"
const NEW_CURSOR = "c1"
const sinceOf = (path: string) => new URL(path, "http://x").searchParams.get("since")
// Baseline (since=""), news (since=<cursor>) and the list (no since) answered by one mock.
function mockApi(opts: { unread: number; news?: Record<string, unknown>[]; newsUnread?: number; list: Record<string, unknown>[]; counts?: unknown; nextCursor?: (path: string) => unknown }) {
  pulse.last = { Banners: "1", Inbox: { Cursor: BASE_CURSOR, Unread: opts.unread } }
  api.get.mockImplementation((path: string) => {
    const since = sinceOf(path)
    if (since === "") return Promise.resolve({ Cursor: BASE_CURSOR, Items: [], Unread: opts.unread, Counts: opts.counts, OtherEventsCount: 0 })
    if (since !== null) return Promise.resolve({ Cursor: NEW_CURSOR, Items: opts.news ?? [], Unread: opts.newsUnread ?? opts.unread, Counts: opts.counts })
    return Promise.resolve({ Items: opts.list, NextCursor: "" })
  })
}
let autoIntersect = false
let observers: Array<{ trigger: () => void }> = []

function mockInbox(items: Record<string, unknown>[]) {
  mockApi({ unread: items.filter((item) => !item.ReadAt).length, list: items })
}

describe("top-bar inbox", () => {
  beforeEach(() => {
    autoIntersect = false
    observers = []
    vi.stubGlobal("IntersectionObserver", class {
      private callback: IntersectionObserverCallback
      private target: Element | null = null
      constructor(callback: IntersectionObserverCallback) { this.callback = callback; observers.push(this) }
      observe(target: Element) { this.target = target; if (autoIntersect) queueMicrotask(() => this.trigger()) }
      disconnect() { this.target = null }
      trigger() {
        if (this.target) this.callback([{ isIntersecting: true, target: this.target } as IntersectionObserverEntry], this as unknown as IntersectionObserver)
      }
    })
    api.get.mockReset()
    pulse.last = null
    pulse.listeners.clear()
    api.patch.mockReset()
    api.post.mockReset()
    navigation.push.mockReset()
    access.allowed = true
    Element.prototype.scrollTo = vi.fn() as unknown as Element["scrollTo"]
    mockInbox([{ ID: "1", Title: "Запрошення", Body: "Деталі запрошення", Link: "", ReadAt: null, CreatedAt: "2026-09-24T12:00:00Z" }])
    api.patch.mockResolvedValue(undefined)
  })

  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

  it("shows the message in place and marks it read without opening a detail view", async () => {
    render(<InboxButton />)
    expect(await screen.findByText("1")).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: /Вхідні/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Вхідні, непрочитані: 1" }))
    fireEvent.click(within(await screen.findByRole("listitem")).getByRole("button", { name: "Позначити прочитаним" }))
    expect(screen.getByText("Деталі запрошення")).toBeInTheDocument()
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith("/api/notifications/inbox/1/read", {}))
  })

  it("a card with a link is clickable as a whole through its link; a card without one is not", async () => {
    mockInbox([
      { ID: "1", Title: "Доступ", Body: "", Link: "https://spring.example.org/manage/", ReadAt: null, CreatedAt: "2026-09-24T12:00:00Z" },
      { ID: "2", Title: "Без посилання", Body: "", Link: "", ReadAt: null, CreatedAt: "2026-09-24T11:00:00Z" },
    ])
    render(<InboxButton />)
    fireEvent.click(await screen.findByRole("button", { name: "Вхідні, непрочитані: 2" }))
    const [linked, plain] = await screen.findAllByRole("listitem")
    const link = within(linked).getByRole("link", { name: "Відкрити" })
    expect(link).toHaveAttribute("href", "https://spring.example.org/manage/")
    expect(link.className).toContain("after:inset-0")
    expect(linked.className).toContain("cursor-pointer")
    expect(within(plain).queryByRole("link")).not.toBeInTheDocument()
    expect(plain.className).not.toContain("cursor-pointer")
  })

  it("«Вирішено» sits above the card link and resolves without following it", async () => {
    mockInbox([{ ID: "1", Title: "Збій", Body: "", Link: "https://spring.example.org/manage/", ActionRequired: true, Resolvable: true, ReadAt: null, CreatedAt: "2026-09-24T12:00:00Z" }])
    api.post.mockResolvedValue(undefined)
    render(<InboxButton />)
    fireEvent.click(await screen.findByRole("button", { name: /Вхідні/ }))
    const row = await screen.findByRole("listitem")
    const resolve = within(row).getByRole("button", { name: "Вирішено" })
    // The link's pseudo-element covers the row; the button must be positioned above it.
    expect(resolve.className).toContain("relative")
    expect(resolve.className).toContain("z-10")
    fireEvent.click(resolve)
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/api/notifications/inbox/1/resolve", {}))
    expect(api.patch).not.toHaveBeenCalled()
    expect(navigation.push).not.toHaveBeenCalled()
  })

  it("marks all messages read without leaving the current page", async () => {
    render(<InboxButton />)
    fireEvent.click(await screen.findByRole("button", { name: "Вхідні, непрочитані: 1" }))
    await screen.findByRole("listitem")
    // The header action comes first; each row has its own.
    fireEvent.click(screen.getAllByRole("button", { name: "Позначити прочитаним" })[0])
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith("/api/notifications/inbox/read-all?site=admin", {}))
    expect(screen.getByRole("button", { name: "Вхідні" })).toBeInTheDocument()
  })

  it("syncs by since-cursor: baseline first, then again while the answer's cursor differs from the pulse's", async () => {
    const one = { ID: "n1", Title: "Перше", Body: "", Link: "", ReadAt: null, CreatedAt: "2026-09-24T12:01:00Z" }
    const two = { ID: "n2", Title: "Друге", Body: "", Link: "", ReadAt: null, CreatedAt: "2026-09-24T12:02:00Z" }
    pulse.last = { Banners: "1", Inbox: { Cursor: BASE_CURSOR, Unread: 0 } }
    api.get.mockImplementation((path: string) => {
      const since = sinceOf(path)
      if (since === "") return Promise.resolve({ Cursor: BASE_CURSOR, Items: [], Unread: 0 })
      if (since === BASE_CURSOR) return Promise.resolve({ Cursor: "c1", Items: [one], Unread: 1 })
      if (since === "c1") return Promise.resolve({ Cursor: "c2", Items: [two], Unread: 2 })
      return Promise.resolve({ Items: [], NextCursor: "" })
    })
    render(<InboxButton />)
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2))
    emitPulse({ Banners: "1", Inbox: { Cursor: "c2", Unread: 2 } })
    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/api/notifications/inbox?site=admin&since=c1"))
    expect(api.get).toHaveBeenCalledWith("/api/notifications/inbox?site=admin&since=c0")
    // An unchanged pulse asks for nothing.
    const calls = api.get.mock.calls.length
    emitPulse({ Banners: "1", Inbox: { Cursor: "c2", Unread: 2 } })
    expect(api.get.mock.calls.length).toBe(calls)
  })

  it("lists every notification and labels Event-bound ones with the Event name", async () => {
    mockInbox([
      { ID: "1", Title: "Старт", Body: "", Link: "", ReadAt: null, CreatedAt: "2026-09-24T12:00:00Z", EventID: "e1", EventName: "Зимовий CTF", EventTag: "winter" },
      { ID: "2", Title: "Акаунт", Body: "", Link: "", ReadAt: null, CreatedAt: "2026-09-24T11:00:00Z", EventID: null, EventName: null, EventTag: null },
    ])
    render(<InboxButton />)
    fireEvent.click(await screen.findByRole("button", { name: "Вхідні, непрочитані: 2" }))
    expect((await screen.findByText("Старт")).closest("li")).toHaveTextContent("Зимовий CTF")
    expect(screen.getByText("Акаунт").closest("li")).not.toHaveTextContent("Зимовий CTF")
    for (const [path] of api.get.mock.calls) expect(new URL(path as string, "http://x").searchParams.has("event")).toBe(false)
  })

  it("shows the saved notification icon in the inbox", async () => {
    mockInbox([{ ID: "1", Title: "Подія", Body: "Деталі", Link: "", Icon: "calendar", Tone: "info", AccentColor: "", ReadAt: null, CreatedAt: "2026-09-24T12:00:00Z" }])
    render(<InboxButton />)
    fireEvent.click(await screen.findByRole("button", { name: "Вхідні, непрочитані: 1" }))
    expect((await screen.findByText("Подія")).closest("li")).toContainHTML("lucide-calendar-days")
  })

  it("fills an underfull inbox automatically without a load-more button", async () => {
    autoIntersect = true
    const first = { ID: "recent", Title: "Останнє", Body: "", Link: "", ReadAt: null, CreatedAt: "2026-09-25T12:00:00Z" }
    const older = { ID: "older", Title: "Раніше", Body: "", Link: "", ReadAt: null, CreatedAt: "2026-09-24T12:00:00Z" }
    mockApi({ unread: 25, list: [first] })
    const list = api.get.getMockImplementation()!
    api.get.mockImplementation((path: string) => new URL(path, "http://x").searchParams.has("before")
      ? Promise.resolve({ Items: [older], NextCursor: "" })
      : sinceOf(path) === null ? Promise.resolve({ Items: [first], NextCursor: first.ID }) : list(path))
    render(<InboxButton />)
    fireEvent.click(await screen.findByRole("button", { name: "Вхідні, непрочитані: 25" }))
    expect(await screen.findByText("Останнє")).toBeInTheDocument()
    expect(await screen.findByText("Раніше")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Вхідні, непрочитані: 25" })).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledWith(expect.stringContaining("before=recent"))
    expect(screen.queryByRole("button", { name: "Завантажити ще" })).not.toBeInTheDocument()
  })

  it("loads the next page when the last row becomes visible", async () => {
    const first = { ID: "recent", Title: "Останнє", Body: "", Link: "", ReadAt: null, CreatedAt: "2026-09-25T12:00:00Z" }
    const older = { ID: "older", Title: "Раніше", Body: "", Link: "", ReadAt: null, CreatedAt: "2026-09-24T12:00:00Z" }
    mockApi({ unread: 2, list: [first] })
    const list = api.get.getMockImplementation()!
    api.get.mockImplementation((path: string) => new URL(path, "http://x").searchParams.has("before")
      ? Promise.resolve({ Items: [older], NextCursor: "" })
      : sinceOf(path) === null ? Promise.resolve({ Items: [first], NextCursor: first.ID }) : list(path))
    render(<InboxButton />)
    fireEvent.click(await screen.findByRole("button", { name: "Вхідні, непрочитані: 2" }))
    expect(await screen.findByText("Останнє")).toBeInTheDocument()
    expect(screen.queryByText("Раніше")).not.toBeInTheDocument()
    act(() => observers.at(-1)?.trigger())
    expect(await screen.findByText("Раніше")).toBeInTheDocument()
  })

  it("shows a safe transition link below the message", async () => {
    mockInbox([{ ID: "1", Title: "Подія", Body: "Деталі", Link: "/events", Actions: [{ label: "Інша дія", href: "/other" }], ReadAt: null, CreatedAt: "2026-09-24T12:00:00Z" }])
    render(<InboxButton />)
    fireEvent.click(await screen.findByRole("button", { name: "Вхідні, непрочитані: 1" }))
    expect(screen.getByRole("link", { name: "Відкрити" })).toHaveAttribute("href", "/events")
    expect(screen.queryByRole("link", { name: "Інша дія" })).not.toBeInTheDocument()
  })

  it("does not turn a pop-in action into the optional inbox link", async () => {
    mockInbox([{ ID: "1", Title: "Подія", Body: "Деталі", Link: "", Actions: [{ label: "Перейти", href: "/events" }], ReadAt: null, CreatedAt: "2026-09-24T12:00:00Z" }])
    render(<InboxButton />)
    fireEvent.click(await screen.findByRole("button", { name: "Вхідні, непрочитані: 1" }))
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
    expect(within(screen.getByRole("listitem")).getByRole("button", { name: "Позначити прочитаним" })).toBeInTheDocument()
  })

  it("pops only fresh unread messages with a configured duration", async () => {
    const old = { ID: "old", Title: "Старе", Body: "Вже було", Link: "", AutoDismissMs: 5000, ReadAt: null, CreatedAt: "2026-09-24T12:00:00Z" }
    const fresh = { ID: "new", Title: "Нове", Body: "Щойно прийшло", Link: "", AutoDismissMs: 5000, ReadAt: null, CreatedAt: "2026-09-24T12:01:00Z" }
    mockApi({ unread: 1, news: [fresh], newsUnread: 2, list: [old] })
    render(<InboxButton />)
    expect(await screen.findByRole("button", { name: "Вхідні, непрочитані: 1" })).toBeInTheDocument()
    expect(screen.queryByRole("status", { name: "Нове повідомлення" })).not.toBeInTheDocument()

    act(() => window.dispatchEvent(new Event("cybericebox:inbox-updated")))
    const popIn = await screen.findByRole("status", { name: "Нове повідомлення" })
    expect(popIn).toHaveTextContent("Нове")
    expect(screen.getByRole("button", { name: "Вхідні, непрочитані: 2" })).toBeInTheDocument()
  })

  it("pops a fresh message for five seconds when the template duration is empty", async () => {
    const fresh = { ID: "new", Title: "Нове", Body: "Деталі", Link: "", AutoDismissMs: null, ReadAt: null, CreatedAt: "2026-09-24T12:01:00Z" }
    mockApi({ unread: 0, news: [fresh], newsUnread: 1, list: [] })
    render(<InboxButton />)
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2))
    act(() => window.dispatchEvent(new Event("cybericebox:inbox-updated")))
    expect(await screen.findByRole("status", { name: "Нове повідомлення" })).toHaveTextContent("Нове")
  })

  it("removes a pop-in when another tab reads its message", async () => {
    const fresh = { ID: "new", Title: "Нове", Body: "Деталі", Link: "", Actions: [{ label: "Перейти", href: "/events" }], AutoDismissMs: 5000, ReadAt: null, CreatedAt: "2026-09-24T12:01:00Z" }
    let delta = 0
    pulse.last = { Banners: "1", Inbox: { Cursor: BASE_CURSOR, Unread: 0 } }
    api.get.mockImplementation((path: string) => {
      const since = sinceOf(path)
      if (since === "") return Promise.resolve({ Cursor: BASE_CURSOR, Items: [], Unread: 0 })
      if (since !== null) {
        delta += 1
        return Promise.resolve(delta === 1 ? { Cursor: NEW_CURSOR, Items: [fresh], Unread: 1 } : { Cursor: NEW_CURSOR, Items: [], Unread: 0 })
      }
      return Promise.resolve({ Items: delta > 1 ? [{ ...fresh, ReadAt: "2026-09-24T12:02:00Z" }] : [], NextCursor: "" })
    })
    render(<InboxButton />)
    expect(await screen.findByRole("button", { name: "Вхідні" })).toBeInTheDocument()
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2))

    act(() => window.dispatchEvent(new Event("cybericebox:inbox-updated")))
    await screen.findByRole("status", { name: "Нове повідомлення" })

    // A second tab reads the same message; a refresh must keep it out of pop-ins.
    act(() => window.dispatchEvent(new Event("cybericebox:inbox-updated")))
    await waitFor(() => expect(screen.getByRole("button", { name: "Вхідні" })).toBeInTheDocument())
    expect(screen.queryByRole("status", { name: "Нове повідомлення" })).not.toBeInTheDocument()
  })

  it("does not flash a fresh message already read in another tab", async () => {
    const fresh = { ID: "new", Title: "Вже прочитане", Body: "Деталі", Link: "", AutoDismissMs: 5000, ReadAt: null, CreatedAt: "2026-09-24T12:01:00Z" }
    mockApi({ unread: 0, news: [fresh], newsUnread: 0, list: [{ ...fresh, ReadAt: "2026-09-24T12:01:01Z" }] })
    render(<InboxButton />)
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2))
    act(() => window.dispatchEvent(new Event("cybericebox:inbox-updated")))
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(4))
    expect(screen.queryByRole("status", { name: "Нове повідомлення" })).not.toBeInTheDocument()
  })

  it("marks a pop-in action read before navigating", async () => {
    const fresh = { ID: "new", Title: "Нове", Body: "Деталі", Link: "", Actions: [{ label: "Перейти", href: "/events" }], AutoDismissMs: 5000, ReadAt: null, CreatedAt: "2026-09-24T12:01:00Z" }
    mockApi({ unread: 0, news: [fresh], newsUnread: 1, list: [] })
    render(<InboxButton />)
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2))
    act(() => window.dispatchEvent(new Event("cybericebox:inbox-updated")))
    const popIn = await screen.findByRole("status", { name: "Нове повідомлення" })
    fireEvent.click(within(popIn).getByRole("button", { name: "Перейти" }))
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith("/api/notifications/inbox/new/read", {}))
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith("/events"))
  })

  it("centers the framed shared icon and disables read-all when the inbox is empty", async () => {
    mockInbox([])
    render(<InboxButton />)
    fireEvent.click(screen.getByRole("button", { name: "Вхідні" }))
    const empty = await screen.findByText("Немає сповіщень")
    expect(empty.closest("[data-empty-state]")?.querySelector("svg path")?.getAttribute("d"))
      .toBe("M4.5 5.5h15L21.5 18a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2l2-12.5Z")
    expect(empty.closest("[data-empty-state]")?.querySelector("span")).toHaveClass("border")
    expect(empty.closest("[data-empty-state]")?.querySelector("svg")).toHaveClass("h-5", "w-5")
    expect(empty.closest("[data-empty-state]")?.parentElement).toHaveClass("min-h-48", "items-center", "justify-center")
    expect(screen.getByRole("button", { name: "Позначити прочитаним" })).toBeDisabled()
    expect(document.querySelectorAll("svg.lucide-bell")).toHaveLength(2)
  })

  describe("categories", () => {
    const lab = { ID: "lab", Title: "Лабораторія впала", Body: "", Link: "", ReadAt: null, CreatedAt: "2026-09-24T12:00:00Z", Type: "event.lab.failed", Resolvable: true, Category: "requests", ActionRequired: true, ResolvedAt: null }
    const done = { ID: "done", Title: "Нова заявка", Body: "", Link: "", ReadAt: "2026-09-24T12:05:00Z", CreatedAt: "2026-09-24T12:30:00Z", Type: "event.application.submitted", Category: "requests", ActionRequired: true, ResolvedAt: "2026-09-24T12:04:00Z", Resolution: "approved", ResolvedBy: { ID: "u", Name: "Іван П." } }
    const personal = { ID: "p", Title: "Особисте повідомлення", Body: "", Link: "", ReadAt: null, CreatedAt: "2026-09-24T11:00:00Z", Category: "personal" }
    function mockCategories(requests: number) {
      const all = [done, lab, personal]
      mockApi({ unread: 2, list: all, counts: { All: requests + 1, Requests: requests, Personal: 1, Activity: 0 } })
      const base = api.get.getMockImplementation()!
      api.get.mockImplementation((path: string) => {
        const url = new URL(path, "http://x")
        if (url.searchParams.has("since")) return base(path)
        const category = url.searchParams.get("category")
        return Promise.resolve({ Items: category ? all.filter((item) => item.Category === category) : all, NextCursor: "" })
      })
    }

    it("opens on «Запити» when requests are open: open first, resolved below with who resolved them", async () => {
      mockCategories(1)
      render(<InboxButton defaultTab="requestsIfOpen" />)
      fireEvent.click(await screen.findByRole("button", { name: "Вхідні: запитів у роботі 1, непрочитаних 1" }))
      expect(await screen.findByRole("tab", { name: "Запити, потребують дії: 1", selected: true })).toBeInTheDocument()
      await waitFor(() => expect(api.get).toHaveBeenCalledWith("/api/notifications/inbox?site=admin&category=requests"))
      const rows = (await screen.findAllByRole("listitem")).map((row) => row.textContent)
      expect(rows[0]).toContain("Лабораторія впала")
      expect(rows[1]).toMatch(/Схвалив Іван П\., /)
      expect(screen.queryByText("Особисте повідомлення")).not.toBeInTheDocument()
    })

    it("opens on «Усі» without open requests", async () => {
      mockCategories(0)
      render(<InboxButton defaultTab="requestsIfOpen" />)
      fireEvent.click(await screen.findByRole("button", { name: "Вхідні, непрочитані: 1" }))
      expect(await screen.findByRole("tab", { name: "Усі: 1", selected: true })).toBeInTheDocument()
    })

    it("marks only the current tab read", async () => {
      mockCategories(0)
      render(<InboxButton defaultTab="requestsIfOpen" />)
      fireEvent.click(await screen.findByRole("button", { name: "Вхідні, непрочитані: 1" }))
      fireEvent.click(await screen.findByRole("tab", { name: "Особисте: 1" }))
      expect(await screen.findByText("Особисте повідомлення")).toBeInTheDocument()
      fireEvent.click(screen.getAllByRole("button", { name: "Позначити прочитаним" })[0])
      await waitFor(() => expect(api.patch).toHaveBeenCalledWith("/api/notifications/inbox/read-all?site=admin&category=personal", {}))
    })

    it("resolves a failed lab by hand and shows a localized error", async () => {
      mockCategories(1)
      const { ApiError } = await import("@/api/client")
      api.post.mockRejectedValueOnce(new ApiError(409, {}, "already", undefined, 70219))
      render(<InboxButton defaultTab="requestsIfOpen" />)
      fireEvent.click(await screen.findByRole("button", { name: "Вхідні: запитів у роботі 1, непрочитаних 1" }))
      fireEvent.click(await screen.findByRole("button", { name: "Вирішено" }))
      await waitFor(() => expect(api.post).toHaveBeenCalledWith("/api/notifications/inbox/lab/resolve", {}))
      expect(await screen.findByRole("alert")).toHaveTextContent("Запит уже вирішено")
      expect(screen.getAllByRole("button", { name: "Вирішено" })).toHaveLength(1)
    })
  })

  it("shows only «Усі» when the backend sends no counts", async () => {
    render(<InboxButton defaultTab="requestsIfOpen" />)
    fireEvent.click(await screen.findByRole("button", { name: "Вхідні, непрочитані: 1" }))
    expect(await screen.findByText("Запрошення")).toBeInTheDocument()
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument()
  })

  it("is absent without access to own notifications", () => {
    access.allowed = false
    render(<InboxButton />)
    expect(screen.queryByRole("button", { name: /Вхідні/ })).not.toBeInTheDocument()
  })
})
